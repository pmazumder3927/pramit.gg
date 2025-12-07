import { NextResponse } from "next/server";
import { getAccessToken } from "@/app/lib/spotify";

const SPOTIFY_PLAYLISTS_URL =
  "https://api.spotify.com/v1/me/playlists?limit=10";

export async function GET() {
  try {
    const access_token = await getAccessToken();

    const response = await fetch(SPOTIFY_PLAYLISTS_URL, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      next: {
        revalidate: 60 * 60 * 24, // 24 hours
      },
    });

    if (response.ok) {
      const data = await response.json();
      const playlists = data.items.map((playlist: any) => ({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        imageUrl: playlist.images[0]?.url,
        playlistUrl: playlist.external_urls.spotify,
        trackCount: playlist.tracks.total,
        owner: playlist.owner.display_name,
        public: playlist.public,
      }));

      return NextResponse.json({ playlists });
    }

    return NextResponse.json({ playlists: [] });
  } catch (error) {
    console.error("Spotify Playlists API error:", error);
    return NextResponse.json({ playlists: [] }, { status: 500 });
  }
}
