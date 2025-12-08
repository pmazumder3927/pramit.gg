import { NextResponse } from "next/server";
import { getAccessToken } from "@/app/lib/spotify";

const SPOTIFY_RECENTLY_PLAYED_URL =
  "https://api.spotify.com/v1/me/player/recently-played?limit=20";

// Cache for 30 seconds, stale-while-revalidate for 60 more
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
};

export async function GET() {
  try {
    const access_token = await getAccessToken();

    const response = await fetch(SPOTIFY_RECENTLY_PLAYED_URL, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      next: { revalidate: 30 },
    });

    if (response.ok) {
      const data = await response.json();
      const tracks = data.items.map((item: any) => ({
        id: item.track.id,
        title: item.track.name,
        artist: item.track.artists.map((artist: any) => artist.name).join(", "),
        album: item.track.album.name,
        albumImageUrl: item.track.album.images[0]?.url,
        songUrl: item.track.external_urls.spotify,
        playedAt: item.played_at,
        duration: item.track.duration_ms,
        preview_url: item.track.preview_url,
        popularity: item.track.popularity,
        explicit: item.track.explicit,
      }));

      return NextResponse.json({ tracks }, { headers: CACHE_HEADERS });
    }

    return NextResponse.json({ tracks: [] }, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error("Spotify Recently Played API error:", error);
    return NextResponse.json({ tracks: [] }, { status: 500 });
  }
}
