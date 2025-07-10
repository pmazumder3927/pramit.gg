import { NextResponse } from "next/server";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_PLAYLISTS_URL =
  "https://api.spotify.com/v1/me/playlists?limit=10";

async function getAccessToken() {
  const refresh_token = process.env.SPOTIFY_REFRESH_TOKEN;
  const client_id = process.env.SPOTIFY_CLIENT_ID;
  const client_secret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!refresh_token || !client_id || !client_secret) {
    throw new Error("Missing Spotify credentials");
  }

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${client_id}:${client_secret}`
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh token");
  }

  return response.json();
}

export async function GET() {
  try {
    const { access_token } = await getAccessToken();

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
