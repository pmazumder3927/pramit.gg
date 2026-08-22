import "server-only";

import { createHash } from "node:crypto";
import OpenAI from "openai";
import { createAdminClient } from "@/utils/supabase/admin";
import { chunk } from "./spotify-api";

/**
 * "Sense" vectors — an embedding of what a song is actually about.
 *
 * The lyrics are the substance; title, artist, album and year are there to
 * place a song when the lyrics are thin or missing. Together they give a
 * similarity that understands that two break-up songs belong near each other
 * even when one is in Korean and the other in English — which is the thing
 * hand-written features could never do.
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

/** The document a track gets embedded as. Lyrics first, facts as context. */
function document(track: Row, lyric: LyricRow | undefined): string {
  const facts = [
    `${track.title} — ${track.artist_display}`,
    track.album_name ? `from ${track.album_name}` : null,
    track.release_year ? `released ${track.release_year}` : null,
    lyric?.language ? `sung in ${lyric.language}` : null,
    lyric?.status === "instrumental" ? "instrumental, no words" : null,
  ]
    .filter(Boolean)
    .join("\n");

  const body = (lyric?.text || "").trim();
  return body ? `${facts}\n\n${body.slice(0, 4500)}` : facts;
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
