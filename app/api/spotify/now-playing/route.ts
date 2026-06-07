import { NextResponse } from "next/server";
import { getAccessToken } from "@/app/lib/spotify";

const SPOTIFY_NOW_PLAYING_URL =
  "https://api.spotify.com/v1/me/player/currently-playing";
const SPOTIFY_RECENTLY_PLAYED_URL =
  "https://api.spotify.com/v1/me/player/recently-played?limit=1";

// Cache headers for now-playing (short TTL since it changes frequently)
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3, stale-while-revalidate=8",
};

// Now-playing reflects a single (the owner's) account, so it's the same for
// every visitor. A short in-memory cache coalesces many clients polling every
// few seconds into roughly one upstream Spotify call per TTL window, instead of
// one per request — the clients interpolate the playhead locally between fetches.
const NOW_PLAYING_TTL_MS = 4000;
let payloadCache: { at: number; body: Record<string, unknown> } | null = null;

export async function GET() {
  if (payloadCache && Date.now() - payloadCache.at < NOW_PLAYING_TTL_MS) {
    return NextResponse.json(payloadCache.body, { headers: CACHE_HEADERS });
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
          progress: nowPlaying.progress_ms,
          duration: nowPlaying.item.duration_ms,
        };
        payloadCache = { at: Date.now(), body };
        return NextResponse.json(body, { headers: CACHE_HEADERS });
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
          playedAt: lastTrack.played_at,
        };
        payloadCache = { at: Date.now(), body };
        return NextResponse.json(body, { headers: CACHE_HEADERS });
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
    return NextResponse.json(body, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error("Spotify API error:", error);
    // Don't cache errors — serve the last good payload if we have one.
    if (payloadCache) {
      return NextResponse.json(payloadCache.body, { headers: CACHE_HEADERS });
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
