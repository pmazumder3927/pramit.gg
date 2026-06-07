import { NextResponse } from "next/server";
import { getAccessToken } from "@/app/lib/spotify";
import { createAdminClient } from "@/utils/supabase/admin";

const CACHE_DURATION = 60 * 60 * 24 * 7; // 7 days
const MAX_PLAYLISTS = 24;

// In-memory cache of the owned+public playlists with follower counts.
// The manual order is applied per-request (cheap DB read) so reorders in the
// admin dashboard show up immediately without waiting for this cache to expire.
let cachedPlaylists: any[] | null = null;
let cacheTimestamp = 0;

// Fetch the admin-defined manual order. Playlists absent from this map fall
// back to follower ranking. Returns an empty map on any error so the page
// degrades gracefully to follower order.
async function getManualOrder(): Promise<Map<string, number>> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("spotify_playlist_order")
      .select("playlist_id, position");
    return new Map(
      (data || []).map((row: any) => [row.playlist_id as string, row.position as number])
    );
  } catch {
    return new Map();
  }
}

// Pinned playlists first (by ascending position), everything else by follower
// count descending. Applied before the cap so a pinned playlist can never be
// dropped by the limit.
function applyManualOrder<T extends { id: string; followers: number }>(
  playlists: T[],
  orderMap: Map<string, number>
): T[] {
  return [...playlists]
    .sort((a, b) => {
      const aPos = orderMap.get(a.id);
      const bPos = orderMap.get(b.id);
      if (aPos !== undefined && bPos !== undefined) return aPos - bPos;
      if (aPos !== undefined) return -1;
      if (bPos !== undefined) return 1;
      return b.followers - a.followers;
    })
    .slice(0, MAX_PLAYLISTS);
}

export async function GET() {
  try {
    const now = Date.now();

    // Return cached data if still valid (manual order still applied fresh)
    if (cachedPlaylists && now - cacheTimestamp < CACHE_DURATION * 1000) {
      const orderMap = await getManualOrder();
      return NextResponse.json(
        { playlists: applyManualOrder(cachedPlaylists, orderMap) },
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

    // Filter to owned public playlists. We keep all of them (no early cap) so
    // the manual order can pin a playlist that wouldn't make the follower
    // top-24; the cap is applied after ordering instead.
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
      }));

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

    // Cache the full annotated list; ordering + capping happen on the way out
    cachedPlaylists = playlistsWithFollowers;
    cacheTimestamp = now;

    const orderMap = await getManualOrder();

    return NextResponse.json(
      { playlists: applyManualOrder(playlistsWithFollowers, orderMap) },
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
