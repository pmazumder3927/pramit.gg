import "server-only";

import { createAdminClient } from "@/utils/supabase/admin";
import { createPublicClient } from "@/utils/supabase/server";
import { getAccessToken } from "@/app/lib/spotify";

// ── "Side B" — visitor song suggestions ────────────────────────────────
// A visitor picks a track (Spotify typeahead) and it gets dropped into the
// owner's real playlist literally named "beloved user suggestions". Mirrors
// the graveyard playlist mechanism (owner token + spotifyFetch + a playlist
// id cached in spotify_review_sync_state, keyed by scope).

const PLAYLIST_NAME = "beloved user suggestions";
const PLAYLIST_DESCRIPTION =
  "songs left for me by visitors of pramit.gg. thank you, beloved strangers.";
const PLAYLIST_SCOPE = "beloved_suggestions_playlist";

export type SuggestTrack = {
  id: string;
  uri: string;
  title: string;
  artist: string;
  album: string;
  albumImageUrl: string | null;
  previewUrl: string | null;
  songUrl: string | null;
};

export type RecentSuggestion = {
  id: string;
  title: string;
  artist: string;
  created_at: string;
};

export type AddSuggestionResult =
  | { status: "added"; title: string; artist: string }
  | { status: "duplicate"; title: string; artist: string };

type SpotifyImage = { url: string; width: number | null; height: number | null };

type RawTrack = {
  id: string;
  uri: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: SpotifyImage[] };
  preview_url: string | null;
  external_urls?: { spotify?: string };
};

async function spotifyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = await getAccessToken();
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Spotify request failed for ${path}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function mapTrack(track: RawTrack): SuggestTrack {
  const images = track.album?.images ?? [];
  // images come largest-first; a mid-size (~300px) is plenty for a ~48px thumb.
  const albumImageUrl = images[1]?.url ?? images[0]?.url ?? null;
  return {
    id: track.id,
    uri: track.uri,
    title: track.name,
    artist: track.artists.map((a) => a.name).join(", "),
    album: track.album?.name ?? "",
    albumImageUrl,
    previewUrl: track.preview_url ?? null,
    songUrl: track.external_urls?.spotify ?? null,
  };
}

/** Spotify typeahead — owner token, tracks only. */
export async function searchTracks(
  query: string,
  limit = 5
): Promise<SuggestTrack[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const params = new URLSearchParams({
    q,
    type: "track",
    limit: String(Math.min(Math.max(limit, 1), 10)),
  });

  const data = await spotifyFetch<{ tracks?: { items?: RawTrack[] } }>(
    `/search?${params.toString()}`
  );

  return (data.tracks?.items ?? [])
    .filter((t): t is RawTrack => Boolean(t?.id))
    .map(mapTrack);
}

/** Authoritative resolve of a single track from its id (never trust client text). */
async function resolveTrack(trackId: string): Promise<SuggestTrack | null> {
  try {
    const track = await spotifyFetch<RawTrack>(`/tracks/${trackId}`);
    return track?.id ? mapTrack(track) : null;
  } catch {
    return null;
  }
}

async function findPlaylistByName(name: string): Promise<string | null> {
  const target = name.trim().toLowerCase();
  let offset = 0;
  // Owner has a few dozen playlists; scan a few pages then give up.
  for (let page = 0; page < 6; page++) {
    const data = await spotifyFetch<{
      items: { id: string; name: string }[];
      next: string | null;
    }>(`/me/playlists?limit=50&offset=${offset}`);

    const match = data.items?.find((p) => p.name?.trim().toLowerCase() === target);
    if (match) return match.id;

    if (!data.next) break;
    offset += 50;
  }
  return null;
}

// Coalesce concurrent first-time calls within this server instance so two
// simultaneous suggestions can't each create a duplicate playlist before the
// id is cached. (A cross-instance race is still theoretically possible but
// matches the graveyard's accepted posture, and find-by-name catches it next.)
let ensureInFlight: Promise<string> | null = null;

/**
 * Find-or-create the "beloved user suggestions" playlist, caching its id in
 * spotify_review_sync_state (same singleton-settings table the graveyard uses).
 */
async function ensureSuggestionsPlaylist(): Promise<string> {
  if (ensureInFlight) return ensureInFlight;

  ensureInFlight = (async () => {
    const supabase = createAdminClient();

    const { data: cached } = await supabase
      .from("spotify_review_sync_state")
      .select("metadata")
      .eq("scope", PLAYLIST_SCOPE)
      .single();

    const cachedId = (cached?.metadata as { id?: string } | null)?.id;
    if (cachedId) return cachedId;

    // Not cached — reuse an existing playlist of that name if the owner already
    // has one, otherwise create it fresh. PUBLIC by intent: the point is a
    // shareable, listenable wall of what visitors left, and it surfaces in the
    // owner's /music playlists tab. Tradeoff: suggestions are anonymous and
    // unmoderated, so the owner curates by removing anything unwanted.
    let playlistId = await findPlaylistByName(PLAYLIST_NAME);

    if (!playlistId) {
      const me = await spotifyFetch<{ id: string }>("/me");
      const created = await spotifyFetch<{ id: string }>(
        `/users/${me.id}/playlists`,
        {
          method: "POST",
          body: JSON.stringify({
            name: PLAYLIST_NAME,
            description: PLAYLIST_DESCRIPTION,
            public: true,
          }),
        }
      );
      playlistId = created.id;
    }

    await supabase.from("spotify_review_sync_state").upsert(
      { scope: PLAYLIST_SCOPE, metadata: { id: playlistId } },
      { onConflict: "scope" }
    );

    return playlistId;
  })().finally(() => {
    ensureInFlight = null;
  });

  return ensureInFlight;
}

/**
 * Drop a suggested track into the playlist, then record it for the wall.
 *
 * Order matters: the playlist add is the actual product, so we do it FIRST and
 * only record on success. That way a failed Spotify add records nothing and a
 * retry is clean — no orphaned row that would wrongly 409 a legitimate retry.
 * Dedupe is a best-effort pre-check (the unique(track_id) constraint is the
 * backstop); if the table is unavailable the suggestion still goes through.
 */
export async function addSuggestion(input: {
  trackId: string;
  note?: string | null;
}): Promise<AddSuggestionResult> {
  const track = await resolveTrack(input.trackId);
  if (!track) {
    throw new Error("TRACK_NOT_FOUND");
  }

  const note = input.note?.trim() ? input.note.trim().slice(0, 140) : null;
  const supabase = createAdminClient();

  // Dedupe pre-check — best-effort. On any read error (e.g. table absent) we
  // treat it as "not a duplicate" and let the suggestion proceed.
  const { data: existing } = await supabase
    .from("song_suggestions")
    .select("track_id")
    .eq("track_id", track.id)
    .maybeSingle();

  if (existing) {
    return { status: "duplicate", title: track.title, artist: track.artist };
  }

  // The product: add to the playlist. If this throws, we record nothing.
  const playlistId = await ensureSuggestionsPlaylist();
  await spotifyFetch(`/playlists/${playlistId}/tracks`, {
    method: "POST",
    body: JSON.stringify({ uris: [track.uri] }),
  });

  // Record for the wall — never fails the suggestion. The unique constraint
  // also collapses a rare concurrent double-add to a single row.
  const { error: insertError } = await supabase.from("song_suggestions").insert({
    track_id: track.id,
    title: track.title,
    artist: track.artist,
    note,
  });
  if (insertError && insertError.code !== "23505") {
    console.error(
      "[suggest] song_suggestions insert failed (non-fatal):",
      insertError
    );
  }

  return { status: "added", title: track.title, artist: track.artist };
}

/** The public "recently mailed" rack — anonymous, no note text, newest first. */
export async function getRecentSuggestions(
  limit = 14
): Promise<RecentSuggestion[]> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("song_suggestions")
      .select("id, title, artist, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 40));

    if (error) return [];
    return (data ?? []) as RecentSuggestion[];
  } catch {
    return [];
  }
}
