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

/**
 * When Spotify says come back later, and it means hours.
 *
 * A day of shaping earned a Retry-After of 49,103 seconds — nearly fourteen
 * hours. Retrying into that wastes forty seconds per request and then fails
 * anyway, so once a limit longer than the retry budget is seen, everything
 * fails fast until it lifts and callers that have a local copy use it.
 */
let coolUntil = 0;

export function rateLimitedFor(): number {
  return Math.max(0, coolUntil - Date.now());
}

export async function api<T>(
  path: string,
  init?: RequestInit & { attempts?: number }
): Promise<T> {
  const attempts = init?.attempts ?? 4;

  if (rateLimitedFor() > 0) {
    throw new SpotifyError(
      429,
      `Spotify is rate-limiting this app for another ${Math.ceil(rateLimitedFor() / 60_000)} minutes`
    );
  }

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
      // Longer than we are ever going to wait out: stop asking.
      if (retryAfter > 60) {
        coolUntil = Date.now() + retryAfter * 1000;
        throw new SpotifyError(
          429,
          `Spotify is rate-limiting this app for another ${Math.ceil(retryAfter / 60)} minutes`
        );
      }
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

/**
 * A short memory of what a playlist held.
 *
 * Every turn of a shaping knob re-runs the sequencer, and the sequencer starts
 * by asking Spotify for the playlist — three requests for a 225-track list.
 * Sliding one slider is a dozen of those, which is how the whole thing walked
 * into a 429 during testing. Forty-five seconds is long enough that a session at
 * the bench costs one read, and short enough that a song added in another window
 * shows up almost immediately.
 *
 * Deliberately not used by `applySetlist`, which re-reads Spotify itself: an
 * order is written against live positions and a stale index would move the wrong
 * songs.
 */
const PLAYLIST_TTL = 45_000;
const recent = new Map<string, { at: number; value: Promise<unknown> }>();

function remembered<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = recent.get(key);
  if (hit && Date.now() - hit.at < PLAYLIST_TTL) return hit.value as Promise<T>;
  const value = load().catch((error) => {
    recent.delete(key);
    throw error;
  });
  recent.set(key, { at: Date.now(), value });
  // Nothing evicts this otherwise, and a long-lived server would hold every
  // playlist it ever read.
  if (recent.size > 40) {
    for (const [id, entry] of Array.from(recent.entries())) {
      if (Date.now() - entry.at >= PLAYLIST_TTL) recent.delete(id);
    }
  }
  return value;
}

/** Drop what we remember about a playlist, after writing to it. */
export function forgetPlaylist(playlistId: string): void {
  recent.delete(`tracks:${playlistId}`);
  recent.delete(`meta:${playlistId}`);
}

export async function fetchPlaylistTracks(playlistId: string) {
  return remembered(`tracks:${playlistId}`, () =>
    pageAll<{ added_at: string | null; track: SpotifyTrack | null }>(
      `/playlists/${playlistId}/tracks?fields=${PLAYLIST_TRACK_FIELDS}`,
      100
    )
  );
}

export async function fetchPlaylistMeta(playlistId: string) {
  return remembered(`meta:${playlistId}`, () =>
    api<SpotifyPlaylist>(
      `/playlists/${playlistId}?fields=id,name,description,images,external_urls,public,snapshot_id,owner(id,display_name),tracks(total)`
    )
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
