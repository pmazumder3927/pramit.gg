import { NextResponse } from "next/server";
import { getAccessToken } from "@/app/lib/spotify";

const SPOTIFY_NOW_PLAYING_URL =
  "https://api.spotify.com/v1/me/player/currently-playing";
const SPOTIFY_RECENTLY_PLAYED_URL =
  "https://api.spotify.com/v1/me/player/recently-played?limit=1";

// No HTTP/CDN caching: a cached body would freeze `serverNow`, so the client
// couldn't tell how stale the playhead is (stale-while-revalidate would serve a
// body up to several seconds old with no way to compensate → lyrics drift
// behind). The in-memory `payloadCache` below still coalesces upstream Spotify
// calls, so every poll stays cheap while always returning a fresh `serverNow`.
const CACHE_HEADERS = {
  "Cache-Control": "no-store, must-revalidate",
};

// Now-playing reflects a single (the owner's) account, so it's the same for
// every visitor. A short in-memory cache coalesces many clients polling every
// few seconds into roughly one upstream Spotify call per TTL window, instead of
// one per request — the clients interpolate the playhead locally between fetches.
const NOW_PLAYING_TTL_MS = 4000;
let payloadCache: { at: number; body: Record<string, unknown> } | null = null;

// `fetchedAt` (when the upstream Spotify data was actually pulled) plus a fresh
// `serverNow` on every response let the client correct for in-memory cache
// staleness when estimating the live playhead for listen-along.
function respond(body: Record<string, unknown>) {
  return NextResponse.json(
    { ...body, serverNow: Date.now() },
    { headers: CACHE_HEADERS }
  );
}

export async function GET() {
  if (payloadCache && Date.now() - payloadCache.at < NOW_PLAYING_TTL_MS) {
    return respond({ ...payloadCache.body, fetchedAt: payloadCache.at });
  }

  try {
    const access_token = await getAccessToken();

    // Try to get currently playing track
    const nowPlayingResponse = await fetch(SPOTIFY_NOW_PLAYING_URL, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      // Keep the upstream fetch fresh so a song change surfaces quickly
      cache: "no-store",
    });

    if (nowPlayingResponse.status === 200) {
      const nowPlaying = await nowPlayingResponse.json();

      if (nowPlaying.is_playing) {
        const body = {
          isPlaying: true,
          title: nowPlaying.item.name,
          artist: nowPlaying.item.artists
            .map((artist: any) => artist.name)
            .join(", "),
          album: nowPlaying.item.album.name,
          albumImageUrl: nowPlaying.item.album.images[0]?.url,
          songUrl: nowPlaying.item.external_urls.spotify,
          trackId: nowPlaying.item.id,
          uri: nowPlaying.item.uri,
          progress: nowPlaying.progress_ms,
          duration: nowPlaying.item.duration_ms,
        };
        payloadCache = { at: Date.now(), body };
        return respond({ ...body, fetchedAt: payloadCache.at });
      }
    }

    // If nothing is currently playing, get the last played track
    const recentlyPlayedResponse = await fetch(SPOTIFY_RECENTLY_PLAYED_URL, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      next: { revalidate: 30 },
    });

    if (recentlyPlayedResponse.ok) {
      const recentlyPlayed = await recentlyPlayedResponse.json();
      const lastTrack = recentlyPlayed.items[0];

      if (lastTrack) {
        const body = {
          isPlaying: false,
          title: lastTrack.track.name,
          artist: lastTrack.track.artists
            .map((artist: any) => artist.name)
            .join(", "),
          album: lastTrack.track.album.name,
          albumImageUrl: lastTrack.track.album.images[0]?.url,
          songUrl: lastTrack.track.external_urls.spotify,
          trackId: lastTrack.track.id,
          uri: lastTrack.track.uri,
          playedAt: lastTrack.played_at,
        };
        payloadCache = { at: Date.now(), body };
        return respond({ ...body, fetchedAt: payloadCache.at });
      }
    }

    const body = {
      isPlaying: false,
      title: "nothing",
      artist: "",
      album: "",
      albumImageUrl: null,
      songUrl: null,
    };
    payloadCache = { at: Date.now(), body };
    return respond({ ...body, fetchedAt: payloadCache.at });
  } catch (error) {
    console.error("Spotify API error:", error);
    // Don't cache errors — serve the last good payload if we have one.
    if (payloadCache) {
      return respond({ ...payloadCache.body, fetchedAt: payloadCache.at });
    }
    return NextResponse.json(
      {
        isPlaying: false,
        title: "nothing",
        artist: "",
        album: "",
        albumImageUrl: null,
        songUrl: null,
      },
      { status: 500 }
    );
  }
}
