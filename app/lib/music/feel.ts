import "server-only";

import { createHash } from "node:crypto";
import OpenAI from "openai";
import { createAdminClient } from "@/utils/supabase/admin";
import { chunk } from "./spotify-api";
import { setSetting } from "./settings";

/**
 * What every song in the library is like, on axes a person can name.
 *
 * The old engine had no scalar a listener would recognise as energy. `bpm` and
 * `loudness` were loaded, printed in the UI, and thrown away before scoring, and
 * 26 of the 34 sound dimensions are MFCCs, so tempo carried under 3% of the
 * distance between two songs. There was nothing for an arc to be an arc *in*.
 *
 * Four axes fix that, and none of them cost anyone an afternoon of labelling:
 *
 *   arousal   — measured, from loudness, brightness, noisiness and tempo.
 *   valence   — read off the lyric embedding by projecting it onto the
 *               difference between "a joyful, bright, celebratory song" and "a
 *               devastating, grief-stricken song". The same trick gives
 *               intimacy and nostalgia for free.
 *
 * Both were checked against labels that already existed — the owner's own
 * playlists. Arousal separates the driving playlists from the reflective ones
 * by 0.96 SD with disjoint bootstrap intervals; valence separates the bright
 * ones from the bleak ones by 0.59 SD. They correlate with each other at 0.13,
 * so they are two axes and not one wearing two hats.
 *
 * Everything is standardised over the WHOLE library, never over one playlist.
 * The engine this replaced z-scored inside each playlist, so "alike" meant a
 * different thing on a 17-track list than on a 225-track one and no threshold
 * could be stated once.
 */

const MODEL = "text-embedding-3-small";
const TEX_DIMS = 12;
const MEANING_DIMS = 40;

/**
 * Each axis is the difference between what it means to be at one end and the
 * other. Several phrasings per pole, averaged, so no single wording dominates.
 */
export const AXES: Record<string, { pos: string[]; neg: string[] }> = {
  valence: {
    pos: [
      "a joyful, bright, celebratory song about love returned and everything going right",
      "an upbeat, playful, carefree song that makes you smile",
      "a triumphant, hopeful song about coming out the other side",
    ],
    neg: [
      "a devastating, grief-stricken song about loss and being left behind",
      "a bleak, hopeless song about depression and wanting it to stop",
      "a bitter, resentful song about betrayal and things falling apart",
    ],
  },
  intimacy: {
    pos: [
      "a private, confessional song that sounds like it was recorded alone in a bedroom",
      "an intimate, first-person song addressed to one specific person",
    ],
    neg: [
      "an anthemic song written for a stadium of strangers to shout back",
      "an impersonal, glossy, mass-market production about nothing in particular",
    ],
  },
  nostalgia: {
    pos: [
      "a wistful song about the past, about people and places that are gone",
      "a song heavy with memory and longing for how things used to be",
    ],
    neg: [
      "a song entirely about right now, this moment, with no backward glance",
      "a forward-looking song about what happens next",
    ],
  },
};

// ---------------------------------------------------------------------------
// Small numerics
// ---------------------------------------------------------------------------

function stats(values: number[]): { mean: number; sd: number } {
  if (values.length === 0) return { mean: 0, sd: 1 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd =
    Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length) || 1;
  return { mean, sd };
}

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const at = Math.round(p * (sorted.length - 1));
  return sorted[Math.min(sorted.length - 1, Math.max(0, at))];
}

/**
 * Top-k principal components by power iteration.
 *
 * Whitening matters more than the reduction does: the 34 sound dimensions are
 * one axis wearing four hats — spectral centroid against rolloff correlates at
 * 0.98, against zero-crossing rate at 0.89 — so a plain Euclidean distance
 * triple-counts brightness. Whitened components each carry one unit of spread,
 * which is what makes a distance threshold mean something.
 */
export function pca(rows: number[][], k: number, whiten: boolean) {
  const n = rows.length;
  const d = rows[0].length;
  const mean = new Float64Array(d);
  for (const row of rows) for (let j = 0; j < d; j++) mean[j] += row[j] / n;
  const centred = rows.map((row) => Float64Array.from(row, (v, j) => v - mean[j]));

  const comps: Float64Array[] = [];
  const spread: number[] = [];
  for (let c = 0; c < k; c++) {
    // A fixed, ugly starting vector rather than a random one: the whole point of
    // this table is that the same library always fits the same way.
    let v = Float64Array.from({ length: d }, (_, j) => Math.sin((c + 1) * (j + 1) * 0.7391));
    let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    for (let j = 0; j < d; j++) v[j] /= norm;
    let lambda = 0;
    for (let iteration = 0; iteration < 220; iteration++) {
      const w = new Float64Array(d);
      for (const x of centred) {
        let projection = 0;
        for (let j = 0; j < d; j++) projection += x[j] * v[j];
        for (let j = 0; j < d; j++) w[j] += projection * x[j];
      }
      for (let j = 0; j < d; j++) w[j] /= n;
      for (const u of comps) {
        let overlap = 0;
        for (let j = 0; j < d; j++) overlap += w[j] * u[j];
        for (let j = 0; j < d; j++) w[j] -= overlap * u[j];
      }
      norm = Math.sqrt(w.reduce((s, x) => s + x * x, 0));
      if (norm < 1e-12) break;
      lambda = norm;
      for (let j = 0; j < d; j++) v[j] = w[j] / norm;
    }
    comps.push(v);
    spread.push(lambda);
  }

  return (row: number[]): number[] => {
    const out = new Array<number>(k);
    for (let c = 0; c < k; c++) {
      let projection = 0;
      for (let j = 0; j < d; j++) projection += (row[j] - mean[j]) * comps[c][j];
      out[c] = whiten ? projection / Math.sqrt(Math.max(spread[c], 1e-9)) : projection;
    }
    return out;
  };
}

export function parseVector(value: unknown): number[] | null {
  if (Array.isArray(value)) return value as number[];
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as number[]) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// The axis directions
// ---------------------------------------------------------------------------

const AXIS_KEY = "feel.axes";

type AxisCache = { hash: string; vectors: Record<string, number[]> };

function axisHash(): string {
  return createHash("sha1").update(JSON.stringify(AXES)).digest("hex").slice(0, 16);
}

/** One embedding call, then cached — the wording only changes when we change it. */
async function axisVectors(): Promise<Record<string, number[]> | null> {
  const supabase = createAdminClient();
  const wanted = axisHash();
  const { data } = await supabase
    .from("music_settings")
    .select("value")
    .eq("key", AXIS_KEY)
    .maybeSingle();
  const cached = data?.value as AxisCache | undefined;
  if (cached?.hash === wanted) return cached.vectors;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const client = new OpenAI({ apiKey });

  const prompts: Array<{ axis: string; side: number; text: string }> = [];
  for (const [axis, poles] of Object.entries(AXES)) {
    for (const text of poles.pos) prompts.push({ axis, side: 1, text });
    for (const text of poles.neg) prompts.push({ axis, side: -1, text });
  }
  const response = await client.embeddings.create({
    model: MODEL,
    input: prompts.map((p) => p.text),
    dimensions: 1536,
  });

  const vectors: Record<string, number[]> = {};
  for (const axis of Object.keys(AXES)) {
    const side = (want: number) => {
      const rows = prompts
        .map((p, i) => ({ ...p, v: response.data[i].embedding as number[] }))
        .filter((p) => p.axis === axis && p.side === want);
      return rows[0].v.map((_, j) => rows.reduce((s, r) => s + r.v[j], 0) / rows.length);
    };
    const positive = side(1);
    const negative = side(-1);
    const diff = positive.map((v, j) => v - negative[j]);
    const norm = Math.sqrt(diff.reduce((s, v) => s + v * v, 0)) || 1;
    vectors[axis] = diff.map((v) => v / norm);
  }

  await setSetting(AXIS_KEY, { hash: wanted, vectors } satisfies AxisCache);
  return vectors;
}

// ---------------------------------------------------------------------------
// The refit
// ---------------------------------------------------------------------------

const PAGE = 1000;

/**
 * Read a whole table, a page at a time.
 *
 * PostgREST caps an unbounded select at a thousand rows and says nothing about
 * it. The library sits just under that today, so the refit would have started
 * silently fitting on a truncated slice — and worse, the stale sweep at the end
 * deletes every feel row it did not just write, so the first read to cross the
 * cap would have deleted the axes for every track past the thousandth.
 *
 * The order matters: without it two pages can overlap or skip rows.
 */
async function readAll<T>(
  build: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> },
  label: string
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw new Error(`${label} read failed: ${error.message}`);
    const page = data || [];
    out.push(...page);
    if (page.length < PAGE) return out;
  }
}

export type FeelThresholds = {
  /** below this familiarity a track is a stranger to a visitor */
  strangerBelow: number;
  /** at or above this it can anchor one */
  anchorAbove: number;
  fittedAt: string;
};

export const THRESHOLD_KEY = "feel.thresholds";

/**
 * Recompute the whole table. It is ~950 rows of arithmetic over vectors already
 * stored, so this is cheap enough to do outright rather than maintain
 * incrementally — and then there is never a question of whether it drifted out
 * of step with the library.
 */
export async function refitFeel(): Promise<{
  fitted: number;
  skipped: boolean;
  thresholds: FeelThresholds | null;
}> {
  const supabase = createAdminClient();
  const axes = await axisVectors();

  const [tracks, sound, sense, lyrics] = await Promise.all([
    readAll<Record<string, unknown>>(
      () =>
        supabase
          .from("music_tracks")
          .select("track_id, artist_ids, popularity, duration_ms, liked_at, release_year")
          .eq("shelf", "active")
          .eq("unavailable", false)
          .order("track_id"),
      "music_tracks"
    ),
    readAll<Record<string, unknown>>(
      () =>
        supabase
          .from("music_track_sound")
          .select("track_id, embedding, bpm, loudness, dynamics, brightness, zcr, pulse")
          .order("track_id"),
      "music_track_sound"
    ),
    readAll<Record<string, unknown>>(
      () => supabase.from("music_track_sense").select("track_id, embedding").order("track_id"),
      "music_track_sense"
    ),
    readAll<Record<string, unknown>>(
      () =>
        supabase
          .from("music_track_lyrics")
          .select("track_id, status, words_per_min, vocal_start_ms")
          .order("track_id"),
      "music_track_lyrics"
    ),
  ]);

  const soundById = new Map((sound || []).map((row) => [row.track_id as string, row]));
  const senseById = new Map((sense || []).map((row) => [row.track_id as string, row]));
  const lyricById = new Map((lyrics || []).map((row) => [row.track_id as string, row]));

  // Only tracks we have actually listened to can be placed on these axes.
  const pool = (tracks || []).filter((row) => soundById.has(row.track_id as string));
  if (pool.length < 12) return { fitted: 0, skipped: true, thresholds: null };

  // ---- arousal ----------------------------------------------------------
  // Loudness leads because loudness and energy are what carry the adjacency
  // effect in real playlists; tempo is worth a quarter of it, because tempo
  // coherence between adjacent tracks measures at about a fiftieth of loudness's.
  const num = (row: unknown, key: string) => Number((row as Record<string, unknown>)[key] ?? 0);
  const z = (key: string) => {
    const s = stats(pool.map((row) => num(soundById.get(row.track_id as string), key)));
    return (value: number) => (value - s.mean) / s.sd;
  };
  const zLoud = z("loudness");
  const zBright = z("brightness");
  const zZcr = z("zcr");
  const zBpm = z("bpm");
  const zDyn = z("dynamics");
  // A track analysed before the audio pass learned to measure pulse has none.
  // Reading that as zero would put it at the bottom of the scale — 1.3 SD of
  // arousal — rather than leaving the term out, so the scale is built from the
  // tracks that have one and the term is dropped for those that don't.
  const measured = pool
    .map((row) => soundById.get(row.track_id as string))
    .filter((row) => row?.pulse != null)
    .map((row) => Number(row!.pulse));
  const pulseStats = measured.length >= 12 ? stats(measured) : null;

  const rawArousal = (row: Record<string, unknown>) =>
    1.0 * zLoud(Number(row.loudness ?? 0)) +
    0.5 * zBright(Number(row.brightness ?? 0)) +
    0.5 * zZcr(Number(row.zcr ?? 0)) +
    0.25 * zBpm(Number(row.bpm ?? 0)) -
    0.25 * zDyn(Number(row.dynamics ?? 0)) +
    (pulseStats && row.pulse != null
      ? 0.75 * ((Number(row.pulse) - pulseStats.mean) / pulseStats.sd)
      : 0);

  const arousalStats = stats(
    pool.map((row) => rawArousal(soundById.get(row.track_id as string) as Record<string, unknown>))
  );

  // ---- the lyric axes ---------------------------------------------------
  const project = (vector: number[] | null, axis: string) => {
    if (!vector || !axes?.[axis]) return null;
    const a = axes[axis];
    let sum = 0;
    for (let i = 0; i < Math.min(vector.length, a.length); i++) sum += vector[i] * a[i];
    return sum;
  };
  const senseVectorById = new Map<string, number[]>();
  for (const row of pool) {
    const parsed = parseVector(senseById.get(row.track_id as string)?.embedding);
    if (parsed) senseVectorById.set(row.track_id as string, parsed);
  }
  const axisStats: Record<string, { mean: number; sd: number }> = {};
  for (const axis of Object.keys(AXES)) {
    const values = pool
      .map((row) => project(senseVectorById.get(row.track_id as string) ?? null, axis))
      .filter((v): v is number => v !== null);
    axisStats[axis] = values.length >= 12 ? stats(values) : { mean: 0, sd: 1 };
  }

  // ---- texture and meaning ---------------------------------------------
  const soundVectors = pool.map(
    (row) => parseVector(soundById.get(row.track_id as string)?.embedding) || []
  );
  const width = soundVectors.find((v) => v.length)?.length ?? 34;
  const dimStats = Array.from({ length: width }, (_, j) =>
    stats(soundVectors.filter((v) => v.length).map((v) => v[j] ?? 0))
  );
  const standardise = (v: number[]) =>
    Array.from({ length: width }, (_, j) => ((v[j] ?? 0) - dimStats[j].mean) / dimStats[j].sd);
  const usable = soundVectors.filter((v) => v.length).map(standardise);
  // Rank is at most n-1 after centring; asking for more components hands back a
  // raw seed vector with a zero eigenvalue, which whitening then divides by
  // ~1e-9 and turns into a distance of tens of thousands.
  const texDims = Math.min(TEX_DIMS, width, Math.max(0, usable.length - 1));
  const toTexture = texDims > 0 ? pca(usable, texDims, true) : null;

  const meaningRows = Array.from(senseVectorById.values());
  const toMeaning = meaningRows.length >= MEANING_DIMS + 2 ? pca(meaningRows, MEANING_DIMS, false) : null;
  const unit = (v: number[]) => {
    const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / n);
  };

  // ---- density ----------------------------------------------------------
  // Words a minute, over tracks that actually have words. The engine this
  // replaces recorded instrumentals as zero words, which dragged the floor of
  // the scale down to nothing and squashed everyone else into the top of it.
  const spoken = pool
    .map((row) => lyricById.get(row.track_id as string))
    .filter((row) => row?.status === "ok" && Number(row.words_per_min) > 0)
    .map((row) => Number(row!.words_per_min))
    .sort((a, b) => a - b);
  const wordLo = quantile(spoken, 0.05);
  const wordHi = quantile(spoken, 0.95);

  // ---- familiarity ------------------------------------------------------
  // Popularity is the only signal that says anything about what a *visitor*
  // knows. Zero means Spotify has nothing to report, not that nobody listens —
  // 127 tracks sit at exactly zero — so it is treated as missing and filled in
  // from the artist's other songs.
  const known = pool
    .map((row) => Number(row.popularity))
    .filter((p) => p > 0)
    .sort((a, b) => a - b);
  const medianPopularity = quantile(known, 0.5);
  const byArtist = new Map<string, number[]>();
  for (const row of pool) {
    const popularity = Number(row.popularity);
    if (!(popularity > 0)) continue;
    for (const artist of (row.artist_ids as string[] | null) || []) {
      const list = byArtist.get(artist) || [];
      list.push(popularity);
      byArtist.set(artist, list);
    }
  }
  const familiarityOf = (row: (typeof pool)[number]) => {
    const popularity = Number(row.popularity);
    if (popularity > 0) return popularity / 100;
    const siblings = ((row.artist_ids as string[] | null) || []).flatMap(
      (artist) => byArtist.get(artist) || []
    );
    const value = siblings.length
      ? siblings.reduce((a, b) => a + b, 0) / siblings.length
      : medianPopularity;
    return value / 100;
  };

  // ---- freshness --------------------------------------------------------
  // Two ways a song can be new, and the owner asked for either: they found it
  // recently, or it came out recently. Exponential decay rather than a window
  // with a floor — the version this replaces clipped everything past eighteen
  // months to zero and then rank-normalised, which manufactured an even spread
  // whether or not the library had one.
  const now = Date.now();
  const HALF_LIFE_DAYS = 180;
  const HALF_LIFE_YEARS = 2.2;
  const thisYear = new Date().getUTCFullYear();

  const freshnessOf = (row: (typeof pool)[number]) => {
    const likedAt = row.liked_at ? Date.parse(row.liked_at as string) : NaN;
    const newToMe = Number.isFinite(likedAt)
      ? Math.pow(0.5, Math.max(0, (now - likedAt) / 86_400_000) / HALF_LIFE_DAYS)
      : 0;
    const year = Number(row.release_year);
    const newOut =
      year > 1900 ? Math.pow(0.5, Math.max(0, thisYear - year) / HALF_LIFE_YEARS) : 0;
    // Either counts. A song found last week is new to this playlist whatever
    // year it came out, and a record released this year is new to everyone.
    return { newToMe, newOut, freshness: Math.max(newToMe, newOut) };
  };

  // ---- rows -------------------------------------------------------------
  const rows = pool.map((row) => {
    const id = row.track_id as string;
    const s = soundById.get(id) as Record<string, unknown>;
    const lyric = lyricById.get(id);
    const senseVector = senseVectorById.get(id) ?? null;
    const wpm =
      lyric?.status === "ok" && Number(lyric.words_per_min) > 0
        ? Number(lyric.words_per_min)
        : null;
    const vocalStart = lyric?.vocal_start_ms == null ? null : Number(lyric.vocal_start_ms);
    const duration = Number(row.duration_ms ?? 210_000);
    const axisValue = (axis: string) => {
      const raw = project(senseVector, axis);
      if (raw === null) return 0;
      return (raw - axisStats[axis].mean) / axisStats[axis].sd;
    };
    const texture = parseVector(s.embedding);

    return {
      track_id: id,
      arousal: Number(((rawArousal(s) - arousalStats.mean) / arousalStats.sd).toFixed(4)),
      valence: Number(axisValue("valence").toFixed(4)),
      intimacy: Number(axisValue("intimacy").toFixed(4)),
      nostalgia: Number(axisValue("nostalgia").toFixed(4)),
      density:
        wpm === null
          ? null
          : Number(Math.max(0, Math.min(1, (wpm - wordLo) / (wordHi - wordLo || 1))).toFixed(4)),
      familiarity: Number(familiarityOf(row).toFixed(4)),
      ...(() => {
        const { newToMe, newOut, freshness } = freshnessOf(row);
        return {
          freshness: Number(freshness.toFixed(4)),
          new_to_me: Number(newToMe.toFixed(4)),
          new_out: Number(newOut.toFixed(4)),
        };
      })(),
      // Requires the measurement to exist. Treating an unmeasured vocal start as
      // "starts early" made this a duration filter, and put tracks with a long
      // ambient intro in the one slot where that costs most.
      opens_well:
        vocalStart !== null &&
        vocalStart <= 20_000 &&
        duration >= 150_000 &&
        duration <= 300_000,
      texture:
        texture && toTexture
          ? JSON.stringify(toTexture(standardise(texture)).map((v) => Number(v.toFixed(4))))
          : null,
      meaning:
        senseVector && toMeaning
          ? JSON.stringify(unit(toMeaning(senseVector)).map((v) => Number(v.toFixed(5))))
          : null,
      fitted_at: new Date().toISOString(),
    };
  });

  for (const group of chunk(rows, 300)) {
    const { error } = await supabase
      .from("music_track_feel")
      .upsert(group, { onConflict: "track_id" });
    if (error) throw new Error(`feel upsert failed: ${error.message}`);
  }

  // Anything that fell out of the library — retired, delisted — should not keep
  // a stale row that a later playlist read could pick up.
  const live = new Set(rows.map((row) => row.track_id));
  const existing = await readAll<{ track_id: string }>(
    () => supabase.from("music_track_feel").select("track_id").order("track_id"),
    "music_track_feel"
  );
  const stale = existing
    .map((row) => row.track_id as string)
    .filter((id) => !live.has(id));
  for (const group of chunk(stale, 300)) {
    await supabase.from("music_track_feel").delete().in("track_id", group);
  }

  const familiarities = rows.map((row) => row.familiarity).sort((a, b) => a - b);
  const thresholds: FeelThresholds = {
    strangerBelow: Number(quantile(familiarities, 0.30).toFixed(4)),
    anchorAbove: Number(quantile(familiarities, 0.75).toFixed(4)),
    fittedAt: new Date().toISOString(),
  };
  await setSetting(THRESHOLD_KEY, thresholds);

  return { fitted: rows.length, skipped: !axes, thresholds };
}
