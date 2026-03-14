import "server-only";

import { createAdminClient } from "@/utils/supabase/admin";
import { getAccessToken } from "@/app/lib/spotify";
import type {
  ReviewActionInput,
  ReviewBucket,
  ReviewQueueSnapshot,
  ReviewTrack,
} from "@/app/music/lib/review-types";

const FULL_SYNC_INTERVAL_MS = 1000 * 60 * 60 * 6;

type SpotifyImage = { url: string };

type SpotifyTrackPayload = {
  id: string;
  uri: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: SpotifyImage[] };
  duration_ms: number;
  popularity: number;
  preview_url: string | null;
  explicit: boolean;
  external_urls?: { spotify?: string };
};

type TrackAccumulator = {
  track_id: string;
  spotify_uri: string | null;
  title: string;
  artist_names: string[];
  artist_display: string;
  album_name: string | null;
  album_image_url: string | null;
  preview_url: string | null;
  song_url: string | null;
  duration_ms: number | null;
  popularity: number | null;
  explicit: boolean;
  is_liked: boolean;
  added_to_liked_at: string | null;
  last_played_at: string | null;
  bucketIds: Set<string>;
};

type SyncRow = {
  scope: string;
  status: "idle" | "running" | "error";
  last_started_at: string | null;
  last_completed_at: string | null;
  last_error: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function differenceInDays(date: string | null | undefined) {
  if (!date) return null;
  const diffMs = Date.now() - new Date(date).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function addDays(days: number) {
  const at = new Date();
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

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
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

function simplifyTrack(track: SpotifyTrackPayload | null | undefined) {
  if (!track?.id) {
    return null;
  }

  return {
    track_id: track.id,
    spotify_uri: track.uri || null,
    title: track.name,
    artist_names: track.artists.map((artist) => artist.name),
    artist_display: track.artists.map((artist) => artist.name).join(", "),
    album_name: track.album?.name || null,
    album_image_url: track.album?.images?.[0]?.url || null,
    preview_url: track.preview_url || null,
    song_url: track.external_urls?.spotify || null,
    duration_ms: track.duration_ms || null,
    popularity: track.popularity ?? null,
    explicit: Boolean(track.explicit),
  };
}

function normalizeSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

async function fetchCurrentUser() {
  return spotifyFetch<{ id: string; display_name?: string }>("/me");
}

async function fetchSavedTracks() {
  const items: Array<{ added_at: string; track: SpotifyTrackPayload }> = [];
  let offset = 0;

  while (true) {
    const data = await spotifyFetch<{
      items: Array<{ added_at: string; track: SpotifyTrackPayload }>;
      next: string | null;
    }>(`/me/tracks?limit=50&offset=${offset}`);

    items.push(...data.items);

    if (!data.next) {
      break;
    }

    offset += 50;
  }

  return items;
}

async function fetchOwnedPlaylists(userId: string) {
  const items: Array<{
    id: string;
    name: string;
    description: string | null;
    images: SpotifyImage[];
    external_urls?: { spotify?: string };
    tracks?: { total?: number };
    owner?: { id?: string; display_name?: string };
    public?: boolean;
  }> = [];
  let offset = 0;

  while (true) {
    const data = await spotifyFetch<{
      items: Array<{
        id: string;
        name: string;
        description: string | null;
        images: SpotifyImage[];
        external_urls?: { spotify?: string };
        tracks?: { total?: number };
        owner?: { id?: string; display_name?: string };
        public?: boolean;
      }>;
      next: string | null;
    }>(`/me/playlists?limit=50&offset=${offset}`);

    items.push(...data.items.filter((playlist) => playlist.owner?.id === userId));

    if (!data.next) {
      break;
    }

    offset += 50;
  }

  return items;
}

async function fetchPlaylistTracks(playlistId: string) {
  const items: Array<{ added_at: string; track: SpotifyTrackPayload | null }> = [];
  let offset = 0;

  while (true) {
    const data = await spotifyFetch<{
      items: Array<{ added_at: string; track: SpotifyTrackPayload | null }>;
      next: string | null;
    }>(
      `/playlists/${playlistId}/tracks?limit=100&offset=${offset}&fields=items(added_at,track(id,uri,name,artists(name),album(name,images),duration_ms,popularity,preview_url,explicit,external_urls)),next`
    );

    items.push(...data.items);

    if (!data.next) {
      break;
    }

    offset += 100;
  }

  return items;
}

async function fetchRecentlyPlayed() {
  return spotifyFetch<{
    items: Array<{ played_at: string; track: SpotifyTrackPayload }>;
  }>("/me/player/recently-played?limit=50");
}

async function updateSyncState(
  scope: string,
  values: Partial<{
    status: "idle" | "running" | "error";
    last_started_at: string | null;
    last_completed_at: string | null;
    last_error: string | null;
    metadata: Record<string, unknown>;
  }>
) {
  const supabase = createAdminClient();
  await supabase.from("spotify_review_sync_state").upsert(
    {
      scope,
      ...values,
    },
    { onConflict: "scope" }
  );
}

async function getFullSyncState(): Promise<SyncRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("spotify_review_sync_state")
    .select("scope, status, last_started_at, last_completed_at, last_error")
    .eq("scope", "full")
    .single();

  return data as SyncRow | null;
}

function shouldSync(syncState: SyncRow | null, forceSync: boolean) {
  if (forceSync) return true;
  if (!syncState?.last_completed_at) return true;
  return (
    Date.now() - new Date(syncState.last_completed_at).getTime() >
    FULL_SYNC_INTERVAL_MS
  );
}

async function syncLibrary(forceSync = false) {
  const syncState = await getFullSyncState();
  if (!shouldSync(syncState, forceSync)) {
    return syncState;
  }

  await updateSyncState("full", {
    status: "running",
    last_started_at: nowIso(),
    last_error: null,
  });

  try {
    const supabase = createAdminClient();
    const [currentUser, savedTracks, recentPlays] = await Promise.all([
      fetchCurrentUser(),
      fetchSavedTracks(),
      fetchRecentlyPlayed(),
    ]);
    const playlists = await fetchOwnedPlaylists(currentUser.id);

    const { data: existingTracks } = await supabase
      .from("spotify_review_tracks")
      .select("track_id, last_played_at, removed_from_liked_at");

    const existingTrackMap = new Map(
      (existingTracks || []).map((track) => [track.track_id as string, track])
    );

    const buckets = playlists.map((playlist) => ({
      bucket_id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      image_url: playlist.images?.[0]?.url || null,
      playlist_url: playlist.external_urls?.spotify || null,
      owner_name: playlist.owner?.display_name || currentUser.display_name || null,
      is_public: Boolean(playlist.public),
      track_count: playlist.tracks?.total || 0,
      follower_count: 0,
      is_active: true,
      last_synced_at: nowIso(),
    }));

    if (buckets.length > 0) {
      await supabase
        .from("spotify_review_buckets")
        .upsert(buckets, { onConflict: "bucket_id" });
    }

    const { data: existingBuckets } = await supabase
      .from("spotify_review_buckets")
      .select("bucket_id")
      .eq("is_active", true);
    const activeBucketIds = new Set(buckets.map((bucket) => bucket.bucket_id));
    const removedBucketIds = (existingBuckets || [])
      .map((bucket) => bucket.bucket_id as string)
      .filter((bucketId) => !activeBucketIds.has(bucketId));

    if (removedBucketIds.length > 0) {
      await supabase
        .from("spotify_review_buckets")
        .update({ is_active: false, last_synced_at: nowIso() })
        .in("bucket_id", removedBucketIds);
    }

    const trackMap = new Map<string, TrackAccumulator>();
    const likedTrackIds = new Set<string>();
    const recentPlayMap = new Map<string, string>();

    for (const item of savedTracks) {
      const base = simplifyTrack(item.track);
      if (!base) continue;

      likedTrackIds.add(base.track_id);
      trackMap.set(base.track_id, {
        ...base,
        is_liked: true,
        added_to_liked_at: item.added_at,
        last_played_at: null,
        bucketIds: trackMap.get(base.track_id)?.bucketIds || new Set<string>(),
      });
    }

    for (const item of recentPlays.items) {
      if (!item.track?.id) continue;
      const known = recentPlayMap.get(item.track.id);
      if (!known || new Date(item.played_at) > new Date(known)) {
        recentPlayMap.set(item.track.id, item.played_at);
      }
    }

    for (const playlist of playlists) {
      const items = await fetchPlaylistTracks(playlist.id);

      for (const item of items) {
        const base = simplifyTrack(item.track);
        if (!base) continue;

        const existing = trackMap.get(base.track_id);
        trackMap.set(base.track_id, {
          ...base,
          is_liked: existing?.is_liked || false,
          added_to_liked_at: existing?.added_to_liked_at || null,
          last_played_at: existing?.last_played_at || null,
          bucketIds: existing?.bucketIds || new Set<string>(),
        });
        trackMap.get(base.track_id)?.bucketIds.add(playlist.id);
      }
    }

    const tracks = Array.from(trackMap.values()).map((track) => ({
      track_id: track.track_id,
      spotify_uri: track.spotify_uri,
      title: track.title,
      artist_names: track.artist_names,
      artist_display: track.artist_display,
      album_name: track.album_name,
      album_image_url: track.album_image_url,
      preview_url: track.preview_url,
      song_url: track.song_url,
      duration_ms: track.duration_ms,
      popularity: track.popularity,
      explicit: track.explicit,
      is_liked: track.is_liked,
      added_to_liked_at: track.added_to_liked_at,
      removed_from_liked_at: track.is_liked
        ? null
        : existingTrackMap.get(track.track_id)?.removed_from_liked_at || nowIso(),
      last_synced_at: nowIso(),
      last_played_at:
        recentPlayMap.get(track.track_id) ||
        existingTrackMap.get(track.track_id)?.last_played_at ||
        null,
      source_snapshot: {
        bucket_ids: Array.from(track.bucketIds),
      },
    }));

    if (tracks.length > 0) {
      await supabase
        .from("spotify_review_tracks")
        .upsert(tracks, { onConflict: "track_id" });

      await supabase
        .from("spotify_review_state")
        .upsert(
          tracks.map((track) => ({
            track_id: track.track_id,
            next_review_at: track.added_to_liked_at || nowIso(),
          })),
          { onConflict: "track_id", ignoreDuplicates: true }
        );
    }

    const { data: existingLiked } = await supabase
      .from("spotify_review_tracks")
      .select("track_id")
      .eq("is_liked", true);

    const removedLikedIds = (existingLiked || [])
      .map((row) => row.track_id as string)
      .filter((trackId) => !likedTrackIds.has(trackId));

    if (removedLikedIds.length > 0) {
      await supabase
        .from("spotify_review_tracks")
        .update({
          is_liked: false,
          removed_from_liked_at: nowIso(),
          last_synced_at: nowIso(),
        })
        .in("track_id", removedLikedIds);
    }

    const bucketIds = playlists.map((playlist) => playlist.id);

    if (bucketIds.length > 0) {
      await supabase
        .from("spotify_review_track_buckets")
        .update({
          active: false,
          removed_at: nowIso(),
        })
        .in("bucket_id", bucketIds);
    } else {
      await supabase
        .from("spotify_review_track_buckets")
        .update({
          active: false,
          removed_at: nowIso(),
        })
        .eq("active", true);
    }

    const membershipRows = Array.from(trackMap.values()).flatMap((track) =>
      Array.from(track.bucketIds).map((bucketId) => ({
        track_id: track.track_id,
        bucket_id: bucketId,
        active: true,
        removed_at: null,
      }))
    );

    if (membershipRows.length > 0) {
      await supabase
        .from("spotify_review_track_buckets")
        .upsert(membershipRows, { onConflict: "track_id,bucket_id" });
    }

    for (const [trackId, playedAt] of Array.from(recentPlayMap.entries())) {
      await supabase
        .from("spotify_review_track_buckets")
        .update({
          last_played_since_assignment_at: playedAt,
        })
        .eq("track_id", trackId)
        .eq("active", true);
    }

    await updateSyncState("full", {
      status: "idle",
      last_completed_at: nowIso(),
      last_error: null,
      metadata: {
        track_count: tracks.length,
        bucket_count: buckets.length,
      },
    });

    return await getFullSyncState();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync failure";
    await updateSyncState("full", {
      status: "error",
      last_error: message,
      last_completed_at: nowIso(),
    });
    throw error;
  }
}

function buildReasons(params: {
  neverReviewed: boolean;
  addedRecently: boolean;
  daysSinceListen: number | null;
  bucketCount: number;
  overdueDays: number;
  unplayedMemberships: number;
  deferCount: number;
  unsureCount: number;
  isLiked: boolean;
}) {
  const reasons: string[] = [];

  if (params.neverReviewed) reasons.push("never reviewed");
  if (params.addedRecently) reasons.push("recently added");
  if ((params.daysSinceListen ?? 0) >= 90) reasons.push("forgotten for months");
  if (params.bucketCount >= 3) reasons.push("belongs to many buckets");
  if (params.unplayedMemberships > 0) reasons.push("bucket fit is unproven");
  if (params.deferCount > 0) reasons.push("deferred recently");
  if (params.unsureCount > 0) reasons.push("you were unsure last time");
  if (!params.isLiked) reasons.push("parked outside liked songs");
  if (params.overdueDays > 7) reasons.push("overdue for review");

  return reasons.slice(0, 4);
}

function rankTrack(
  row: any,
  buckets: ReviewBucket[]
): ReviewTrack {
  const state = normalizeSingleRelation(row.spotify_review_state) || {};
  const memberships = (row.spotify_review_track_buckets || []).filter(
    (membership: any) => membership.active
  );
  const activeBuckets = memberships
    .map((membership: any) => membership.spotify_review_buckets)
    .filter(Boolean)
    .map((bucket: any) => ({
      bucketId: bucket.bucket_id,
      name: bucket.name,
      description: bucket.description,
      imageUrl: bucket.image_url,
      playlistUrl: bucket.playlist_url,
      trackCount: bucket.track_count || 0,
      followerCount: bucket.follower_count || 0,
      isActive: bucket.is_active,
    })) as ReviewBucket[];

  const bucketCount = activeBuckets.length;
  const daysSinceListen = differenceInDays(row.last_played_at);
  const daysSinceReview = differenceInDays(state.last_reviewed_at);
  const overdueDays = state.next_review_at
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(state.next_review_at).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;
  const neverReviewed = !state.last_reviewed_at;
  const addedRecently = (differenceInDays(row.added_to_liked_at) ?? 999) <= 14;
  const unplayedMemberships = memberships.filter(
    (membership: any) => !membership.last_played_since_assignment_at
  ).length;

  let dueScore = 0;
  if (neverReviewed) dueScore += 35;
  dueScore += clamp(overdueDays * 2.8, 0, 35);
  if (addedRecently) dueScore += 18;
  if ((daysSinceListen ?? 0) >= 30) dueScore += clamp((daysSinceListen ?? 0) / 5, 0, 25);
  dueScore += bucketCount * 4;
  dueScore += unplayedMemberships * 6;
  dueScore += (state.defer_count || 0) * 6;
  dueScore += (state.unsure_count || 0) * 8;
  if (!row.is_liked) dueScore += 12;

  const suggestedBuckets = buckets
    .map((bucket) => {
      const alreadySelected = activeBuckets.some(
        (activeBucket) => activeBucket.bucketId === bucket.bucketId
      );
      let score = alreadySelected ? 100 : 0;
      if (!alreadySelected && row.artist_names?.length) {
        const nameMatch = row.artist_names.some((artist: string) =>
          bucket.name.toLowerCase().includes(artist.toLowerCase())
        );
        if (nameMatch) score += 8;
      }
      score += clamp(bucket.trackCount / 10, 0, 8);
      return {
        ...bucket,
        score,
        reason: alreadySelected
          ? "already assigned"
          : score >= 8
            ? "likely fit"
            : "available bucket",
      };
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 8);

  return {
    trackId: row.track_id,
    spotifyUri: row.spotify_uri,
    title: row.title,
    artistDisplay: row.artist_display,
    artistNames: row.artist_names || [],
    albumName: row.album_name,
    albumImageUrl: row.album_image_url,
    previewUrl: row.preview_url,
    songUrl: row.song_url,
    durationMs: row.duration_ms,
    popularity: row.popularity,
    explicit: Boolean(row.explicit),
    isLiked: Boolean(row.is_liked),
    addedToLikedAt: row.added_to_liked_at,
    removedFromLikedAt: row.removed_from_liked_at,
    lastPlayedAt: row.last_played_at,
    lastReviewedAt: state.last_reviewed_at || null,
    nextReviewAt: state.next_review_at || null,
    intervalDays: Number(state.interval_days || 7),
    easeFactor: Number(state.ease_factor || 2.3),
    reviewCount: state.review_count || 0,
    confirmStreak: state.confirm_streak || 0,
    deferCount: state.defer_count || 0,
    unsureCount: state.unsure_count || 0,
    surfacedCount: state.surfaced_count || 0,
    dueScore,
    overdueDays,
    daysSinceListen,
    daysSinceReview,
    activeBuckets,
    suggestedBuckets,
    reasons: buildReasons({
      neverReviewed,
      addedRecently,
      daysSinceListen,
      bucketCount,
      overdueDays,
      unplayedMemberships,
      deferCount: state.defer_count || 0,
      unsureCount: state.unsure_count || 0,
      isLiked: Boolean(row.is_liked),
    }),
  };
}

export async function getReviewQueue(options?: {
  forceSync?: boolean;
}): Promise<ReviewQueueSnapshot> {
  const forceSync = options?.forceSync || false;

  try {
    const syncState = await syncLibrary(forceSync);
    const supabase = createAdminClient();

    const [{ data: bucketRows }, { data: trackRows }] = await Promise.all([
      supabase
        .from("spotify_review_buckets")
        .select(
          "bucket_id, name, description, image_url, playlist_url, track_count, follower_count, is_active"
        )
        .eq("is_active", true)
        .order("name"),
      supabase.from("spotify_review_tracks").select(
        `
          track_id,
          spotify_uri,
          title,
          artist_names,
          artist_display,
          album_name,
          album_image_url,
          preview_url,
          song_url,
          duration_ms,
          popularity,
          explicit,
          is_liked,
          added_to_liked_at,
          removed_from_liked_at,
          last_played_at,
          spotify_review_state (
            review_count,
            confirm_streak,
            defer_count,
            unsure_count,
            surfaced_count,
            ease_factor,
            interval_days,
            next_review_at,
            last_reviewed_at
          ),
          spotify_review_track_buckets (
            active,
            last_played_since_assignment_at,
            spotify_review_buckets (
              bucket_id,
              name,
              description,
              image_url,
              playlist_url,
              track_count,
              follower_count,
              is_active
            )
          )
        `
      ),
    ]);

    const allBuckets: ReviewBucket[] = (bucketRows || []).map((bucket: any) => ({
      bucketId: bucket.bucket_id,
      name: bucket.name,
      description: bucket.description,
      imageUrl: bucket.image_url,
      playlistUrl: bucket.playlist_url,
      trackCount: bucket.track_count || 0,
      followerCount: bucket.follower_count || 0,
      isActive: bucket.is_active,
    }));

    const ranked = (trackRows || [])
      .map((row: any) => rankTrack(row, allBuckets))
      .filter((track) => track.activeBuckets.length > 0 || track.isLiked)
      .sort((a, b) => b.dueScore - a.dueScore);

    const currentTrack = ranked[0] || null;
    const upcoming = ranked.slice(1, 4);

    return {
      authenticated: true,
      connected: true,
      sync: {
        status: syncState?.status || "idle",
        lastCompletedAt: syncState?.last_completed_at || null,
        lastError: syncState?.last_error || null,
        needsReconnect: false,
      },
      stats: {
        dueNow: ranked.filter((track) => track.dueScore >= 45).length,
        dueSoon: ranked.filter((track) => track.dueScore >= 25).length,
        rediscoveryCount: ranked.filter(
          (track) => (track.daysSinceListen ?? 0) >= 90
        ).length,
        neglectedCount: ranked.filter((track) =>
          track.reasons.includes("bucket fit is unproven")
        ).length,
      },
      session: {
        headline: currentTrack
          ? `${ranked.length} songs want attention`
          : "Your review stack is quiet",
        subhead: currentTrack
          ? "One song, one decision, then keep moving."
          : "Everything looks current for now.",
      },
      currentTrack,
      upcoming,
      allBuckets,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const syncState = await getFullSyncState();

    return {
      authenticated: true,
      connected: false,
      sync: {
        status: syncState?.status || "error",
        lastCompletedAt: syncState?.last_completed_at || null,
        lastError: message,
        needsReconnect: /scope|token|Spotify not connected/i.test(message),
      },
      stats: {
        dueNow: 0,
        dueSoon: 0,
        rediscoveryCount: 0,
        neglectedCount: 0,
      },
      session: {
        headline: "Reconnect Spotify to review songs",
        subhead: "The review engine only runs when Spotify access is available.",
      },
      currentTrack: null,
      upcoming: [],
      allBuckets: [],
    };
  }
}

function getNextSchedule(params: {
  currentIntervalDays: number;
  currentEaseFactor: number;
  confirmStreak: number;
  intent: ReviewActionInput["intent"];
  changedBuckets: boolean;
  liked: boolean;
}) {
  const interval = Math.max(1, params.currentIntervalDays || 7);
  const ease = params.currentEaseFactor || 2.3;

  if (params.intent === "defer") {
    return {
      nextReviewAt: addDays(3),
      intervalDays: 3,
      easeFactor: clamp(ease - 0.1, 1.6, 3),
      confidence: "uncertain",
    };
  }

  if (params.intent === "unsure") {
    return {
      nextReviewAt: addDays(7),
      intervalDays: 7,
      easeFactor: clamp(ease - 0.15, 1.5, 3),
      confidence: "uncertain",
    };
  }

  if (!params.liked) {
    return {
      nextReviewAt: addDays(180),
      intervalDays: 180,
      easeFactor: clamp(ease - 0.2, 1.5, 3),
      confidence: "soft",
    };
  }

  if (params.changedBuckets) {
    return {
      nextReviewAt: addDays(21),
      intervalDays: 21,
      easeFactor: clamp(ease, 1.8, 3),
      confidence: "soft",
    };
  }

  const nextInterval =
    params.confirmStreak <= 0 ? 30 : Math.round(interval * clamp(ease, 1.9, 2.8));

  return {
    nextReviewAt: addDays(nextInterval),
    intervalDays: nextInterval,
    easeFactor: clamp(ease + 0.12, 1.8, 3.1),
    confidence: "strong",
  };
}

export async function applyReviewAction(input: ReviewActionInput) {
  const supabase = createAdminClient();
  const { data: trackRow } = await supabase
    .from("spotify_review_tracks")
    .select(
      `
        track_id,
        spotify_uri,
        is_liked,
        recent_review_skip_count,
        spotify_review_state (
          confirm_streak,
          interval_days,
          ease_factor,
          defer_count,
          unsure_count,
          review_count,
          bucket_change_count
        ),
        spotify_review_track_buckets (
          bucket_id,
          active
        )
      `
    )
    .eq("track_id", input.trackId)
    .single();

  if (!trackRow) {
    throw new Error("Track not found");
  }

  const activeBucketIds = (trackRow.spotify_review_track_buckets || [])
    .filter((membership: any) => membership.active)
    .map((membership: any) => membership.bucket_id as string);

  const addBucketIds = input.bucketIds.filter(
    (bucketId) => !activeBucketIds.includes(bucketId)
  );
  const removeBucketIds = activeBucketIds.filter(
    (bucketId) => !input.bucketIds.includes(bucketId)
  );
  const changedBuckets = addBucketIds.length > 0 || removeBucketIds.length > 0;

  if (input.liked !== trackRow.is_liked) {
    await spotifyFetch(
      `/me/tracks?ids=${encodeURIComponent(input.trackId)}`,
      {
        method: input.liked ? "PUT" : "DELETE",
      }
    );
  }

  if (!trackRow.spotify_uri && (addBucketIds.length > 0 || removeBucketIds.length > 0)) {
    throw new Error("Missing Spotify URI for playlist edits");
  }

  await Promise.all(
    addBucketIds.map((bucketId) =>
      spotifyFetch(`/playlists/${bucketId}/tracks`, {
        method: "POST",
        body: JSON.stringify({
          uris: [trackRow.spotify_uri],
        }),
      })
    )
  );

  await Promise.all(
    removeBucketIds.map((bucketId) =>
      spotifyFetch(`/playlists/${bucketId}/tracks`, {
        method: "DELETE",
        body: JSON.stringify({
          tracks: [{ uri: trackRow.spotify_uri }],
        }),
      })
    )
  );

  const state = Array.isArray(trackRow.spotify_review_state)
    ? trackRow.spotify_review_state[0]
    : trackRow.spotify_review_state || {};
  const schedule = getNextSchedule({
    currentIntervalDays: Number(state.interval_days || 7),
    currentEaseFactor: Number(state.ease_factor || 2.3),
    confirmStreak: state.confirm_streak || 0,
    intent: input.intent,
    changedBuckets,
    liked: input.liked,
  });

  await supabase
    .from("spotify_review_tracks")
    .update({
      is_liked: input.liked,
      removed_from_liked_at: input.liked ? null : nowIso(),
      last_synced_at: nowIso(),
      recent_review_skip_count:
        input.intent === "defer"
          ? ((trackRow as any).recent_review_skip_count || 0) + 1
          : (trackRow as any).recent_review_skip_count || 0,
      last_review_skip_at:
        input.intent === "defer" ? nowIso() : null,
    })
    .eq("track_id", input.trackId);

  if (removeBucketIds.length > 0) {
    await supabase
      .from("spotify_review_track_buckets")
      .update({
        active: false,
        removed_at: nowIso(),
      })
      .eq("track_id", input.trackId)
      .in("bucket_id", removeBucketIds);
  }

  if (addBucketIds.length > 0) {
    await supabase
      .from("spotify_review_track_buckets")
      .upsert(
        addBucketIds.map((bucketId) => ({
          track_id: input.trackId,
          bucket_id: bucketId,
          active: true,
          removed_at: null,
          last_confirmed_at: nowIso(),
          added_via: "review",
        })),
        { onConflict: "track_id,bucket_id" }
      );
  }

  if (input.bucketIds.length > 0) {
    await supabase
      .from("spotify_review_track_buckets")
      .update({
        active: true,
        removed_at: null,
        last_confirmed_at: nowIso(),
      })
      .eq("track_id", input.trackId)
      .in("bucket_id", input.bucketIds);
  }

  await supabase.from("spotify_review_state").upsert(
    {
      track_id: input.trackId,
      review_count: (state.review_count || 0) + 1,
      confirm_streak:
        input.intent === "confirm" && !changedBuckets && input.liked
          ? (state.confirm_streak || 0) + 1
          : input.intent === "defer" || input.intent === "unsure"
            ? 0
            : Math.max(1, state.confirm_streak || 0),
      defer_count:
        input.intent === "defer"
          ? (state.defer_count || 0) + 1
          : state.defer_count || 0,
      unsure_count:
        input.intent === "unsure"
          ? (state.unsure_count || 0) + 1
          : state.unsure_count || 0,
      bucket_change_count:
        changedBuckets
          ? (state.bucket_change_count || 0) + 1
          : state.bucket_change_count || 0,
      surfaced_count: (state.review_count || 0) + 1,
      ease_factor: schedule.easeFactor,
      interval_days: schedule.intervalDays,
      next_review_at: schedule.nextReviewAt,
      last_reviewed_at: nowIso(),
      last_action: input.intent,
      last_confidence: schedule.confidence,
      pending_reasons: [],
      archived: false,
      last_due_score: 0,
    },
    { onConflict: "track_id" }
  );

  await supabase.from("spotify_review_events").insert({
    track_id: input.trackId,
    action_type: input.intent,
    payload: {
      liked: input.liked,
      bucket_ids: input.bucketIds,
      added_bucket_ids: addBucketIds,
      removed_bucket_ids: removeBucketIds,
    },
  });
}
