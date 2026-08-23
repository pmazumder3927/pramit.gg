import "server-only";

import { createAdminClient } from "@/utils/supabase/admin";
import type { Decision } from "@/app/music/manage/lib/types";
import { api, fetchMe, mapLimit } from "./spotify-api";
import { getSetting, setSetting } from "./settings";

export type DecisionOutcome = {
  applied: number;
  failures: Array<{ trackId: string; error: string }>;
};

function nowIso() {
  return new Date().toISOString();
}

/**
 * Find-or-create this year's graveyard mirror. It is created **private** and is
 * tagged role='graveyard' the moment it exists, so it can never be offered as a
 * filing destination, never shows up on the public /music page, and never gets
 * imported back as a source of membership.
 */
export async function ensureGraveyardPlaylist(year: number): Promise<string> {
  const supabase = createAdminClient();
  const mapping = (await getSetting<Record<string, string>>("graveyard_playlists")) || {};
  const known = mapping[String(year)];
  if (known) return known;

  const me = await fetchMe();
  const created = await api<{ id: string; external_urls?: { spotify?: string } }>(
    `/users/${me.id}/playlists`,
    {
      method: "POST",
      body: JSON.stringify({
        name: `${year} graveyard`,
        description: `Songs that stopped being mine in ${year}.`,
        public: false,
      }),
    }
  );

  await supabase.from("music_playlists").upsert(
    {
      playlist_id: created.id,
      name: `${year} graveyard`,
      url: created.external_urls?.spotify || null,
      is_public: false,
      role: "graveyard",
      graveyard_year: year,
      hidden: true,
      active: true,
      last_synced_at: nowIso(),
    },
    { onConflict: "playlist_id" }
  );

  await setSetting("graveyard_playlists", { ...mapping, [String(year)]: created.id });
  return created.id;
}

async function likeOnSpotify(trackId: string, liked: boolean) {
  await api(`/me/tracks?ids=${encodeURIComponent(trackId)}`, {
    method: liked ? "PUT" : "DELETE",
  });
}

async function addToPlaylist(playlistId: string, uri: string) {
  await api(`/playlists/${playlistId}/tracks`, {
    method: "POST",
    body: JSON.stringify({ uris: [uri] }),
  });
}

async function removeFromPlaylist(playlistId: string, uri: string) {
  await api(`/playlists/${playlistId}/tracks`, {
    method: "DELETE",
    body: JSON.stringify({ tracks: [{ uri }] }),
  });
}

/**
 * Apply a batch of triage decisions.
 *
 * Deliberately returns nothing but a count: the old endpoint rebuilt and
 * re-ranked the entire 1000-track library on every single swipe, which is what
 * made the deck feel like wading. The client already knows what it decided.
 */
export async function applyDecisions(decisions: Decision[]): Promise<DecisionOutcome> {
  const supabase = createAdminClient();
  const failures: DecisionOutcome["failures"] = [];
  if (decisions.length === 0) return { applied: 0, failures };

  const trackIds = Array.from(new Set(decisions.map((d) => d.trackId)));
  const [{ data: trackRows }, { data: membershipRows }, { data: playlistRows }] =
    await Promise.all([
      supabase
        .from("music_tracks")
        .select("track_id, uri, liked, shelf")
        .in("track_id", trackIds),
      supabase
        .from("music_playlist_tracks")
        .select("track_id, playlist_id")
        .in("track_id", trackIds),
      supabase
        .from("music_playlists")
        .select("playlist_id, role")
        .eq("active", true),
    ]);

  const tracks = new Map((trackRows || []).map((row) => [row.track_id as string, row]));
  const shelfRoles = new Map(
    (playlistRows || []).map((row) => [row.playlist_id as string, row.role as string])
  );
  // Only shelf playlists are ours to change. A membership row pointing at the
  // visitor-suggestion inbox, or at a playlist that has since been unfollowed,
  // must never end up in a remove list.
  const current = new Map<string, Set<string>>();
  for (const row of membershipRows || []) {
    if (shelfRoles.get(row.playlist_id as string) !== "shelf") continue;
    const set = current.get(row.track_id as string) || new Set<string>();
    set.add(row.playlist_id as string);
    current.set(row.track_id as string, set);
  }

  const graveyardIds = Object.values(
    (await getSetting<Record<string, string>>("graveyard_playlists")) || {}
  );

  // Resolved once, before anything runs concurrently. Called from inside the
  // loop it would race itself on the first retire of a new year: five workers
  // all read an empty mapping and each create their own "2027 graveyard".
  const mirrorId = decisions.some((decision) => decision.verb === "retire")
    ? await ensureGraveyardPlaylist(new Date().getUTCFullYear())
    : null;

  let applied = 0;

  await mapLimit(decisions, 5, async (decision) => {
    const track = tracks.get(decision.trackId);
    if (!track) {
      failures.push({ trackId: decision.trackId, error: "unknown track" });
      return;
    }
    const uri = (track.uri as string) || `spotify:track:${decision.trackId}`;
    const now = new Set(current.get(decision.trackId) || []);

    try {
      if (decision.verb === "keep") {
        await supabase
          .from("music_tracks")
          .update({ reviewed_at: nowIso() })
          .eq("track_id", decision.trackId);
      }

      if (decision.verb === "file") {
        // A graveyard or inbox playlist is never a valid destination.
        const target = new Set(
          (decision.playlistIds || []).filter(
            (id) => shelfRoles.get(id) === "shelf"
          )
        );

        // Three-way merge against what the card was showing. A deck can sit
        // open for hours; without this, filing a track into one playlist would
        // quietly pull it out of any other it had joined in the meantime,
        // because the client's list is the only thing the old code compared to.
        const known = decision.knownPlaylistIds
          ? new Set(decision.knownPlaylistIds)
          : now;

        const add = Array.from(target).filter((id) => !now.has(id));
        const remove = Array.from(now).filter(
          (id) => !target.has(id) && known.has(id)
        );

        // Adds land first: if anything fails, the song is in one playlist too
        // many rather than one too few.
        for (const id of add) await addToPlaylist(id, uri);
        await Promise.all([
          ...remove.map((id) => removeFromPlaylist(id, uri)),
          track.liked ? Promise.resolve() : likeOnSpotify(decision.trackId, true),
        ]);

        if (remove.length > 0) {
          await supabase
            .from("music_playlist_tracks")
            .delete()
            .eq("track_id", decision.trackId)
            .in("playlist_id", remove);
        }
        if (add.length > 0) {
          await supabase.from("music_playlist_tracks").upsert(
            add.map((id) => ({
              playlist_id: id,
              track_id: decision.trackId,
              position: 9999,
              added_at: nowIso(),
            })),
            { onConflict: "playlist_id,track_id" }
          );
        }
        await supabase
          .from("music_tracks")
          .update({ liked: true, reviewed_at: nowIso() })
          .eq("track_id", decision.trackId);
      }

      if (decision.verb === "retire") {
        // The archive copy is written before the song is taken out of anything.
        // Issued together, a failure to reach the graveyard still left the
        // removals and the unlike applied, and Spotify has no undo for either.
        if (!mirrorId) throw new Error("no graveyard to retire into");
        await addToPlaylist(mirrorId, uri);

        await Promise.all([
          ...Array.from(now).map((id) => removeFromPlaylist(id, uri)),
          track.liked ? likeOnSpotify(decision.trackId, false) : Promise.resolve(),
        ]);

        await supabase
          .from("music_playlist_tracks")
          .delete()
          .eq("track_id", decision.trackId);
        await supabase
          .from("music_tracks")
          .update({
            liked: false,
            shelf: "retired",
            retired_at: nowIso(),
            reviewed_at: nowIso(),
          })
          .eq("track_id", decision.trackId);
      }

      if (decision.verb === "revive") {
        await Promise.all([
          likeOnSpotify(decision.trackId, true),
          ...graveyardIds.map((id) =>
            removeFromPlaylist(id, uri).catch(() => {
              // it only lives in one year's mirror; the others 200 anyway
            })
          ),
        ]);
        await supabase
          .from("music_tracks")
          .update({
            liked: true,
            shelf: "active",
            retired_at: null,
            reviewed_at: nowIso(),
          })
          .eq("track_id", decision.trackId);
      }

      await supabase.from("music_decisions").insert({
        track_id: decision.trackId,
        verb: decision.verb,
        before: {
          liked: track.liked,
          shelf: track.shelf,
          playlistIds: Array.from(now),
        },
        after: { playlistIds: decision.playlistIds || Array.from(now) },
      });

      applied++;
    } catch (error) {
      failures.push({
        trackId: decision.trackId,
        error: error instanceof Error ? error.message : "failed",
      });
    }
  });

  return { applied, failures };
}
