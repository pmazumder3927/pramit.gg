import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getAccessToken } from "@/app/lib/spotify";

type SpotifyPlaylistItem = {
  id: string;
  name: string;
  description: string | null;
  images: Array<{ url: string }>;
  external_urls?: { spotify?: string };
  tracks?: { total?: number };
  owner?: { id?: string; display_name?: string | null };
  public?: boolean;
  snapshot_id?: string | null;
};

async function spotifyFetch<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Spotify request failed");
  }

  return (await response.json()) as T;
}

async function fetchCurrentUserId(accessToken: string) {
  const payload = await spotifyFetch<{ id: string }>(
    "https://api.spotify.com/v1/me",
    accessToken
  );
  return payload.id;
}

async function fetchOwnedPlaylists(accessToken: string, userId: string) {
  const playlists: SpotifyPlaylistItem[] = [];
  let nextUrl: string | null = "https://api.spotify.com/v1/me/playlists?limit=50";

  while (nextUrl) {
    const payload: {
      items: SpotifyPlaylistItem[];
      next: string | null;
    } = await spotifyFetch(nextUrl, accessToken);

    playlists.push(
      ...payload.items.filter((playlist: SpotifyPlaylistItem) => playlist.owner?.id === userId)
    );
    nextUrl = payload.next;
  }

  return playlists;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const accessToken = await getAccessToken();
    const userId = await fetchCurrentUserId(accessToken);
    const ownedPlaylists = await fetchOwnedPlaylists(accessToken, userId);

    const admin = createAdminClient();
    const playlistIds = ownedPlaylists.map((playlist) => playlist.id);
    const { data: sequenceRows } = playlistIds.length
      ? await admin
          .from("spotify_playlist_sequences")
          .select("playlist_id, last_generated_at, last_applied_at, updated_at")
          .in("playlist_id", playlistIds)
      : { data: [] as any[] };

    const sequenceMap = new Map(
      (sequenceRows || []).map((row: any) => [row.playlist_id as string, row])
    );

    const playlists = ownedPlaylists
      .map((playlist) => {
        const sequence = sequenceMap.get(playlist.id);
        return {
          id: playlist.id,
          name: playlist.name,
          description: playlist.description,
          imageUrl: playlist.images?.[0]?.url || null,
          playlistUrl: playlist.external_urls?.spotify || null,
          owner: playlist.owner?.display_name || null,
          public: Boolean(playlist.public),
          trackCount: playlist.tracks?.total || 0,
          snapshotId: playlist.snapshot_id || null,
          hasSequence: Boolean(sequence),
          lastSequencedAt: sequence?.updated_at || null,
          lastAppliedAt: sequence?.last_applied_at || null,
        };
      })
      .sort((a, b) => {
        if (a.hasSequence !== b.hasSequence) return a.hasSequence ? -1 : 1;
        if (a.public !== b.public) return a.public ? 1 : -1;
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json({ playlists });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load playlists";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
