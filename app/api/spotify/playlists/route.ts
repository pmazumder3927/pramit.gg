import { NextResponse } from "next/server";
import { getAccessToken } from "@/app/lib/spotify";

const CACHE_DURATION = 60 * 60 * 24 * 7; // 7 days - follower counts don't change often

// In-memory cache for playlist data
let cachedPlaylists: any[] | null = null;
let cacheTimestamp = 0;

async function getCurrentUserId(accessToken: string): Promise<string | null> {
  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return null;

  const data = await response.json();
  return data.id;
}

async function fetchAllPlaylists(accessToken: string): Promise<any[]> {
  const playlists: any[] = [];
  let url: string | null = "https://api.spotify.com/v1/me/playlists?limit=50";

  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) break;

    const data = await response.json();
    playlists.push(...data.items);
    url = data.next;
  }

  return playlists;
}

async function getPlaylistFollowers(
  playlistId: string,
  accessToken: string
): Promise<number> {
  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}?fields=followers`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) return 0;

  const data = await response.json();
  return data.followers?.total || 0;
}

export async function GET() {
  try {
    const now = Date.now();

    // Return cached data if still valid
    if (cachedPlaylists && now - cacheTimestamp < CACHE_DURATION * 1000) {
      return NextResponse.json(
        { playlists: cachedPlaylists },
        {
          headers: {
            "Cache-Control": `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate`,
          },
        }
      );
    }

    const access_token = await getAccessToken();

    // Get current user's ID
    const userId = await getCurrentUserId(access_token);
    if (!userId) {
      return NextResponse.json({ playlists: [] }, { status: 500 });
    }

    // Fetch all playlists
    const allPlaylists = await fetchAllPlaylists(access_token);

    // Filter to only playlists created by the user (not followed playlists)
    const ownedPublicPlaylists = allPlaylists.filter(
      (p) => p.public && p.owner?.id === userId
    );

    // Fetch follower counts for each playlist
    const playlistsWithFollowers = await Promise.all(
      ownedPublicPlaylists.map(async (playlist) => {
        const followers = await getPlaylistFollowers(playlist.id, access_token);
        return {
          id: playlist.id,
          name: playlist.name,
          description: playlist.description,
          imageUrl: playlist.images[0]?.url,
          playlistUrl: playlist.external_urls.spotify,
          trackCount: playlist.tracks.total,
          owner: playlist.owner.display_name,
          public: playlist.public,
          followers,
        };
      })
    );

    // Sort by followers descending and take top 24
    const topPlaylists = playlistsWithFollowers
      .sort((a, b) => b.followers - a.followers)
      .slice(0, 24);

    // Update cache
    cachedPlaylists = topPlaylists;
    cacheTimestamp = now;

    return NextResponse.json(
      { playlists: topPlaylists },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate`,
        },
      }
    );
  } catch (error) {
    console.error("Spotify Playlists API error:", error);
    return NextResponse.json({ playlists: [] }, { status: 500 });
  }
}
