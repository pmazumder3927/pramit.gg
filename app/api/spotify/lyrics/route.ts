import { NextResponse } from "next/server";

// Time-synced lyrics for the now-playing track, sourced from LRCLIB
// (https://lrclib.net) — a free, keyless, community lyrics database that returns
// LRC-format synced lyrics. Spotify itself has no public lyrics API, so we match
// on the metadata we already have (title / artist / album / duration) and parse
// the `[mm:ss.xx]` timestamps into lines the SongScape can ink in on the beat.

const LRCLIB_GET = "https://lrclib.net/api/get";
const LRCLIB_SEARCH = "https://lrclib.net/api/search";
// LRCLIB asks clients to identify themselves with a descriptive User-Agent.
const UA = "pramit.gg (+https://pramit.gg)";

export interface LyricLine {
  /** Offset from the start of the track, in ms. */
  t: number;
  text: string;
}
interface LyricsPayload {
  synced: boolean;
  lines: LyricLine[];
  source: "lrclib" | "none";
}

// Lyrics never change for a given track, so cache hard and keep negatives too
// (so a track without synced lyrics doesn't re-hit LRCLIB on every visitor).
const cache = new Map<string, LyricsPayload>();

interface LrcRecord {
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
  instrumental?: boolean;
  duration?: number;
}

// Parse an LRC blob ("[01:23.45] line") into ordered, timestamped lines. A single
// physical line can carry several timestamps ("[00:10.0][01:20.0] chorus"); each
// becomes its own entry. Metadata tags ([ar:], [by:], …) are dropped.
function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const stamp = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  for (const raw of lrc.split(/\r?\n/)) {
    stamp.lastIndex = 0;
    const stamps: number[] = [];
    let m: RegExpExecArray | null;
    let lastEnd = 0;
    while ((m = stamp.exec(raw)) !== null) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const fracStr = m[3] ?? "0";
      // normalise hundredths/thousandths to ms
      const frac = parseInt(fracStr, 10) / Math.pow(10, fracStr.length);
      stamps.push((min * 60 + sec + frac) * 1000);
      lastEnd = stamp.lastIndex;
    }
    if (!stamps.length) continue;
    const text = raw.slice(lastEnd).trim();
    for (const t of stamps) lines.push({ t: Math.round(t), text });
  }
  lines.sort((a, b) => a.t - b.t);
  return lines;
}

function toPayload(rec: LrcRecord | null): LyricsPayload {
  if (rec && !rec.instrumental && rec.syncedLyrics) {
    const lines = parseLrc(rec.syncedLyrics);
    if (lines.length) return { synced: true, lines, source: "lrclib" };
  }
  return { synced: false, lines: [], source: "none" };
}

async function lrcFetch(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    // Static data; let the platform cache it for a day.
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = (searchParams.get("title") || "").trim();
  const artist = (searchParams.get("artist") || "").trim();
  const album = (searchParams.get("album") || "").trim();
  const trackId = (searchParams.get("trackId") || "").trim();
  // Spotify gives ms; LRCLIB matches on whole seconds.
  const durationMs = parseInt(searchParams.get("duration") || "0", 10);
  const durationSec = durationMs > 0 ? Math.round(durationMs / 1000) : 0;

  if (!title || !artist) {
    return NextResponse.json({ synced: false, lines: [], source: "none" });
  }

  const cacheKey = trackId || `${title}|${artist}`;
  const hit = cache.get(cacheKey);
  if (hit) {
    return NextResponse.json(hit, {
      headers: { "Cache-Control": "public, s-maxage=86400, max-age=86400" },
    });
  }

  let payload: LyricsPayload = { synced: false, lines: [], source: "none" };

  try {
    // 1) Exact get — best match when title/artist/album/duration line up.
    const getUrl = new URL(LRCLIB_GET);
    getUrl.searchParams.set("track_name", title);
    getUrl.searchParams.set("artist_name", artist);
    if (album) getUrl.searchParams.set("album_name", album);
    if (durationSec) getUrl.searchParams.set("duration", String(durationSec));
    const exact = (await lrcFetch(getUrl.toString())) as LrcRecord | null;
    payload = toPayload(exact);

    // 2) Fall back to search (covers remasters / album mismatches). Prefer a
    //    result with synced lyrics whose duration is closest to ours.
    if (!payload.synced) {
      const searchUrl = new URL(LRCLIB_SEARCH);
      searchUrl.searchParams.set("track_name", title);
      searchUrl.searchParams.set("artist_name", artist);
      const results = (await lrcFetch(searchUrl.toString())) as LrcRecord[] | null;
      if (Array.isArray(results) && results.length) {
        const synced = results.filter((r) => r.syncedLyrics && !r.instrumental);
        if (synced.length) {
          const best = durationSec
            ? synced.reduce((a, b) =>
                Math.abs((b.duration ?? 0) - durationSec) <
                Math.abs((a.duration ?? 0) - durationSec)
                  ? b
                  : a
              )
            : synced[0];
          payload = toPayload(best);
        }
      }
    }
  } catch (err) {
    console.error("LRCLIB lyrics error:", err);
  }

  cache.set(cacheKey, payload);
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "public, s-maxage=86400, max-age=86400" },
  });
}
