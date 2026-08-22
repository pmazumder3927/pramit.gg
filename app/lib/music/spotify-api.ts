import "server-only";

import { getAccessToken } from "@/app/lib/spotify";

/**
 * One thin Spotify client for the whole manager: retries, honours Retry-After,
 * pages, and batches. The old code had four copies of `spotifyFetch`, none of
 * which handled 429 — which is what made a long sync fall over halfway.
 */

const BASE = "https://api.spotify.com/v1";

export class SpotifyError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "SpotifyError";
  }
}

export async function api<T>(
  path: string,
  init?: RequestInit & { attempts?: number }
): Promise<T> {
  const attempts = init?.attempts ?? 4;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const token = await getAccessToken();
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("Retry-After") || 1);
      await sleep(Math.min(retryAfter, 10) * 1000);
      continue;
    }

    // 502/503/504 are transient often enough to be worth one more go.
    if (response.status >= 502 && attempt < attempts - 1) {
      await sleep(400 * (attempt + 1));
      continue;
    }

    if (!response.ok) {
      throw new SpotifyError(
        response.status,
        (await response.text()) || `${response.status} on ${path}`
      );
    }

    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }

  throw new SpotifyError(429, `Spotify kept rate-limiting ${path}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Walk an offset-paginated endpoint to the end. */
export async function pageAll<T>(
  path: string,
  pageSize = 50,
  cap = 10_000
): Promise<T[]> {
  const items: T[] = [];
  let offset = 0;

  while (items.length < cap) {
    const join = path.includes("?") ? "&" : "?";
    const data = await api<{ items: T[]; next: string | null }>(
      `${path}${join}limit=${pageSize}&offset=${offset}`
    );
    items.push(...(data?.items || []));
    if (!data?.next) break;
    offset += pageSize;
  }

  return items;
}

/** Run `work` over `items` with bounded concurrency, preserving order. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  work: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await work(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Payload shapes (only the fields the manager reads)
// ---------------------------------------------------------------------------

export type SpotifyTrack = {
  id: string | null;
  uri: string | null;
  name: string;
  artists: Array<{ id: string | null; name: string }>;
  album: {
    id?: string;
    name: string;
    images?: Array<{ url: string }>;
    release_date?: string;
  };
  duration_ms: number | null;
  popularity: number | null;
  explicit: boolean;
  external_urls?: { spotify?: string };
};

export type SpotifyPlaylist = {
  id: string;
  name: string;
  description: string | null;
  images: Array<{ url: string }> | null;
  external_urls?: { spotify?: string };
  tracks?: { total?: number };
  owner?: { id?: string; display_name?: string | null };
  public?: boolean;
  snapshot_id?: string | null;
};

export const PLAYLIST_TRACK_FIELDS =
  "items(added_at,track(id,uri,name,artists(id,name),album(id,name,images,release_date),duration_ms,popularity,explicit,external_urls)),next";

export async function fetchMe() {
  return api<{ id: string; display_name?: string }>("/me");
}

export async function fetchSavedTracks() {
  return pageAll<{ added_at: string; track: SpotifyTrack }>("/me/tracks", 50);
}

export async function fetchOwnedPlaylists(userId: string) {
  const all = await pageAll<SpotifyPlaylist>("/me/playlists", 50);
  return all.filter((playlist) => playlist.owner?.id === userId);
}

export async function fetchPlaylistTracks(playlistId: string) {
  return pageAll<{ added_at: string | null; track: SpotifyTrack | null }>(
    `/playlists/${playlistId}/tracks?fields=${PLAYLIST_TRACK_FIELDS}`,
    100
  );
}

export async function fetchPlaylistMeta(playlistId: string) {
  return api<SpotifyPlaylist>(
    `/playlists/${playlistId}?fields=id,name,description,images,external_urls,public,snapshot_id,owner(id,display_name),tracks(total)`
  );
}

export async function fetchRecentlyPlayed() {
  const data = await api<{
    items: Array<{ played_at: string; track: SpotifyTrack }>;
  }>("/me/player/recently-played?limit=50");
  return data?.items || [];
}

export async function fetchTopTracks(
  range: "short_term" | "medium_term" | "long_term"
) {
  const data = await api<{ items: SpotifyTrack[] }>(
    `/me/top/tracks?limit=50&time_range=${range}`
  );
  return data?.items || [];
}
