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
 * The previous engine optimised an invented feature space — "energy",
 * "valence", "texture" inferred by regexing song titles and (empty) artist
 * genre strings. Every pair of songs came out 98/100 compatible, so the output
 * was input order plus noise wearing a confidence score.
 *
 * This one only uses things that are true and checkable by eye:
 *   artist · language · words-per-minute · release year · how much you play it
 * Each rule below is one sentence long and you can verify it by reading the
 * list. Nothing here claims to know how a song sounds.
 */

const ARTIST_WINDOW = 6;
const FAVORITE_WINDOW = 5;
const ERA_SPAN = 6;
const FAVORITE_CUTOFF = 0.45;
const QUIET_WPM = 45;

export type SeqInternal = SeqTrack & {
  /** 0..1, wordiness normalised across this playlist */
  words: number | null;
  favorite: boolean;
  quiet: boolean;
};

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

  const [{ data: rows }, { data: lyricRows }, { data: membershipRows }, { data: playlistRows }] =
    await Promise.all([
      supabase
        .from("music_tracks")
        .select(
          "track_id, title, artist_display, artist_ids, album_image_url, song_url, duration_ms, release_year, affinity, last_played_at"
        )
        .in("track_id", uniqueIds),
      supabase
        .from("music_track_lyrics")
        .select("track_id, status, language, words_per_min")
        .in("track_id", uniqueIds),
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
  const lyricById = new Map(
    (lyricRows || []).map((row) => [row.track_id as string, row])
  );
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
    const instrumental = lyric?.status === "instrumental";
    const wpm = (lyric?.words_per_min as number | null) ?? (instrumental ? 0 : null);

    return {
      uid: uids[index],
      trackId: track.id!,
      title: (row?.title as string) || track.name,
      artist: (row?.artist_display as string) || track.artists.map((a) => a.name).join(", "),
      artistId: (row?.artist_ids as string[] | null)?.[0] || track.artists[0]?.id || null,
      art: (row?.album_image_url as string) || track.album?.images?.[0]?.url || null,
      songUrl: (row?.song_url as string) || track.external_urls?.spotify || null,
      durationMs: (row?.duration_ms as number) ?? track.duration_ms,
      releaseYear: (row?.release_year as number) ?? null,
      affinity: (row?.affinity as number) ?? null,
      lastPlayedAt: (row?.last_played_at as string) ?? null,
      language: (lyric?.language as string) ?? null,
      wordsPerMin: wpm,
      instrumental,
      kin: kinById.get(track.id!) || [],
      words: null,
      favorite: ((row?.affinity as number) ?? 0) >= FAVORITE_CUTOFF,
      quiet: instrumental || (wpm !== null && wpm < QUIET_WPM),
    };
  });

  // Normalise wordiness within this playlist — "wordy for this playlist" is the
  // only comparison that means anything.
  const known = tracks.map((t) => t.wordsPerMin).filter((v): v is number => v !== null);
  if (known.length >= 3) {
    const lo = Math.min(...known);
    const hi = Math.max(...known);
    const span = hi - lo || 1;
    for (const track of tracks) {
      track.words = track.wordsPerMin === null ? null : (track.wordsPerMin - lo) / span;
    }
  }

  return { meta, tracks, liveOrder: uids };
}

// ---------------------------------------------------------------------------
// Cost — every term is one legible rule
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

type Weights = {
  artist: number;
  language: number;
  favorite: number;
  era: number;
  words: number;
};

function weightsFor(shape: Shape): Weights {
  return {
    artist: shape.spreadArtists * 60,
    language: shape.groupLanguage * 26,
    favorite: shape.spreadFavorites * 32,
    era: shape.keepEras * 14,
    words: 22,
  };
}

/** Sum of every penalty anchored at index `i`. */
function costAt(order: SeqInternal[], i: number, shape: Shape, w: Weights): number {
  const track = order[i];
  const n = order.length;
  let cost = 0;

  // 1 — the same artist shouldn't stack up
  if (track.artistId) {
    for (let j = i + 1; j <= Math.min(n - 1, i + ARTIST_WINDOW); j++) {
      if (order[j].artistId === track.artistId) {
        const gap = j - i;
        cost += (w.artist * (ARTIST_WINDOW + 1 - gap)) / ARTIST_WINDOW;
      }
    }
  }

  // 2 — the songs you actually play should be dealt across the whole run
  if (track.favorite) {
    for (let j = i + 1; j <= Math.min(n - 1, i + FAVORITE_WINDOW); j++) {
      if (order[j].favorite) {
        cost += (w.favorite * (FAVORITE_WINDOW + 1 - (j - i))) / FAVORITE_WINDOW;
      }
    }
  }

  const next = order[i + 1];
  if (next) {
    // 3 — language switches cost, unless the seam lands somewhere quiet
    if (track.language && next.language && track.language !== next.language) {
      cost += w.language * (track.quiet || next.quiet ? 0.25 : 1);
    }

    // 4 — keep years near each other
    if (track.releaseYear && next.releaseYear) {
      const drift = Math.abs(track.releaseYear - next.releaseYear);
      if (drift > ERA_SPAN) cost += (w.era * Math.min(drift - ERA_SPAN, 20)) / 20;
    }
  }

  // 5 — wordiness should follow the chosen curve
  if (track.words !== null && n > 1) {
    const target = curveTarget(shape.wordCurve, i / (n - 1));
    cost += w.words * Math.abs(track.words - target);
  }

  // 6 — open on something you play; land on something long and unhurried
  if (i === 0 && shape.openStrong) {
    cost += 40 * (1 - (track.affinity ?? 0));
  }
  if (i === n - 1 && shape.landSoft) {
    const longEnough = (track.durationMs ?? 0) >= 220_000 ? 0 : 1;
    cost += 18 * longEnough + 22 * (track.words ?? 0.5);
  }

  return cost;
}

function totalCost(order: SeqInternal[], shape: Shape, w: Weights): number {
  let sum = 0;
  for (let i = 0; i < order.length; i++) sum += costAt(order, i, shape, w);
  return sum;
}

/** Only the terms a change at `p` can touch. */
function windowCost(
  order: SeqInternal[],
  p: number,
  shape: Shape,
  w: Weights
): number {
  const lo = Math.max(0, p - ARTIST_WINDOW);
  const hi = Math.min(order.length - 1, p + ARTIST_WINDOW);
  let sum = 0;
  for (let i = lo; i <= hi; i++) sum += costAt(order, i, shape, w);
  return sum;
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

export function sequence(tracks: SeqInternal[], shape: Shape): SeqInternal[] {
  const n = tracks.length;
  if (n < 3) return [...tracks];

  const w = weightsFor(shape);

  // Greedy seed: start from the best opener, then keep picking whichever song
  // costs least to say next.
  const pool = [...tracks];
  let openerIndex = 0;
  if (shape.openStrong) {
    let best = -Infinity;
    pool.forEach((track, index) => {
      const score =
        (track.affinity ?? 0) * 2 +
        (track.lastPlayedAt ? 0.4 : 0) -
        (track.words ?? 0.5) * 0.3;
      if (score > best) {
        best = score;
        openerIndex = index;
      }
    });
  }

  const order: SeqInternal[] = [pool.splice(openerIndex, 1)[0]];
  while (pool.length > 0) {
    let bestIndex = 0;
    let bestCost = Infinity;
    const at = order.length;
    for (let c = 0; c < pool.length; c++) {
      order.push(pool[c]);
      const cost =
        costAt(order, at, shape, w) +
        (at > 0 ? costAt(order, at - 1, shape, w) : 0);
      order.pop();
      if (cost < bestCost) {
        bestCost = cost;
        bestIndex = c;
      }
    }
    order.push(pool.splice(bestIndex, 1)[0]);
  }

  // Steepest descent on swaps and single moves, time-boxed. Runs on the server,
  // never on the browser's main thread — the old engine froze the tab for
  // half a second on every knob turn.
  const deadline = Date.now() + 400;
  let improved = true;
  while (improved && Date.now() < deadline) {
    improved = false;
    for (let p = 0; p < n && Date.now() < deadline; p++) {
      for (let q = p + 1; q < Math.min(n, p + 14); q++) {
        const before = windowCost(order, p, shape, w) + windowCost(order, q, shape, w);
        [order[p], order[q]] = [order[q], order[p]];
        const after = windowCost(order, p, shape, w) + windowCost(order, q, shape, w);
        if (after < before - 0.001) {
          improved = true;
        } else {
          [order[p], order[q]] = [order[q], order[p]];
        }
      }
    }
  }

  return order;
}

// ---------------------------------------------------------------------------
// Sections — contiguous runs, named with something true about them
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

function describeRun(
  run: SeqInternal[],
  index: number,
  sectionCount: number,
  dominantLanguage: string | null
): { label: string; reason: string } {
  const size = run.length;

  const languages = run.map((t) => t.language).filter(Boolean) as string[];
  const topLanguage = mode(languages);
  if (
    topLanguage &&
    topLanguage.value !== dominantLanguage &&
    topLanguage.count / size >= 0.55
  ) {
    return {
      label: `in ${topLanguage.value}`,
      reason: `${topLanguage.count} of ${size} are ${topLanguage.value} songs`,
    };
  }

  const kin = mode(run.flatMap((t) => t.kin));
  if (kin && kin.count / size >= 0.5) {
    return {
      label: `also in ${kin.value}`,
      reason: `${kin.count} of ${size} live in ${kin.value} too`,
    };
  }

  const years = run.map((t) => t.releaseYear).filter(Boolean) as number[];
  if (years.length >= size * 0.7) {
    const lo = Math.min(...years);
    const hi = Math.max(...years);
    if (hi - lo <= 5) {
      return {
        label: lo === hi ? `${lo}` : `${lo}–${hi}`,
        reason: `${years.length} of ${size} came out between ${lo} and ${hi}`,
      };
    }
  }

  const quiet = run.filter((t) => t.quiet).length;
  if (quiet / size >= 0.6) {
    return { label: "barely any words", reason: `${quiet} of ${size} are near-wordless` };
  }

  const favorites = run.filter((t) => t.favorite).length;
  if (favorites / size >= 0.5) {
    return { label: "the ones you play", reason: `${favorites} of ${size} are on repeat` };
  }

  const artist = mode(run.map((t) => t.artist));
  if (artist && artist.count / size >= 0.4) {
    return { label: `the ${artist.value} stretch`, reason: `${artist.count} of ${size} are ${artist.value}` };
  }

  if (index === 0) return { label: "the way in", reason: `the first ${size}` };
  if (index === sectionCount - 1) return { label: "the last word", reason: `the final ${size}` };
  return { label: "the middle", reason: `${size} songs` };
}

export function buildSections(order: SeqInternal[]): Section[] {
  const n = order.length;
  if (n < 6) {
    return [{ id: "all", label: "the whole thing", reason: `${n} songs`, uids: order.map((t) => t.uid) }];
  }

  // Cut where the run genuinely changes character, not on a fixed grid.
  const seams: Array<{ index: number; strength: number }> = [];
  for (let i = 1; i < n; i++) {
    const a = order[i - 1];
    const b = order[i];
    let strength = 0;
    if (a.language && b.language && a.language !== b.language) strength += 3;
    if (a.releaseYear && b.releaseYear) {
      strength += Math.min(Math.abs(a.releaseYear - b.releaseYear) / 8, 2);
    }
    const kinA = new Set(a.kin);
    const shared = b.kin.filter((name) => kinA.has(name)).length;
    if (a.kin.length + b.kin.length > 0 && shared === 0) strength += 1;
    if (a.quiet !== b.quiet) strength += 0.8;
    seams.push({ index: i, strength });
  }

  const target = Math.max(2, Math.min(7, Math.round(n / 14)));
  const minRun = Math.max(3, Math.floor(n / (target * 2)));
  const cuts: number[] = [];
  for (const seam of [...seams].sort((a, b) => b.strength - a.strength)) {
    if (cuts.length >= target - 1) break;
    if (seam.strength < 0.8) break;
    if (seam.index < minRun || n - seam.index < minRun) continue;
    if (cuts.some((cut) => Math.abs(cut - seam.index) < minRun)) continue;
    cuts.push(seam.index);
  }
  cuts.sort((a, b) => a - b);

  const bounds = [0, ...cuts, n];
  const dominant = mode(order.map((t) => t.language).filter(Boolean) as string[]);

  return bounds.slice(0, -1).map((start, index) => {
    const run = order.slice(start, bounds[index + 1]);
    const { label, reason } = describeRun(
      run,
      index,
      bounds.length - 1,
      dominant?.value ?? null
    );
    return { id: `s${start}`, label, reason, uids: run.map((t) => t.uid) };
  });
}

// ---------------------------------------------------------------------------
// Scoring — only things you can count
// ---------------------------------------------------------------------------

/**
 * How many songs `applySetlist` would actually have to move — simulated
 * against the same selection-sort it runs, so the number the UI shows is the
 * number of requests it will make.
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

export function score(order: SeqInternal[], liveOrder: string[], shape: Shape): Scorecard {
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

  const favoritePositions = order
    .map((track, index) => (track.favorite ? index : -1))
    .filter((index) => index >= 0);
  let favoriteSpread = 100;
  if (favoritePositions.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < favoritePositions.length; i++) {
      gaps.push(favoritePositions[i] - favoritePositions[i - 1]);
    }
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const variance =
      gaps.reduce((sum, gap) => sum + (gap - mean) ** 2, 0) / gaps.length;
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
    artistClumps,
    languageSwitches,
    cushionedSwitches,
    favoriteSpread,
    wordFit,
    moves: movesNeeded(liveOrder, order.map((track) => track.uid)),
    unknownWords: order.filter((track) => track.words === null).length,
  };
}

function buildNotes(
  order: SeqInternal[],
  sections: Section[],
  card: Scorecard
): string[] {
  const notes: string[] = [];
  const opener = order[0];
  const closer = order[order.length - 1];

  if (opener) {
    notes.push(
      opener.affinity && opener.affinity >= FAVORITE_CUTOFF
        ? `Opens on ${opener.title}, one you actually play.`
        : `Opens on ${opener.title}.`
    );
  }
  if (closer) notes.push(`Lands on ${closer.title}.`);

  if (card.artistClumps > 0) {
    notes.push(
      `${card.artistClumps} place${card.artistClumps === 1 ? "" : "s"} still put the same artist back to back.`
    );
  } else {
    notes.push("No artist repeats back to back.");
  }

  if (card.languageSwitches > 0) {
    notes.push(
      `${card.languageSwitches} language change${card.languageSwitches === 1 ? "" : "s"}, ${card.cushionedSwitches} of them landing somewhere quiet.`
    );
  }

  if (card.unknownWords > 0) {
    notes.push(
      `${card.unknownWords} song${card.unknownWords === 1 ? " has" : "s have"} no lyrics on file, so the word rules can't see ${card.unknownWords === 1 ? "it" : "them"}.`
    );
  }

  if (sections.length > 1) {
    notes.push(`Falls into ${sections.length} stretches: ${sections.map((s) => s.label).join(", ")}.`);
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
  const { words: _words, favorite: _favorite, quiet: _quiet, ...rest } = track;
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
    ordered = options.order
      .map((uid) => byUid.get(uid))
      .filter((track): track is SeqInternal => Boolean(track));
    for (const track of tracks) {
      if (!options.order.includes(track.uid)) ordered.push(track);
    }
  } else if (!options?.resequence && saved?.order_uids?.length) {
    const savedOrder = saved.order_uids as string[];
    ordered = savedOrder
      .map((uid) => byUid.get(uid))
      .filter((track): track is SeqInternal => Boolean(track));
    const present = new Set(ordered.map((track) => track.uid));
    // Songs added to the playlist since the last save land at the end rather
    // than silently wiping the saved order, which is what the old engine did.
    for (const track of tracks) if (!present.has(track.uid)) ordered.push(track);
  } else {
    ordered = sequence(tracks, shape);
  }

  const sections = buildSections(ordered);
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

  await supabase
    .from("music_sequences")
    .upsert(
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
