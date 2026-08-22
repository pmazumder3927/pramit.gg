import "server-only";

import { createAdminClient } from "@/utils/supabase/admin";
import {
  DEFAULT_SHAPE,
  type Scorecard,
  type Section,
  type SeqTrack,
  type Setlist,
  type Shape,
  type WordCurve,
} from "@/app/music/manage/lib/types";
import { api, chunk, fetchPlaylistMeta, fetchPlaylistTracks } from "./spotify-api";

/**
 * Playlist sequencing.
 *
 * Two vectors decide what "these belong next to each other" means:
 *
 *   sense — an OpenAI embedding of the song's actual lyrics plus its facts.
 *           Knows that two songs about the same thing belong together even
 *           when one is in Korean and the other in English.
 *   sound — 34 numbers measured off a real 30-second preview: tempo, loudness,
 *           dynamics, brightness, spectral flatness, zero-crossing rate and a
 *           13-band MFCC timbre profile with its deviations.
 *
 * Neither comes from Spotify, because nothing can any more: /audio-features and
 * /audio-analysis answer 403 for apps registered after late 2024, /artists
 * returns empty genres, and every preview_url on this account is null. The
 * previous engine filled that hole by regexing song titles for words like
 * "sad" and "night", which is why every pair of songs scored 98/100 compatible.
 *
 * On top of the likeness sit four rules you can check by reading the list:
 * don't stack an artist, spread the songs you actually play, lead with what's
 * new, and move wordiness along a chosen curve.
 */

const ARTIST_WINDOW = 6;
const FAVORITE_WINDOW = 5;
const FAVORITE_CUTOFF = 0.45;
const QUIET_WPM = 45;
const FRESH_WINDOW_DAYS = 540;
const NEW_RELEASE_YEARS = 8;
const NEUTRAL = 0.5;

export type SeqInternal = SeqTrack & {
  /** 0..1, wordiness normalised across this playlist */
  words: number | null;
  /** 0..1, freshness normalised across this playlist */
  fresh: number;
  favorite: boolean;
  quiet: boolean;
  sense: number[] | null;
  sound: number[] | null;
};

function parseVector(value: unknown): number[] | null {
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
// Loading
// ---------------------------------------------------------------------------

function occurrenceUids(trackIds: string[]): string[] {
  const seen = new Map<string, number>();
  return trackIds.map((id) => {
    const n = (seen.get(id) || 0) + 1;
    seen.set(id, n);
    return n === 1 ? id : `${id}#${n}`;
  });
}

function freshnessOf(
  likedAt: string | null,
  affinity: number | null,
  year: number | null
): number {
  const days = likedAt
    ? Math.max(0, (Date.now() - new Date(likedAt).getTime()) / 86_400_000)
    : FRESH_WINDOW_DAYS;
  const newToMe =
    Math.max(0, 1 - days / FRESH_WINDOW_DAYS) + (affinity === null ? 0.25 : 0);
  const age = year ? new Date().getUTCFullYear() - year : NEW_RELEASE_YEARS;
  const newInGeneral = Math.max(0, 1 - age / NEW_RELEASE_YEARS);
  return Math.min(1, 0.6 * newToMe + 0.5 * newInGeneral);
}

async function loadTracks(playlistId: string) {
  const supabase = createAdminClient();
  const meta = await fetchPlaylistMeta(playlistId);
  const items = await fetchPlaylistTracks(playlistId);

  const live = items
    .map((item) => item.track)
    .filter((track): track is NonNullable<typeof track> => Boolean(track?.id));
  const liveIds = live.map((track) => track.id!);
  const uids = occurrenceUids(liveIds);
  const uniqueIds = Array.from(new Set(liveIds));

  const [
    { data: rows },
    { data: lyricRows },
    { data: soundRows },
    { data: senseRows },
    { data: membershipRows },
    { data: playlistRows },
  ] = await Promise.all([
    supabase
      .from("music_tracks")
      .select(
        "track_id, title, artist_display, artist_ids, album_image_url, song_url, duration_ms, release_year, affinity, last_played_at, liked_at, unavailable"
      )
      .in("track_id", uniqueIds),
    supabase
      .from("music_track_lyrics")
      .select("track_id, status, language, words_per_min")
      .in("track_id", uniqueIds),
    supabase
      .from("music_track_sound")
      .select("track_id, embedding, bpm")
      .in("track_id", uniqueIds),
    supabase.from("music_track_sense").select("track_id, embedding").in("track_id", uniqueIds),
    supabase
      .from("music_playlist_tracks")
      .select("track_id, playlist_id")
      .in("track_id", uniqueIds),
    supabase
      .from("music_playlists")
      .select("playlist_id, name")
      .eq("role", "shelf")
      .eq("active", true),
  ]);

  const byId = new Map((rows || []).map((row) => [row.track_id as string, row]));
  const lyricById = new Map((lyricRows || []).map((row) => [row.track_id as string, row]));
  const soundById = new Map((soundRows || []).map((row) => [row.track_id as string, row]));
  const senseById = new Map((senseRows || []).map((row) => [row.track_id as string, row]));
  const playlistNames = new Map(
    (playlistRows || []).map((row) => [row.playlist_id as string, row.name as string])
  );

  const kinById = new Map<string, string[]>();
  for (const row of membershipRows || []) {
    if (row.playlist_id === playlistId) continue;
    const name = playlistNames.get(row.playlist_id as string);
    if (!name) continue;
    const list = kinById.get(row.track_id as string) || [];
    list.push(name);
    kinById.set(row.track_id as string, list);
  }

  const tracks: SeqInternal[] = live.map((track, index) => {
    const row = byId.get(track.id!);
    const lyric = lyricById.get(track.id!);
    const sound = soundById.get(track.id!);
    const sense = senseById.get(track.id!);
    const instrumental = lyric?.status === "instrumental";
    const wpm = (lyric?.words_per_min as number | null) ?? (instrumental ? 0 : null);
    const unavailable = Boolean(row?.unavailable) || !((row?.title as string) || track.name);
    const affinity = (row?.affinity as number) ?? null;
    const releaseYear = (row?.release_year as number) ?? null;

    return {
      uid: uids[index],
      trackId: track.id!,
      title: (row?.title as string) || track.name || "gone from Spotify",
      artist:
        (row?.artist_display as string) ||
        track.artists.map((a) => a.name).join(", ") ||
        "—",
      artistId: (row?.artist_ids as string[] | null)?.[0] || track.artists[0]?.id || null,
      art: (row?.album_image_url as string) || track.album?.images?.[0]?.url || null,
      songUrl: (row?.song_url as string) || track.external_urls?.spotify || null,
      durationMs: (row?.duration_ms as number) ?? track.duration_ms,
      releaseYear,
      affinity,
      lastPlayedAt: (row?.last_played_at as string) ?? null,
      language: (lyric?.language as string) ?? null,
      wordsPerMin: wpm,
      instrumental,
      unavailable,
      freshness: freshnessOf((row?.liked_at as string) ?? null, affinity, releaseYear),
      bpm: (sound?.bpm as number) ?? null,
      heard: Boolean(sound?.embedding),
      read: Boolean(sense?.embedding),
      kin: kinById.get(track.id!) || [],
      words: null,
      fresh: 0,
      favorite: (affinity ?? 0) >= FAVORITE_CUTOFF,
      quiet: instrumental || (wpm !== null && wpm < QUIET_WPM),
      sense: parseVector(sense?.embedding),
      sound: parseVector(sound?.embedding),
    };
  });

  // Wordiness is normalised within the playlist — "wordy for this playlist" is
  // the only comparison that means anything.
  const known = tracks.map((t) => t.wordsPerMin).filter((v): v is number => v !== null);
  if (known.length >= 3) {
    const lo = Math.min(...known);
    const hi = Math.max(...known);
    const span = hi - lo || 1;
    for (const track of tracks) {
      track.words = track.wordsPerMin === null ? null : (track.wordsPerMin - lo) / span;
    }
  }

  // Freshness is compared within the playlist, by rank rather than by value. A
  // library that is mostly old bunches almost every song against the same
  // floor, so a min-max scale would leave the rule with nothing to pull on;
  // ranking spreads it evenly and means "the newest quarter" is exactly that.
  const byFresh = [...tracks].sort((a, b) => a.freshness - b.freshness);
  byFresh.forEach((track, index) => {
    track.fresh = tracks.length > 1 ? index / (tracks.length - 1) : 1;
  });

  return { meta, tracks, liveOrder: uids };
}

// ---------------------------------------------------------------------------
// Likeness
// ---------------------------------------------------------------------------

function dot(a: number[], b: number[]): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) sum += a[i] * b[i];
  return sum;
}

/** Standardise each dimension across this playlist so no unit dominates. */
function standardise(
  vectors: Array<number[] | null>,
  dims: number
): Array<number[] | null> {
  const present = vectors.filter((v): v is number[] => Array.isArray(v));
  if (present.length < 2) return vectors;

  const means = new Array(dims).fill(0);
  for (const vector of present) {
    for (let d = 0; d < dims; d++) means[d] += vector[d] ?? 0;
  }
  for (let d = 0; d < dims; d++) means[d] /= present.length;

  const spread = new Array(dims).fill(0);
  for (const vector of present) {
    for (let d = 0; d < dims; d++) spread[d] += ((vector[d] ?? 0) - means[d]) ** 2;
  }
  for (let d = 0; d < dims; d++) spread[d] = Math.sqrt(spread[d] / present.length) || 1;

  return vectors.map((vector) =>
    vector ? vector.map((v, d) => ((v ?? 0) - means[d]) / spread[d]) : null
  );
}

/** Rescale so the playlist's own spread of likeness fills 0..1. */
function stretch(values: Float32Array, valid: boolean[]): void {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < values.length; i++) {
    if (!valid[i]) continue;
    if (values[i] < lo) lo = values[i];
    if (values[i] > hi) hi = values[i];
  }
  const span = hi - lo;
  for (let i = 0; i < values.length; i++) {
    values[i] = valid[i] && span > 1e-9 ? (values[i] - lo) / span : NEUTRAL;
  }
}

/**
 * The n×n likeness matrix, built once per request. Every cost evaluation after
 * this is an array lookup, which is what makes the search affordable.
 */
export function buildLikeness(tracks: SeqInternal[], shape: Shape): Float32Array {
  const n = tracks.length;
  const size = n * n;
  const senseVectors = tracks.map((t) => t.sense);
  const soundVectors = standardise(
    tracks.map((t) => t.sound),
    34
  );

  const senseSim = new Float32Array(size);
  const senseOk = new Array<boolean>(size).fill(false);
  const soundSim = new Float32Array(size);
  const soundOk = new Array<boolean>(size).fill(false);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const at = i * n + j;
      const mirror = j * n + i;

      const a = senseVectors[i];
      const b = senseVectors[j];
      if (a && b) {
        // OpenAI embeddings arrive unit-normalised, so the dot product is the
        // cosine.
        const value = dot(a, b);
        senseSim[at] = value;
        senseSim[mirror] = value;
        senseOk[at] = true;
        senseOk[mirror] = true;
      }

      const p = soundVectors[i];
      const q = soundVectors[j];
      if (p && q) {
        let distance = 0;
        for (let d = 0; d < p.length; d++) distance += (p[d] - q[d]) ** 2;
        const value = -Math.sqrt(distance);
        soundSim[at] = value;
        soundSim[mirror] = value;
        soundOk[at] = true;
        soundOk[mirror] = true;
      }
    }
  }

  stretch(senseSim, senseOk);
  stretch(soundSim, soundOk);

  const blend = Math.min(1, Math.max(0, shape.likeness));
  const combined = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    if (senseOk[i] && soundOk[i]) {
      combined[i] = blend * senseSim[i] + (1 - blend) * soundSim[i];
    } else if (senseOk[i]) {
      combined[i] = senseSim[i];
    } else if (soundOk[i]) {
      combined[i] = soundSim[i];
    } else {
      combined[i] = NEUTRAL;
    }
  }
  return combined;
}

// ---------------------------------------------------------------------------
// Cost
// ---------------------------------------------------------------------------

function curveTarget(curve: WordCurve, t: number): number {
  switch (curve) {
    case "flat":
      return 0.5;
    case "rise":
      return 0.15 + t * 0.7;
    case "settle":
      return 0.85 - t * 0.7;
    case "arc":
    default:
      return 0.15 + Math.sin(Math.PI * t) * 0.72;
  }
}

type Bench = {
  shape: Shape;
  likeness: Float32Array;
  slot: Map<string, number>;
  n: number;
  weights: {
    flow: number;
    artist: number;
    favorite: number;
    fresh: number;
    words: number;
  };
};

function makeBench(tracks: SeqInternal[], shape: Shape): Bench {
  return {
    shape,
    likeness: buildLikeness(tracks, shape),
    slot: new Map(tracks.map((track, index) => [track.uid, index])),
    n: tracks.length,
    weights: {
      flow: shape.flow * 100,
      artist: shape.spreadArtists * 60,
      favorite: shape.spreadFavorites * 60,
      fresh: shape.leadWithNew * 600,
      words: 22,
    },
  };
}

function likenessOf(bench: Bench, a: SeqInternal, b: SeqInternal): number {
  const i = bench.slot.get(a.uid);
  const j = bench.slot.get(b.uid);
  if (i === undefined || j === undefined) return NEUTRAL;
  return bench.likeness[i * bench.n + j];
}

/** Sum of every penalty anchored at index `i`. */
function costAt(order: SeqInternal[], i: number, bench: Bench): number {
  const track = order[i];
  const n = order.length;
  const w = bench.weights;
  const shape = bench.shape;
  let cost = 0;

  // 1 — neighbours should resemble each other
  const next = order[i + 1];
  if (next) cost += w.flow * (1 - likenessOf(bench, track, next));

  // 2 — the same artist shouldn't stack up
  if (track.artistId) {
    for (let j = i + 1; j <= Math.min(n - 1, i + ARTIST_WINDOW); j++) {
      if (order[j].artistId === track.artistId) {
        cost += (w.artist * (ARTIST_WINDOW + 1 - (j - i))) / ARTIST_WINDOW;
      }
    }
  }

  // 3 — the songs you play should be dealt across the whole run
  if (track.favorite) {
    for (let j = i + 1; j <= Math.min(n - 1, i + FAVORITE_WINDOW); j++) {
      if (order[j].favorite) {
        cost += (w.favorite * (FAVORITE_WINDOW + 1 - (j - i))) / FAVORITE_WINDOW;
      }
    }
  }

  // 4 — what's new to you, or new in the world, earns its keep at the front.
  //
  // Written as a bonus that decays toward the end rather than a penalty that
  // grows toward it. The two are the same objective — they differ by a
  // constant, since every track is placed exactly once — but only this form
  // reads correctly to the greedy builder below, which compares candidates for
  // one position at a time. As a penalty it said "a fresh song costs more
  // here", and greedy dutifully saved every new song for last.
  if (n > 1) cost -= w.fresh * track.fresh * (1 - i / (n - 1));

  // 5 — wordiness should follow the chosen curve
  if (track.words !== null && n > 1) {
    cost += w.words * Math.abs(track.words - curveTarget(shape.wordCurve, i / (n - 1)));
  }

  // 6 — open on something you play; land somewhere long and unhurried
  if (i === 0 && shape.openStrong) cost += 40 * (1 - (track.affinity ?? 0));
  if (i === n - 1 && shape.landSoft) {
    cost += 18 * ((track.durationMs ?? 0) >= 220_000 ? 0 : 1) + 22 * (track.words ?? 0.5);
  }

  return cost;
}

/** Only the terms a change at `p` can touch. */
function windowCost(order: SeqInternal[], p: number, bench: Bench): number {
  const lo = Math.max(0, p - ARTIST_WINDOW);
  const hi = Math.min(order.length - 1, p + ARTIST_WINDOW);
  let sum = 0;
  for (let i = lo; i <= hi; i++) sum += costAt(order, i, bench);
  return sum;
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

export function sequence(tracks: SeqInternal[], shape: Shape): SeqInternal[] {
  // Delisted tracks carry no signal and can't be played; they go to the end
  // rather than distorting every rule with a run of blanks.
  const gone = tracks.filter((track) => track.unavailable);
  const live = tracks.filter((track) => !track.unavailable);

  const n = live.length;
  if (n < 3) return [...live, ...gone];

  const bench = makeBench(live, shape);

  // Greedy seed: start from the best opener, then keep taking whichever song
  // costs least to say next.
  const pool = [...live];
  let openerIndex = 0;
  let best = -Infinity;
  pool.forEach((track, index) => {
    const score =
      (shape.openStrong ? (track.affinity ?? 0) * 2 : 0) +
      shape.leadWithNew * track.fresh * 2.5 +
      (track.lastPlayedAt ? 0.3 : 0);
    if (score > best) {
      best = score;
      openerIndex = index;
    }
  });

  const order: SeqInternal[] = [pool.splice(openerIndex, 1)[0]];
  while (pool.length > 0) {
    let bestIndex = 0;
    let bestCost = Infinity;
    const at = order.length;
    for (let c = 0; c < pool.length; c++) {
      order.push(pool[c]);
      const cost = costAt(order, at, bench) + costAt(order, at - 1, bench);
      order.pop();
      if (cost < bestCost) {
        bestCost = cost;
        bestIndex = c;
      }
    }
    order.push(pool.splice(bestIndex, 1)[0]);
  }

  // Steepest descent on swaps, time-boxed. Runs on the server — the old engine
  // ran its beam search on the browser's main thread on every knob turn.
  const deadline = Date.now() + 450;
  let improved = true;
  while (improved && Date.now() < deadline) {
    improved = false;
    for (let p = 0; p < n && Date.now() < deadline; p++) {
      for (let q = p + 1; q < Math.min(n, p + 14); q++) {
        const before = windowCost(order, p, bench) + windowCost(order, q, bench);
        [order[p], order[q]] = [order[q], order[p]];
        const after = windowCost(order, p, bench) + windowCost(order, q, bench);
        if (after < before - 0.001) improved = true;
        else [order[p], order[q]] = [order[q], order[p]];
      }
    }
  }

  return [...order, ...gone];
}

// ---------------------------------------------------------------------------
// Sections — cut where the run stops resembling itself
// ---------------------------------------------------------------------------

function mode<T>(values: T[]): { value: T; count: number } | null {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  let best: { value: T; count: number } | null = null;
  for (const [value, count] of Array.from(counts.entries())) {
    if (!best || count > best.count) best = { value, count };
  }
  return best;
}

/**
 * Name a run with the strongest thing that is actually true about it, and never
 * the same name twice — two stretches called "the 2020s" tell you nothing about
 * either. Positional names are the last resort.
 */
function describeRun(
  run: SeqInternal[],
  index: number,
  sectionCount: number,
  dominantLanguage: string | null,
  playlistWords: number,
  playlistFresh: number,
  taken: Set<string>
): { label: string; reason: string } {
  const size = run.length;
  const free = (label: string) => !taken.has(label);

  const languages = run.map((t) => t.language).filter(Boolean) as string[];
  const topLanguage = mode(languages);
  if (
    topLanguage &&
    topLanguage.value !== dominantLanguage &&
    topLanguage.count / size >= 0.5 &&
    free(`in ${topLanguage.value}`)
  ) {
    return {
      label: `in ${topLanguage.value}`,
      reason: `${topLanguage.count} of ${size} are ${topLanguage.value} songs`,
    };
  }

  const fresh = run.reduce((sum, t) => sum + t.fresh, 0) / size;
  if (fresh >= playlistFresh + 0.12 && free("the new stuff")) {
    return { label: "the new stuff", reason: "newer than the rest of the playlist" };
  }

  const kin = mode(run.flatMap((t) => t.kin));
  if (kin && kin.count / size >= 0.45 && free(`also in ${kin.value}`)) {
    return {
      label: `also in ${kin.value}`,
      reason: `${kin.count} of ${size} live in ${kin.value} too`,
    };
  }

  const tempos = run.map((t) => t.bpm).filter((v): v is number => Boolean(v));
  if (tempos.length >= size * 0.6) {
    const mean = tempos.reduce((a, b) => a + b, 0) / tempos.length;
    if (mean >= 130 && free("the fast run")) {
      return { label: "the fast run", reason: `around ${Math.round(mean)} bpm` };
    }
    if (mean <= 92 && free("the slow run")) {
      return { label: "the slow run", reason: `around ${Math.round(mean)} bpm` };
    }
  }

  const years = run.map((t) => t.releaseYear).filter(Boolean) as number[];
  if (years.length >= size * 0.6) {
    const lo = Math.min(...years);
    const hi = Math.max(...years);
    const span = lo === hi ? `${lo}` : `${lo}–${hi}`;
    if (hi - lo <= 5 && free(span)) {
      return {
        label: span,
        reason: `${years.length} of ${size} came out between ${lo} and ${hi}`,
      };
    }
    const decades = mode(years.map((year) => Math.floor(year / 10) * 10));
    if (decades && decades.count / years.length >= 0.65 && free(`the ${decades.value}s`)) {
      return {
        label: `the ${decades.value}s`,
        reason: `${decades.count} of ${size} are from the ${decades.value}s`,
      };
    }
  }

  const quiet = run.filter((t) => t.quiet).length;
  if (quiet / size >= 0.55 && free("barely any words")) {
    return { label: "barely any words", reason: `${quiet} of ${size} are near-wordless` };
  }

  const known = run.map((t) => t.words).filter((v): v is number => v !== null);
  if (known.length >= Math.max(3, size * 0.5)) {
    const mean = known.reduce((a, b) => a + b, 0) / known.length;
    if (mean >= playlistWords + 0.14 && free("the wordy run")) {
      return { label: "the wordy run", reason: "more words a minute than the rest" };
    }
    if (mean <= playlistWords - 0.14 && free("room to breathe")) {
      return { label: "room to breathe", reason: "less said per minute than the rest" };
    }
  }

  const favorites = run.filter((t) => t.favorite).length;
  if (favorites >= 2 && favorites / size >= 0.4 && free("the ones you play")) {
    return { label: "the ones you play", reason: `${favorites} of ${size} are on repeat` };
  }

  const artist = mode(run.map((t) => t.artist));
  if (
    artist &&
    artist.count >= 2 &&
    artist.count / size >= 0.34 &&
    free(`the ${artist.value} stretch`)
  ) {
    return {
      label: `the ${artist.value} stretch`,
      reason: `${artist.count} of ${size} are ${artist.value}`,
    };
  }

  if (index === 0 && free("the way in")) {
    return { label: "the way in", reason: `the first ${size}` };
  }
  if (index === sectionCount - 1 && free("the last word")) {
    return { label: "the last word", reason: `the final ${size}` };
  }
  return { label: `stretch ${index + 1}`, reason: `${size} songs` };
}

export function buildSections(order: SeqInternal[], shape: Shape): Section[] {
  const gone = order.filter((track) => track.unavailable);
  const live = order.filter((track) => !track.unavailable);
  const tail: Section[] = gone.length
    ? [
        {
          id: "gone",
          label: "gone from spotify",
          reason: `${gone.length} delisted — nothing plays them`,
          uids: gone.map((track) => track.uid),
        },
      ]
    : [];

  const n = live.length;
  if (n < 6) {
    return [
      {
        id: "all",
        label: "the whole thing",
        reason: `${n} song${n === 1 ? "" : "s"}, too few to split`,
        uids: live.map((t) => t.uid),
      },
      ...tail,
    ];
  }

  // Cut where consecutive songs stop resembling each other — the same measure
  // the ordering optimised, read back as structure.
  const bench = makeBench(live, shape);
  const seams: Array<{ index: number; strength: number }> = [];
  for (let i = 1; i < n; i++) {
    seams.push({ index: i, strength: 1 - likenessOf(bench, live[i - 1], live[i]) });
  }

  const target = Math.max(2, Math.min(7, Math.round(n / 14)));
  const minRun = Math.max(3, Math.floor(n / (target * 2)));
  const cuts: number[] = [];
  const canCut = (index: number) =>
    index >= minRun &&
    n - index >= minRun &&
    !cuts.some((cut) => Math.abs(cut - index) < minRun);

  const ranked = [...seams].sort((a, b) => b.strength - a.strength);
  for (const seam of ranked) {
    if (cuts.length >= target - 1) break;
    if (!canCut(seam.index)) continue;
    cuts.push(seam.index);
  }

  // No stretch should swallow the playlist just because nothing changed sharply
  // enough inside it.
  const maxRun = Math.max(minRun * 2, Math.ceil((n / target) * 1.5));
  for (let guard = 0; guard < target; guard++) {
    const bounds = [0, ...[...cuts].sort((a, b) => a - b), n];
    let widest = { size: 0, lo: 0, hi: 0 };
    for (let i = 0; i < bounds.length - 1; i++) {
      const size = bounds[i + 1] - bounds[i];
      if (size > widest.size) widest = { size, lo: bounds[i], hi: bounds[i + 1] };
    }
    if (widest.size <= maxRun) break;
    const inside = ranked.find(
      (seam) => seam.index > widest.lo && seam.index < widest.hi && canCut(seam.index)
    );
    const midpoint = Math.round((widest.lo + widest.hi) / 2);
    const cut = inside?.index ?? (canCut(midpoint) ? midpoint : null);
    if (cut === null) break;
    cuts.push(cut);
  }
  cuts.sort((a, b) => a - b);

  const bounds = [0, ...cuts, n];
  const dominant = mode(live.map((t) => t.language).filter(Boolean) as string[]);
  const knownWords = live.map((t) => t.words).filter((v): v is number => v !== null);
  const playlistWords = knownWords.length
    ? knownWords.reduce((a, b) => a + b, 0) / knownWords.length
    : 0.5;
  const playlistFresh = live.reduce((sum, t) => sum + t.fresh, 0) / n;
  const taken = new Set<string>();

  return [
    ...bounds.slice(0, -1).map((start, index) => {
      const run = live.slice(start, bounds[index + 1]);
      const { label, reason } = describeRun(
        run,
        index,
        bounds.length - 1,
        dominant?.value ?? null,
        playlistWords,
        playlistFresh,
        taken
      );
      taken.add(label);
      return { id: `s${start}`, label, reason, uids: run.map((t) => t.uid) };
    }),
    ...tail,
  ];
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * How many songs `applySetlist` would actually have to move — simulated against
 * the same selection sort it runs, so the number the UI shows is the number of
 * requests it will make.
 */
export function movesNeeded(liveOrder: string[], target: string[]): number {
  const working = [...liveOrder];
  const wanted = target.filter((uid) => working.includes(uid));
  let moves = 0;

  for (let targetIndex = 0; targetIndex < wanted.length; targetIndex++) {
    const uid = wanted[targetIndex];
    const currentIndex = working.indexOf(uid);
    if (currentIndex === targetIndex) continue;
    working.splice(currentIndex, 1);
    working.splice(targetIndex, 0, uid);
    moves++;
  }

  return moves;
}

export function score(full: SeqInternal[], liveOrder: string[], shape: Shape): Scorecard {
  const gone = full.filter((track) => track.unavailable).length;
  // The rules only speak about songs that exist; the move count is about the
  // whole playlist, delisted slots included.
  const order = full.filter((track) => !track.unavailable);
  const n = order.length;

  let artistClumps = 0;
  let languageSwitches = 0;
  let cushionedSwitches = 0;

  for (let i = 1; i < n; i++) {
    const a = order[i - 1];
    const b = order[i];
    if (a.artistId && a.artistId === b.artistId) artistClumps++;
    if (a.language && b.language && a.language !== b.language) {
      languageSwitches++;
      if (a.quiet || b.quiet) cushionedSwitches++;
    }
  }

  // "How often does a song hand over to one of its closest relatives?" — the
  // share of handovers where the next song is in that song's nearest quarter of
  // the playlist. A shuffle scores about 25; a mean similarity would be a
  // number with no scale a person could read.
  let flow = 0;
  if (n >= 3) {
    const bench = makeBench(order, shape);
    const slots = order.map((track) => bench.slot.get(track.uid) ?? 0);
    let close = 0;
    for (let i = 1; i < n; i++) {
      const from = slots[i - 1];
      const here = bench.likeness[from * bench.n + slots[i]];
      let better = 0;
      for (let j = 0; j < n; j++) {
        if (j === i - 1) continue;
        if (bench.likeness[from * bench.n + slots[j]] > here) better++;
      }
      if (better < (n - 1) / 4) close++;
    }
    flow = Math.round((close / (n - 1)) * 100);
  }

  // Where the newest quarter lands, as a percentage of the way through. 50 is
  // "scattered evenly"; lower is front-loaded. Ranked on raw freshness, not the
  // within-playlist rank, so ties at the old end can't drift into the sample.
  let newUpFront = 50;
  if (n >= 8) {
    const freshest = order
      .map((track, index) => ({ index, freshness: track.freshness }))
      .sort((a, b) => b.freshness - a.freshness)
      .slice(0, Math.max(2, Math.round(n / 4)));
    const positions = freshest.map((item) => item.index).sort((a, b) => a - b);
    const median = positions[Math.floor(positions.length / 2)];
    newUpFront = Math.round((median / (n - 1)) * 100);
  }

  const favoritePositions = order
    .map((track, index) => (track.favorite ? index : -1))
    .filter((index) => index >= 0);
  let favoriteSpread: number | null = null;
  if (favoritePositions.length >= 3) {
    const gaps: number[] = [];
    for (let i = 1; i < favoritePositions.length; i++) {
      gaps.push(favoritePositions[i] - favoritePositions[i - 1]);
    }
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const variance = gaps.reduce((sum, gap) => sum + (gap - mean) ** 2, 0) / gaps.length;
    favoriteSpread = Math.round(
      100 * Math.max(0, 1 - Math.sqrt(variance) / Math.max(mean, 1))
    );
  }

  const withWords = order.filter((track) => track.words !== null);
  let wordFit = 100;
  if (withWords.length >= 4 && n > 1) {
    const error =
      order.reduce((sum, track, index) => {
        if (track.words === null) return sum;
        return sum + Math.abs(track.words - curveTarget(shape.wordCurve, index / (n - 1)));
      }, 0) / withWords.length;
    wordFit = Math.round(100 * Math.max(0, 1 - error / 0.5));
  }

  return {
    flow,
    newUpFront,
    artistClumps,
    languageSwitches,
    cushionedSwitches,
    favoriteSpread,
    wordFit,
    moves: movesNeeded(
      liveOrder,
      full.map((track) => track.uid)
    ),
    unknownWords: order.filter((track) => track.words === null).length,
    gone,
    heard: order.filter((track) => track.heard).length,
    read: order.filter((track) => track.read).length,
  };
}

function buildNotes(full: SeqInternal[], sections: Section[], card: Scorecard): string[] {
  const notes: string[] = [];
  const order = full.filter((track) => !track.unavailable);
  const opener = order[0];
  const closer = order[order.length - 1];

  if (opener) {
    notes.push(
      opener.fresh >= 0.6
        ? `Opens on ${opener.title}, one of the newer ones.`
        : (opener.affinity ?? 0) >= FAVORITE_CUTOFF
          ? `Opens on ${opener.title}, one you actually play.`
          : `Opens on ${opener.title}.`
    );
  }
  if (closer) notes.push(`Lands on ${closer.title}.`);

  notes.push(
    card.newUpFront <= 42
      ? `The newest quarter sits ${card.newUpFront}% of the way in — front-loaded.`
      : card.newUpFront >= 58
        ? `The newest quarter sits ${card.newUpFront}% of the way in, toward the back. Turn "lead with the new" up.`
        : "The newest quarter sits around the middle."
  );

  notes.push(
    card.artistClumps > 0
      ? `${card.artistClumps} place${card.artistClumps === 1 ? "" : "s"} still put the same artist back to back.`
      : "No artist repeats back to back."
  );

  if (card.languageSwitches > 0) {
    notes.push(
      `${card.languageSwitches} language change${card.languageSwitches === 1 ? "" : "s"}, ${card.cushionedSwitches} of them landing somewhere quiet.`
    );
  }

  const unheard = order.length - card.heard;
  const unread = order.length - card.read;
  if (unheard > 0 || unread > 0) {
    const parts: string[] = [];
    if (unheard > 0) parts.push(`${unheard} never got listened to`);
    if (unread > 0) parts.push(`${unread} ${unread === 1 ? "has" : "have"} no lyric embedding`);
    notes.push(`${parts.join(", ")} — likeness is guessing for those.`);
  }

  if (card.gone > 0) {
    notes.push(
      `${card.gone} song${card.gone === 1 ? " has" : "s have"} been delisted by Spotify and sit${card.gone === 1 ? "s" : ""} at the end — sort the "gone" pile to clear ${card.gone === 1 ? "it" : "them"}.`
    );
  }

  if (sections.length > 1) {
    notes.push(
      `Falls into ${sections.length} stretches: ${sections.map((s) => s.label).join(", ")}.`
    );
  }

  notes.push(
    card.moves === 0
      ? "Spotify already looks like this."
      : `Applying moves ${card.moves} song${card.moves === 1 ? "" : "s"}.`
  );

  return notes;
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

function strip(track: SeqInternal): SeqTrack {
  const {
    words: _words,
    fresh: _fresh,
    favorite: _favorite,
    quiet: _quiet,
    sense: _sense,
    sound: _sound,
    ...rest
  } = track;
  return rest;
}

export async function getSetlist(
  playlistId: string,
  options?: { shape?: Shape; order?: string[]; resequence?: boolean }
): Promise<Setlist> {
  const supabase = createAdminClient();
  const { meta, tracks, liveOrder } = await loadTracks(playlistId);

  const { data: saved } = await supabase
    .from("music_sequences")
    .select("shape, order_uids, updated_at, applied_at")
    .eq("playlist_id", playlistId)
    .maybeSingle();

  const shape: Shape = {
    ...DEFAULT_SHAPE,
    ...((saved?.shape as Partial<Shape>) || {}),
    ...(options?.shape || {}),
  };

  const byUid = new Map(tracks.map((track) => [track.uid, track]));
  let ordered: SeqInternal[];

  if (options?.order?.length) {
    const wanted = new Set(options.order);
    ordered = options.order
      .map((uid) => byUid.get(uid))
      .filter((track): track is SeqInternal => Boolean(track));
    for (const track of tracks) if (!wanted.has(track.uid)) ordered.push(track);
  } else if (!options?.resequence && saved?.order_uids?.length) {
    const savedOrder = saved.order_uids as string[];
    ordered = savedOrder
      .map((uid) => byUid.get(uid))
      .filter((track): track is SeqInternal => Boolean(track));
    const present = new Set(ordered.map((track) => track.uid));
    // Songs added since the last save land at the end rather than silently
    // wiping the saved order, which is what the old engine did.
    for (const track of tracks) if (!present.has(track.uid)) ordered.push(track);
  } else {
    ordered = sequence(tracks, shape);
  }

  const sections = buildSections(ordered, shape);
  const card = score(ordered, liveOrder, shape);

  return {
    playlist: {
      id: playlistId,
      name: meta.name,
      imageUrl: meta.images?.[0]?.url || null,
      url: meta.external_urls?.spotify || null,
      trackCount: tracks.length,
    },
    tracks: tracks.map(strip),
    liveOrder,
    order: ordered.map((track) => track.uid),
    sections,
    shape,
    scorecard: card,
    notes: buildNotes(ordered, sections, card),
    savedAt: (saved?.updated_at as string) || null,
    appliedAt: (saved?.applied_at as string) || null,
    lyricsPending: tracks.filter((track) => track.wordsPerMin === null).length,
  };
}

export async function saveSetlist(
  playlistId: string,
  shape: Shape,
  order: string[],
  sections: Section[]
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("music_sequences").upsert(
    {
      playlist_id: playlistId,
      shape,
      order_uids: order,
      sections,
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "playlist_id" }
  );
  if (error) throw new Error(`could not save the order: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

/**
 * Write the order back to Spotify.
 *
 * Two strategies, chosen by cost. Reordering keeps every item's `added_at` but
 * needs one sequential request per displaced song; rewriting the playlist costs
 * a handful of requests regardless of size but resets when things were added.
 * The caller picks; the UI shows the count first.
 */
export async function applySetlist(
  playlistId: string,
  order: string[],
  strategy: "reorder" | "rewrite"
): Promise<{ moved: number; strategy: string }> {
  const supabase = createAdminClient();
  const items = await fetchPlaylistTracks(playlistId);
  const live = items
    .map((item) => item.track)
    .filter((track): track is NonNullable<typeof track> => Boolean(track?.id));
  const liveIds = live.map((track) => track.id!);
  const liveUids = occurrenceUids(liveIds);
  const uriByUid = new Map(liveUids.map((uid, index) => [uid, live[index].uri!]));

  const target = order.filter((uid) => uriByUid.has(uid));
  for (const uid of liveUids) if (!target.includes(uid)) target.push(uid);

  let moved = 0;

  if (strategy === "rewrite") {
    const uris = target.map((uid) => uriByUid.get(uid)!);
    const batches = chunk(uris, 100);
    await api(`/playlists/${playlistId}/tracks`, {
      method: "PUT",
      body: JSON.stringify({ uris: batches[0] || [] }),
    });
    for (const batch of batches.slice(1)) {
      await api(`/playlists/${playlistId}/tracks`, {
        method: "POST",
        body: JSON.stringify({ uris: batch }),
      });
    }
    moved = uris.length;
  } else {
    let snapshot = (await fetchPlaylistMeta(playlistId)).snapshot_id || null;
    const working = [...liveUids];

    for (let targetIndex = 0; targetIndex < target.length; targetIndex++) {
      const uid = target[targetIndex];
      const currentIndex = working.indexOf(uid);
      if (currentIndex === targetIndex || currentIndex === -1) continue;

      const response = await api<{ snapshot_id: string }>(
        `/playlists/${playlistId}/tracks`,
        {
          method: "PUT",
          body: JSON.stringify({
            range_start: currentIndex,
            insert_before: targetIndex,
            range_length: 1,
            ...(snapshot ? { snapshot_id: snapshot } : {}),
          }),
        }
      );
      snapshot = response?.snapshot_id || snapshot;
      working.splice(currentIndex, 1);
      working.splice(targetIndex, 0, uid);
      moved++;
    }
  }

  await supabase.from("music_sequences").upsert(
    {
      playlist_id: playlistId,
      order_uids: target,
      applied_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "playlist_id" }
  );

  // One membership row per track — a playlist that holds the same song twice
  // still only belongs to it once.
  const seen = new Set<string>();
  const rows = target
    .map((uid, index) => ({ trackId: uid.split("#")[0], index }))
    .filter(({ trackId }) => !seen.has(trackId) && seen.add(trackId))
    .map(({ trackId, index }) => ({
      playlist_id: playlistId,
      track_id: trackId,
      position: index,
    }));

  await supabase.from("music_playlist_tracks").delete().eq("playlist_id", playlistId);
  if (rows.length > 0) {
    await supabase.from("music_playlist_tracks").insert(rows);
  }

  return { moved, strategy };
}
