import "server-only";

import { createAdminClient } from "@/utils/supabase/admin";
import { mapLimit } from "./spotify-api";

/**
 * Lyric-derived track features, cached from LRCLIB.
 *
 * Spotify's /audio-features, /audio-analysis, /recommendations and
 * /related-artists all answer 403/404 for apps registered after late 2024, and
 * /artists now returns an empty `genres` array even for the biggest artists on
 * the platform. The previous sequencer guessed "energy" and "emotional tone"
 * from regexes over song titles, which is why every pair of songs in a playlist
 * scored 98/100 compatible.
 *
 * Synced lyrics are the one real measurement still available, and they answer
 * questions that actually matter for sequencing:
 *   · what language is this in                (script of the lyrics, not the title)
 *   · how many words per minute               (real density, from the timestamps)
 *   · is it instrumental                      (stated outright)
 *   · how long before the voice comes in      (first timestamp)
 * Coverage on this library measures ~82%.
 */

const ENDPOINT = "https://lrclib.net/api/get";
const UA = "pramit.gg music manager (https://www.pramit.gg)";

type LrcResponse = {
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
};

// Script ranges, with the language most likely to be behind each in this
// library. These are script detections, not linguistic ones — which is fine,
// because a listener hears the script change too.
const SCRIPTS: Array<[RegExp, string]> = [
  [/[\uac00-\ud7af\u1100-\u11ff]/g, "Korean"],
  [/[\u3040-\u30ff]/g, "Japanese"],
  [/[\u4e00-\u9fff]/g, "Chinese"],
  [/[\u0900-\u097f]/g, "Hindi"],
  [/[\u0980-\u09ff]/g, "Bengali"],
  [/[\u0600-\u06ff]/g, "Arabic"],
  [/[\u0e00-\u0e7f]/g, "Thai"],
  [/[\u0400-\u04ff]/g, "Russian"],
];

// Enough to separate the romance languages from English without a dependency.
const WORD_MARKERS: Array<[RegExp, string]> = [
  [/\b(que|para|como|porque|siempre|nunca|coraz\u00f3n|amor|noche)\b/i, "Spanish"],
  [/\b(voc\u00ea|n\u00e3o|cora\u00e7\u00e3o|saudade|ent\u00e3o|tamb\u00e9m)\b/i, "Portuguese"],
  [/\b(je|tu|nous|c'est|pour|avec|toujours|jamais)\b/i, "French"],
  [/\b(ich|nicht|und|das|mit|immer|dich)\b/i, "German"],
];

/**
 * A stray kanji in an English rap verse shouldn't make the song Chinese, so a
 * script has to carry a real share of the letters before it counts. Japanese
 * wins over Chinese when kana are present, since Japanese lyrics carry kanji
 * too.
 */
function detectLanguage(text: string): string {
  const letters = (text.match(/[^\s\d.,!?"'()\[\]{}\-—–:;/\\|*&%$#@+=~`^<>]/g) || [])
    .length;
  if (letters === 0) return "English";

  let best: { name: string; share: number } | null = null;
  for (const [pattern, name] of SCRIPTS) {
    const share = (text.match(pattern) || []).length / letters;
    if (share >= 0.1 && (!best || share > best.share)) best = { name, share };
    // kana settle the han ambiguity outright
    if (name === "Japanese" && share >= 0.03) return "Japanese";
  }
  if (best) return best.name;

  const marked = WORD_MARKERS.find(([pattern]) => pattern.test(text));
  return marked ? marked[1] : "English";
}

function parseTimestamps(synced: string): number[] {
  const stamps: number[] = [];
  for (const line of synced.split("\n")) {
    const match = /^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/.exec(line.trim());
    if (!match) continue;
    if (!match[3].trim()) continue;
    stamps.push((Number(match[1]) * 60 + Number(match[2])) * 1000);
  }
  return stamps;
}

export type LyricFeature = {
  track_id: string;
  status: "ok" | "instrumental" | "missing";
  language: string | null;
  word_count: number | null;
  line_count: number | null;
  vocal_start_ms: number | null;
  vocal_end_ms: number | null;
  words_per_min: number | null;
  fetched_at: string;
};

async function lookup(track: {
  track_id: string;
  title: string;
  artist_names: string[];
  artist_display: string;
  album_name: string | null;
  duration_ms: number | null;
}): Promise<LyricFeature> {
  const base: LyricFeature = {
    track_id: track.track_id,
    status: "missing",
    language: null,
    word_count: null,
    line_count: null,
    vocal_start_ms: null,
    vocal_end_ms: null,
    words_per_min: null,
    fetched_at: new Date().toISOString(),
  };

  const query = new URLSearchParams({
    track_name: track.title,
    artist_name: track.artist_names?.[0] || track.artist_display || "",
    album_name: track.album_name || "",
    duration: String(Math.round((track.duration_ms || 0) / 1000)),
  });

  let payload: LrcResponse | null = null;
  try {
    const response = await fetch(`${ENDPOINT}?${query}`, {
      headers: { "User-Agent": UA },
      cache: "no-store",
    });
    if (response.ok) payload = (await response.json()) as LrcResponse;
  } catch {
    return base;
  }

  if (!payload) return base;
  if (payload.instrumental) return { ...base, status: "instrumental", word_count: 0 };

  const plain = (payload.plainLyrics || "").trim();
  const synced = payload.syncedLyrics || "";
  if (!plain && !synced) return base;

  const words = plain.split(/\s+/).filter(Boolean).length;
  const stamps = parseTimestamps(synced);
  const vocalStart = stamps.length ? Math.round(stamps[0]) : null;
  const vocalEnd = stamps.length ? Math.round(stamps[stamps.length - 1]) : null;

  // Words per minute across the sung stretch, not the whole track — a long
  // instrumental outro shouldn't read as "sparse lyrics". A suspiciously short
  // span usually means partial timestamps, so fall back to the full duration
  // rather than reporting 400 words a minute.
  const duration = track.duration_ms || 0;
  const sungMs =
    vocalStart !== null && vocalEnd !== null && vocalEnd > vocalStart
      ? vocalEnd - vocalStart
      : 0;
  const spanMs = sungMs > duration * 0.25 ? sungMs : duration;
  const wordsPerMin =
    spanMs > 0 ? Math.min((words / spanMs) * 60_000, 300) : null;

  return {
    ...base,
    status: words > 0 ? "ok" : "instrumental",
    language: words > 0 ? detectLanguage(plain || synced) : null,
    word_count: words,
    line_count: stamps.length || plain.split("\n").filter(Boolean).length,
    vocal_start_ms: vocalStart,
    vocal_end_ms: vocalEnd,
    words_per_min: wordsPerMin,
  };
}

/**
 * Fill in lyric features for tracks that don't have them yet. Chunked so a
 * request stays inside the function timeout; the UI calls it until `remaining`
 * hits zero.
 */
export async function enrichLyrics(limit = 60): Promise<{
  processed: number;
  found: number;
  remaining: number;
}> {
  const supabase = createAdminClient();

  const { data: known } = await supabase.from("music_track_lyrics").select("track_id");
  const knownIds = new Set((known || []).map((row) => row.track_id as string));

  const { data: candidates } = await supabase
    .from("music_tracks")
    .select("track_id, title, artist_names, artist_display, album_name, duration_ms")
    .eq("shelf", "active");

  const pending = (candidates || []).filter((row) => !knownIds.has(row.track_id as string));
  const batch = pending.slice(0, limit);

  // LRCLIB is a free community service — three at a time, never more.
  const results = await mapLimit(batch, 3, (row) => lookup(row as any));

  if (results.length > 0) {
    const { error } = await supabase
      .from("music_track_lyrics")
      .upsert(results, { onConflict: "track_id" });
    if (error) throw new Error(`lyric upsert failed: ${error.message}`);
  }

  return {
    processed: results.length,
    found: results.filter((r) => r.status !== "missing").length,
    remaining: Math.max(0, pending.length - results.length),
  };
}
