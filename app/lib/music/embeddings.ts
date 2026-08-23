import "server-only";

import { createHash } from "node:crypto";
import OpenAI from "openai";
import { createAdminClient } from "@/utils/supabase/admin";
import { chunk } from "./spotify-api";

/**
 * "Sense" vectors — an embedding of what a song is actually about.
 *
 * The lyrics are the substance and very nearly the whole document; see the note
 * on `document` below for why everything else was taken out of it. What this
 * buys is a similarity that puts two break-up songs together even when one is in
 * Korean and the other in English, which is the thing hand-written features
 * could never do.
 *
 * Pairs with the "sound" vectors from scripts/music-audio.mjs. One knows what a
 * song means, the other knows what it sounds like.
 */

const MODEL = "text-embedding-3-small";
const DIMS = 1536;
const BATCH = 96;

let client: OpenAI | null = null;
function openai(): OpenAI | null {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  client = new OpenAI({ apiKey });
  return client;
}

type Row = {
  track_id: string;
  title: string;
  artist_display: string;
  album_name: string | null;
  release_year: number | null;
};

type LyricRow = {
  track_id: string;
  text: string | null;
  language: string | null;
  status: string;
  words_per_min: number | null;
};

/**
 * The document a track gets embedded as.
 *
 * Lyrics, and almost nothing else. The version this replaces led every document
 * with "{title} — {artist} / from {album} / released {year} / sung in
 * {language}", which made artist and language the strongest directions in the
 * space: a track's nearest neighbour was by the same artist 46.7% of the time
 * against a 0.17% chance rate, and shared its language 78% of the time against
 * 56%. So "what this song is about" was largely "who made it", and a playlist
 * ordered on it came out in artist and language slabs.
 *
 * With the header gone those fall to 9.8% and 55.5% — the language leak
 * disappears entirely, and what is left of the artist effect is the real thing,
 * people writing about the same subjects twice.
 *
 * Language, year and artist are all still used by the sequencer. They are read
 * from their own columns, where a rule can say what it means by them, rather
 * than smuggled into a similarity.
 */
function document(track: Row, lyric: LyricRow | undefined): string {
  const body = (lyric?.text || "").trim();
  if (body) return `${body.slice(0, 4500)}\n\n—\ncalled "${track.title}"`;
  if (lyric?.status === "instrumental") {
    return `An instrumental piece with no words, called "${track.title}".`;
  }
  return `A song called "${track.title}", whose words are not written down anywhere.`;
}

function hash(text: string): string {
  return createHash("sha1").update(text).digest("hex").slice(0, 16);
}

export async function embedLibrary(limit = 300): Promise<{
  embedded: number;
  remaining: number;
  skipped: boolean;
}> {
  const ai = openai();
  if (!ai) return { embedded: 0, remaining: 0, skipped: true };

  const supabase = createAdminClient();
  const [{ data: tracks }, { data: lyrics }, { data: known }] = await Promise.all([
    supabase
      .from("music_tracks")
      .select("track_id, title, artist_display, album_name, release_year")
      .eq("shelf", "active")
      .eq("unavailable", false),
    supabase
      .from("music_track_lyrics")
      .select("track_id, text, language, status, words_per_min"),
    supabase.from("music_track_sense").select("track_id, source_hash"),
  ]);

  const lyricById = new Map(
    ((lyrics || []) as LyricRow[]).map((row) => [row.track_id, row])
  );
  const hashById = new Map(
    (known || []).map((row) => [row.track_id as string, row.source_hash as string])
  );

  const pending = ((tracks || []) as Row[])
    .map((track) => {
      const text = document(track, lyricById.get(track.track_id));
      return { trackId: track.track_id, text, sourceHash: hash(text) };
    })
    .filter((item) => hashById.get(item.trackId) !== item.sourceHash);

  const batch = pending.slice(0, limit);
  let embedded = 0;

  for (const group of chunk(batch, BATCH)) {
    const response = await ai.embeddings.create({
      model: MODEL,
      input: group.map((item) => item.text),
      dimensions: DIMS,
    });

    const rows = response.data.map((item, index) => ({
      track_id: group[index].trackId,
      embedding: JSON.stringify(item.embedding),
      model: MODEL,
      source_hash: group[index].sourceHash,
      embedded_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("music_track_sense")
      .upsert(rows, { onConflict: "track_id" });
    if (error) throw new Error(`sense upsert failed: ${error.message}`);
    embedded += rows.length;
  }

  return {
    embedded,
    remaining: Math.max(0, pending.length - batch.length),
    skipped: false,
  };
}
