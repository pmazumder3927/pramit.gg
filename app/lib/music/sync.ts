import "server-only";

import { createAdminClient } from "@/utils/supabase/admin";
import {
  chunk,
  fetchMe,
  fetchOwnedPlaylists,
  fetchPlaylistTracks,
  fetchRecentlyPlayed,
  fetchSavedTracks,
  fetchTopTracks,
  mapLimit,
  type SpotifyPlaylist,
  type SpotifyTrack,
} from "./spotify-api";
import { getSetting, setSetting } from "./settings";

const SYNC_TTL_MS = 1000 * 60 * 20;

const GRAVEYARD_NAME = /^(\d{4}) graveyard$/i;

export type SyncResult = {
  syncedAt: string;
  tracks: number;
  playlists: number;
  revived: number;
};

function nowIso() {
  return new Date().toISOString();
}

function classify(
  playlist: SpotifyPlaylist,
  inboxId: string | null
): { role: "shelf" | "graveyard" | "inbox"; year: number | null } {
  const match = GRAVEYARD_NAME.exec(playlist.name.trim());
  if (match) return { role: "graveyard", year: Number(match[1]) };
  if (inboxId && playlist.id === inboxId) return { role: "inbox", year: null };
  return { role: "shelf", year: null };
}

function releaseYear(track: SpotifyTrack): number | null {
  const raw = track.album?.release_date;
  if (!raw) return null;
  const year = Number(raw.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function flatten(track: SpotifyTrack) {
  return {
    track_id: track.id!,
    uri: track.uri || null,
    title: track.name,
    artist_names: track.artists.map((a) => a.name),
    artist_ids: track.artists.map((a) => a.id).filter(Boolean) as string[],
    artist_display: track.artists.map((a) => a.name).join(", "),
    album_name: track.album?.name || null,
    album_id: track.album?.id || null,
    album_image_url: track.album?.images?.[0]?.url || null,
    release_year: releaseYear(track),
    duration_ms: track.duration_ms,
    popularity: track.popularity,
    explicit: Boolean(track.explicit),
    song_url: track.external_urls?.spotify || null,
  };
}

/**
 * Pull the whole library into Postgres.
 *
 * The one rule that matters: a `retired` track is never brought back by sync
 * alone. It returns only if the owner themself re-liked it or filed it into a
 * shelf playlist on Spotify — an unambiguous "I want this back". Graveyard
 * playlists are read purely to reconcile the mirror, never as a source of
 * membership, so a song can no longer bounce between triage and the grave.
 */
export async function syncLibrary(options?: { force?: boolean }): Promise<SyncResult> {
  const supabase = createAdminClient();
  const last = await getSetting<{ at?: string }>("last_sync");

  if (
    !options?.force &&
    last?.at &&
    Date.now() - new Date(last.at).getTime() < SYNC_TTL_MS
  ) {
    const { count: trackCount } = await supabase
      .from("music_tracks")
      .select("track_id", { count: "exact", head: true });
    const { count: playlistCount } = await supabase
      .from("music_playlists")
      .select("playlist_id", { count: "exact", head: true })
      .eq("active", true);
    return {
      syncedAt: last.at,
      tracks: trackCount ?? 0,
      playlists: playlistCount ?? 0,
      revived: 0,
    };
  }

  const inbox = await getSetting<{ id?: string }>("suggestions_playlist");
  const me = await fetchMe();

  const [saved, owned, recent, topShort, topMedium, topLong] = await Promise.all([
    fetchSavedTracks(),
    fetchOwnedPlaylists(me.id),
    fetchRecentlyPlayed().catch(() => []),
    fetchTopTracks("short_term").catch(() => []),
    fetchTopTracks("medium_term").catch(() => []),
    fetchTopTracks("long_term").catch(() => []),
  ]);

  // Spotify occasionally answers a 200 with an empty collection. Reconciling
  // against that would unlike the entire library, so refuse instead.
  if (saved.length === 0 || owned.length === 0) {
    const { count } = await supabase
      .from("music_tracks")
      .select("track_id", { count: "exact", head: true });
    if ((count ?? 0) > 0) {
      throw new Error(
        "Spotify returned an empty library; refusing to sync over real data."
      );
    }
  }

  const classified = owned.map((playlist) => ({
    playlist,
    ...classify(playlist, inbox?.id ?? null),
  }));

  const shelfPlaylists = classified.filter((p) => p.role === "shelf");
  const graveyardPlaylists = classified.filter((p) => p.role === "graveyard");

  // ---- playlists -----------------------------------------------------------
  await supabase.from("music_playlists").upsert(
    classified.map(({ playlist, role, year }) => ({
      playlist_id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      image_url: playlist.images?.[0]?.url || null,
      url: playlist.external_urls?.spotify || null,
      is_public: Boolean(playlist.public),
      track_count: playlist.tracks?.total || 0,
      snapshot_id: playlist.snapshot_id || null,
      role,
      graveyard_year: year,
      active: true,
      last_synced_at: nowIso(),
    })),
    { onConflict: "playlist_id" }
  );

  const liveIds = new Set(classified.map((c) => c.playlist.id));
  const { data: knownPlaylists } = await supabase
    .from("music_playlists")
    .select("playlist_id")
    .eq("active", true);
  const goneIds = (knownPlaylists || [])
    .map((row) => row.playlist_id as string)
    .filter((id) => !liveIds.has(id));
  if (goneIds.length > 0) {
    await supabase
      .from("music_playlists")
      .update({ active: false })
      .in("playlist_id", goneIds);
  }

  // ---- tracks --------------------------------------------------------------
  const tracks = new Map<string, ReturnType<typeof flatten>>();
  const likedAt = new Map<string, string>();

  for (const item of saved) {
    if (!item.track?.id) continue;
    tracks.set(item.track.id, flatten(item.track));
    likedAt.set(item.track.id, item.added_at);
  }

  const shelfMembership = new Map<
    string,
    Array<{ track_id: string; position: number; added_at: string | null }>
  >();

  const shelfContents = await mapLimit(shelfPlaylists, 4, async ({ playlist }) => {
    const items = await fetchPlaylistTracks(playlist.id);
    return { playlistId: playlist.id, items };
  });

  for (const { playlistId, items } of shelfContents) {
    const rows: Array<{ track_id: string; position: number; added_at: string | null }> = [];
    const seen = new Set<string>();
    items.forEach((item, index) => {
      if (!item.track?.id) return;
      if (!tracks.has(item.track.id)) tracks.set(item.track.id, flatten(item.track));
      if (seen.has(item.track.id)) return;
      seen.add(item.track.id);
      rows.push({ track_id: item.track.id, position: index, added_at: item.added_at });
    });
    shelfMembership.set(playlistId, rows);
  }

  const graveyardContents = await mapLimit(
    graveyardPlaylists,
    3,
    async ({ playlist, year }) => {
      const items = await fetchPlaylistTracks(playlist.id);
      return { playlistId: playlist.id, year, items };
    }
  );

  const inGraveyardPlaylist = new Map<string, number | null>();
  for (const { year, items } of graveyardContents) {
    for (const item of items) {
      if (!item.track?.id) continue;
      if (!tracks.has(item.track.id)) tracks.set(item.track.id, flatten(item.track));
      if (!inGraveyardPlaylist.has(item.track.id)) {
        inGraveyardPlaylist.set(item.track.id, year);
      }
    }
  }

  // affinity: rank across the three time ranges, best rank wins
  const affinity = new Map<string, number>();
  const applyTop = (items: SpotifyTrack[], weight: number) => {
    items.forEach((track, index) => {
      if (!track.id) return;
      const score = weight * (1 - index / Math.max(items.length, 1));
      affinity.set(track.id, Math.max(affinity.get(track.id) ?? 0, score));
    });
  };
  applyTop(topLong, 1);
  applyTop(topMedium, 0.92);
  applyTop(topShort, 0.85);

  const playedAt = new Map<string, string>();
  for (const item of recent) {
    if (!item.track?.id) continue;
    const known = playedAt.get(item.track.id);
    if (!known || new Date(item.played_at) > new Date(known)) {
      playedAt.set(item.track.id, item.played_at);
    }
  }

  const { data: existing } = await supabase
    .from("music_tracks")
    .select("track_id, shelf, retired_at, last_played_at, affinity");
  const existingById = new Map(
    (existing || []).map((row) => [row.track_id as string, row])
  );

  const filedTrackIds = new Set<string>();
  for (const rows of Array.from(shelfMembership.values())) {
    for (const row of rows) filedTrackIds.add(row.track_id);
  }

  let revived = 0;
  const trackRows = Array.from(tracks.values()).map((base) => {
    const prior = existingById.get(base.track_id);
    const liked = likedAt.has(base.track_id);
    const filed = filedTrackIds.has(base.track_id);

    // The only way out of the graveyard without an explicit revive: the owner
    // put it back themself, in Spotify.
    let shelf: "active" | "retired" = (prior?.shelf as "active" | "retired") || "active";
    let retiredAt = (prior?.retired_at as string | null) ?? null;

    if (shelf === "retired" && (liked || filed)) {
      shelf = "active";
      retiredAt = null;
      revived++;
    } else if (!prior && inGraveyardPlaylist.has(base.track_id) && !liked && !filed) {
      // First sight of a song that only exists in a graveyard mirror.
      shelf = "retired";
      const year = inGraveyardPlaylist.get(base.track_id);
      retiredAt = year ? new Date(Date.UTC(year, 0, 1)).toISOString() : nowIso();
    }

    return {
      ...base,
      liked,
      liked_at: likedAt.get(base.track_id) || null,
      last_played_at:
        playedAt.get(base.track_id) || (prior?.last_played_at as string | null) || null,
      affinity: affinity.get(base.track_id) ?? (prior?.affinity as number | null) ?? null,
      shelf,
      retired_at: retiredAt,
      last_synced_at: nowIso(),
    };
  });

  for (const batch of chunk(trackRows, 400)) {
    const { error } = await supabase
      .from("music_tracks")
      .upsert(batch, { onConflict: "track_id" });
    if (error) throw new Error(`music_tracks upsert failed: ${error.message}`);
  }

  // Anything we previously knew as liked but Spotify no longer returns.
  const seenIds = new Set(tracks.keys());
  const staleLiked = (existing || [])
    .map((row) => row.track_id as string)
    .filter((id) => !seenIds.has(id));
  if (staleLiked.length > 0) {
    for (const batch of chunk(staleLiked, 400)) {
      await supabase
        .from("music_tracks")
        .update({ liked: false, last_synced_at: nowIso() })
        .in("track_id", batch);
    }
  }

  // ---- memberships ---------------------------------------------------------
  // Rebuilt per playlist so a failure can only affect the playlist it was on.
  for (const [playlistId, rows] of Array.from(shelfMembership.entries())) {
    await supabase.from("music_playlist_tracks").delete().eq("playlist_id", playlistId);
    if (rows.length === 0) continue;
    for (const batch of chunk(rows, 500)) {
      const { error } = await supabase
        .from("music_playlist_tracks")
        .insert(batch.map((row) => ({ ...row, playlist_id: playlistId })));
      if (error) {
        throw new Error(`membership insert failed for ${playlistId}: ${error.message}`);
      }
    }
  }
  // Graveyard/inbox playlists hold no membership rows at all — that is the
  // whole point: they can never be a filing destination.
  const nonShelfIds = classified
    .filter((c) => c.role !== "shelf")
    .map((c) => c.playlist.id);
  if (nonShelfIds.length > 0) {
    await supabase.from("music_playlist_tracks").delete().in("playlist_id", nonShelfIds);
  }

  const syncedAt = nowIso();
  await setSetting("last_sync", { at: syncedAt });
  await setSetting(
    "graveyard_playlists",
    Object.fromEntries(
      graveyardPlaylists
        .filter((p) => p.year)
        .map((p) => [String(p.year), p.playlist.id])
    )
  );

  return {
    syncedAt,
    tracks: trackRows.length,
    playlists: shelfPlaylists.length,
    revived,
  };
}
