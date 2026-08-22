import { getAccessToken } from "@/app/lib/spotify";
import { createAdminClient } from "@/utils/supabase/admin";

// Shared server-side Spotify data fetchers. These carry the exact logic the
// /api/spotify/{recently-played,top-tracks,playlists} routes served — the
// routes now import from here, and the /music page calls the same functions
// during ISR rendering so the first HTML byte already has real track data.
// Everything runs on env vars + the owner's stored token (no request context),
// so callers stay statically renderable.

const SPOTIFY_RECENTLY_PLAYED_URL =
  "https://api.spotify.com/v1/me/player/recently-played?limit=20";
const SPOTIFY_TOP_TRACKS_URL =
  "https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=short_term";

export const PLAYLISTS_CACHE_DURATION = 60 * 60 * 24 * 7; // 7 days
const MAX_PLAYLISTS = 24;

export interface SpotifyTrackPayload {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumImageUrl: string | null;
  songUrl: string | null;
  playedAt?: string;
  duration?: number;
  preview_url?: string | null;
  popularity?: number;
  explicit?: boolean;
}

export interface SpotifyPlaylistPayload {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  playlistUrl: string;
  trackCount: number;
  owner: string;
  public: boolean;
  followers: number;
}

/**
 * Recently played tracks — the exact payload /api/spotify/recently-played
 * serves. Returns `{ tracks: [] }` when Spotify answers non-OK; throws when
 * the token can't be obtained (callers decide how to degrade).
 */
export async function getRecentlyPlayed(): Promise<{
  tracks: SpotifyTrackPayload[];
}> {
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

    return { tracks };
  }

  return { tracks: [] };
}

/**
 * Top tracks — the exact payload /api/spotify/top-tracks serves. Returns
 * `{ tracks: [] }` when Spotify answers non-OK; throws on token failure.
 */
export async function getTopTracks(): Promise<{
  tracks: SpotifyTrackPayload[];
}> {
  const access_token = await getAccessToken();

  const response = await fetch(SPOTIFY_TOP_TRACKS_URL, {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
    next: { revalidate: 300 },
  });

  if (response.ok) {
    const data = await response.json();
    const tracks = data.items.map((track: any) => ({
      id: track.id,
      title: track.name,
      artist: track.artists.map((artist: any) => artist.name).join(", "),
      album: track.album.name,
      albumImageUrl: track.album.images[0]?.url,
      songUrl: track.external_urls.spotify,
      duration: track.duration_ms,
      preview_url: track.preview_url,
      popularity: track.popularity,
      explicit: track.explicit,
    }));

    return { tracks };
  }

  return { tracks: [] };
}

// In-memory cache of the owned+public playlists with follower counts.
// The manual order is applied per-request (cheap DB read) so reorders in the
// admin dashboard show up immediately without waiting for this cache to expire.
let cachedPlaylists: SpotifyPlaylistPayload[] | null = null;
let cacheTimestamp = 0;

// The manager's view of each playlist: where the owner pinned it, and whether
// it belongs on the public page at all. Graveyard mirrors are role='graveyard'
// and never public — before this existed, "2026 graveyard" sat at position 5 of
// /music because Spotify reported it public and nothing filtered by role.
// Returns empty on any error so the page degrades to follower order.
async function getPlaylistShelf(): Promise<{
  order: Map<string, number>;
  excluded: Set<string>;
}> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("music_playlists")
      .select("playlist_id, sort_position, role, hidden");
    const order = new Map<string, number>();
    const excluded = new Set<string>();
    for (const row of (data || []) as any[]) {
      // Graveyard mirrors never belong here. The visitor-suggestion playlist
      // does — it's public on purpose — unless the owner hides it.
      if (row.role === "graveyard" || row.hidden) {
        excluded.add(row.playlist_id as string);
        continue;
      }
      if (row.sort_position !== null) {
        order.set(row.playlist_id as string, row.sort_position as number);
      }
    }
    return { order, excluded };
  } catch {
    return { order: new Map(), excluded: new Set() };
  }
}

// Pinned playlists first (by ascending position), everything else by follower
// count descending. Applied before the cap so a pinned playlist can never be
// dropped by the limit.
function applyManualOrder<T extends { id: string; followers: number }>(
  playlists: T[],
  shelf: { order: Map<string, number>; excluded: Set<string> }
): T[] {
  return [...playlists]
    .filter((playlist) => !shelf.excluded.has(playlist.id))
    .sort((a, b) => {
      const aPos = shelf.order.get(a.id);
      const bPos = shelf.order.get(b.id);
      if (aPos !== undefined && bPos !== undefined) return aPos - bPos;
      if (aPos !== undefined) return -1;
      if (bPos !== undefined) return 1;
      return b.followers - a.followers;
    })
    .slice(0, MAX_PLAYLISTS);
}

/**
 * Owned public playlists, follower-ranked with the admin manual order applied
 * — the exact payload /api/spotify/playlists serves. Returns `null` when the
 * Spotify user/playlist fetch answers non-OK (the route turns that into a
 * 500); throws on token failure.
 */
export async function getPlaylists(): Promise<{
  playlists: SpotifyPlaylistPayload[];
} | null> {
  const now = Date.now();

  // Return cached data if still valid (manual order still applied fresh)
  if (cachedPlaylists && now - cacheTimestamp < PLAYLISTS_CACHE_DURATION * 1000) {
    const shelf = await getPlaylistShelf();
    return { playlists: applyManualOrder(cachedPlaylists, shelf) };
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
    return null;
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

  const shelf = await getPlaylistShelf();

  return { playlists: applyManualOrder(playlistsWithFollowers, shelf) };
}
