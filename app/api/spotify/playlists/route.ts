import { NextResponse } from "next/server";
import { getAccessToken } from "@/app/lib/spotify";

const CACHE_DURATION = 60 * 60 * 24 * 7; // 7 days

// In-memory cache for playlist data
let cachedPlaylists: any[] | null = null;
let cacheTimestamp = 0;

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

    // Fetch user ID and first page of playlists in parallel
    const [userRes, playlistRes] = await Promise.all([
      fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${access_token}` },
      }),
      fetch("https://api.spotify.com/v1/me/playlists?limit=50", {
        headers: { Authorization: `Bearer ${access_token}` },
      }),
    ]);

    if (!userRes.ok || !playlistRes.ok) {
      return NextResponse.json({ playlists: [] }, { status: 500 });
    }

    const [userData, playlistData] = await Promise.all([
      userRes.json(),
      playlistRes.json(),
    ]);

    const userId = userData.id;

    // Collect first page, fetch remaining pages if needed
    let allPlaylists = [...playlistData.items];
    let nextUrl: string | null = playlistData.next;

    while (nextUrl) {
      const res = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (!res.ok) break;
      const data = await res.json();
      allPlaylists.push(...data.items);
      nextUrl = data.next;
    }

    // Filter to owned public playlists, skip individual follower lookups
    // (saves N API calls — sort by track count instead which is already available)
    const ownedPublicPlaylists = allPlaylists
      .filter((p) => p.public && p.owner?.id === userId)
      .map((playlist) => ({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        imageUrl: playlist.images[0]?.url,
        playlistUrl: playlist.external_urls.spotify,
        trackCount: playlist.tracks.total,
        owner: playlist.owner.display_name,
        public: playlist.public,
        followers: 0,
      }))
      .slice(0, 24);

    // Fetch follower counts in parallel (all at once, not sequentially)
    const followerResults = await Promise.all(
      ownedPublicPlaylists.map((p) =>
        fetch(
          `https://api.spotify.com/v1/playlists/${p.id}?fields=followers`,
          { headers: { Authorization: `Bearer ${access_token}` } }
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => d?.followers?.total || 0)
          .catch(() => 0)
      )
    );

    const playlistsWithFollowers = ownedPublicPlaylists.map((p, i) => ({
      ...p,
      followers: followerResults[i],
    }));

    // Sort by followers descending
    const topPlaylists = playlistsWithFollowers.sort(
      (a, b) => b.followers - a.followers
    );

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
