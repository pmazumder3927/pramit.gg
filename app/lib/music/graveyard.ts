import "server-only";

import { createAdminClient } from "@/utils/supabase/admin";
import { api, chunk, fetchPlaylistTracks } from "./spotify-api";
import { getSetting } from "./settings";

/**
 * Push the graveyard out to Spotify.
 *
 * One direction only. The DB decides who is retired; the year playlists are a
 * mirror of that decision. Reading the mirror back as a source of truth is
 * exactly the loop that used to drag retired songs into triage, so this never
 * does it — it only adds what's missing and removes what's no longer retired.
 */
export async function mirrorGraveyard(options?: { dryRun?: boolean }): Promise<{
  added: number;
  removed: number;
  dryRun: boolean;
}> {
  const supabase = createAdminClient();
  const mapping = (await getSetting<Record<string, string>>("graveyard_playlists")) || {};

  const { data: retired } = await supabase
    .from("music_tracks")
    .select("track_id, uri, retired_at")
    .eq("shelf", "retired");

  const wanted = new Map<number, Set<string>>();
  for (const row of retired || []) {
    const year = row.retired_at
      ? new Date(row.retired_at as string).getUTCFullYear()
      : new Date().getUTCFullYear();
    const set = wanted.get(year) || new Set<string>();
    set.add((row.uri as string) || `spotify:track:${row.track_id}`);
    wanted.set(year, set);
  }

  let added = 0;
  let removed = 0;

  for (const [year, playlistId] of Object.entries(mapping)) {
    const target = wanted.get(Number(year)) || new Set<string>();
    const items = await fetchPlaylistTracks(playlistId);
    const live = new Set(
      items.map((item) => item.track?.uri).filter(Boolean) as string[]
    );

    const toAdd = Array.from(target).filter((uri) => !live.has(uri));
    const toRemove = Array.from(live).filter((uri) => !target.has(uri));

    added += toAdd.length;
    removed += toRemove.length;

    // Removing is the destructive half — the caller asks what would happen
    // before it happens, and the page shows the number.
    if (options?.dryRun) continue;

    for (const batch of chunk(toAdd, 100)) {
      await api(`/playlists/${playlistId}/tracks`, {
        method: "POST",
        body: JSON.stringify({ uris: batch }),
      });
    }

    for (const batch of chunk(toRemove, 100)) {
      await api(`/playlists/${playlistId}/tracks`, {
        method: "DELETE",
        body: JSON.stringify({ tracks: batch.map((uri) => ({ uri })) }),
      });
    }

    await supabase
      .from("music_playlists")
      .update({ track_count: target.size, last_synced_at: new Date().toISOString() })
      .eq("playlist_id", playlistId);
  }

  return { added, removed, dryRun: Boolean(options?.dryRun) };
}
