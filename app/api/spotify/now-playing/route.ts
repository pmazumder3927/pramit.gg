import { NextResponse } from "next/server";
import { getAccessToken } from "@/app/lib/spotify";

const SPOTIFY_NOW_PLAYING_URL =
  "https://api.spotify.com/v1/me/player/currently-playing";
const SPOTIFY_RECENTLY_PLAYED_URL =
  "https://api.spotify.com/v1/me/player/recently-played?limit=1";

export async function GET() {
  try {
    const access_token = await getAccessToken();

    // Try to get currently playing track
    const nowPlayingResponse = await fetch(SPOTIFY_NOW_PLAYING_URL, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (nowPlayingResponse.status === 200) {
      const nowPlaying = await nowPlayingResponse.json();

      if (nowPlaying.is_playing) {
        return NextResponse.json({
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
        });
      }
    }

    // If nothing is currently playing, get the last played track
    const recentlyPlayedResponse = await fetch(SPOTIFY_RECENTLY_PLAYED_URL, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (recentlyPlayedResponse.ok) {
      const recentlyPlayed = await recentlyPlayedResponse.json();
      const lastTrack = recentlyPlayed.items[0];

      if (lastTrack) {
        return NextResponse.json({
          isPlaying: false,
          title: lastTrack.track.name,
          artist: lastTrack.track.artists
            .map((artist: any) => artist.name)
            .join(", "),
          album: lastTrack.track.album.name,
          albumImageUrl: lastTrack.track.album.images[0]?.url,
          songUrl: lastTrack.track.external_urls.spotify,
          playedAt: lastTrack.played_at,
        });
      }
    }

    return NextResponse.json({
      isPlaying: false,
      title: "nothing",
      artist: "",
      album: "",
      albumImageUrl: null,
      songUrl: null,
    });
  } catch (error) {
    console.error("Spotify API error:", error);
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
