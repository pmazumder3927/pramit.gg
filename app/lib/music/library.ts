import "server-only";

import { createAdminClient } from "@/utils/supabase/admin";
import type {
  DeckKind,
  DeckSnapshot,
  DeckSummary,
  DeskSnapshot,
  GraveyardSnapshot,
  ManagedPlaylist,
  PlaylistChip,
  TrackCard,
} from "@/app/music/manage/lib/types";
import { getSetting } from "./settings";

const DECK_SIZE = 140;
const DAY = 1000 * 60 * 60 * 24;
/** A song you handled this recently isn't back in the pile yet. */
const SETTLED_DAYS = 45;
const COLD_AFTER_DAYS = 730;

type TrackRow = {
  track_id: string;
  uri: string | null;
  title: string;
  artist_display: string;
  album_name: string | null;
  album_image_url: string | null;
  song_url: string | null;
  duration_ms: number | null;
  release_year: number | null;
  liked: boolean;
  liked_at: string | null;
  last_played_at: string | null;
  affinity: number | null;
  shelf: string;
  retired_at: string | null;
  reviewed_at: string | null;
};

const TRACK_COLUMNS =
  "track_id, uri, title, artist_display, album_name, album_image_url, song_url, duration_ms, release_year, liked, liked_at, last_played_at, affinity, shelf, retired_at, reviewed_at";

/** Handled recently enough that it doesn't belong in a pile yet. */
function settled(reviewedAt: string | null): boolean {
  const days = daysSince(reviewedAt);
  return days !== null && days < SETTLED_DAYS;
}

function daysSince(value: string | null): number | null {
  if (!value) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / DAY));
}

function ago(days: number | null): string | null {
  if (days === null) return null;
  if (days < 1) return "today";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  const years = days / 365;
  return years < 1.6 ? "a year ago" : `${Math.round(years)}y ago`;
}

async function loadPlaylistIndex() {
  const supabase = createAdminClient();
  const [{ data: playlists }, { data: memberships }] = await Promise.all([
    supabase
      .from("music_playlists")
      .select(
        "playlist_id, name, description, image_url, url, is_public, hidden, track_count, role, sort_position"
      )
      .eq("active", true)
      .order("name"),
    supabase.from("music_playlist_tracks").select("playlist_id, track_id, position"),
  ]);

  const shelves = (playlists || []).filter((p) => p.role === "shelf");
  const byTrack = new Map<string, string[]>();
  const byPlaylist = new Map<string, Array<{ trackId: string; position: number }>>();

  for (const row of memberships || []) {
    const list = byTrack.get(row.track_id as string) || [];
    list.push(row.playlist_id as string);
    byTrack.set(row.track_id as string, list);

    const contents = byPlaylist.get(row.playlist_id as string) || [];
    contents.push({ trackId: row.track_id as string, position: row.position as number });
    byPlaylist.set(row.playlist_id as string, contents);
  }

  return { playlists: playlists || [], shelves, byTrack, byPlaylist };
}

function toChip(row: any): PlaylistChip {
  return {
    id: row.playlist_id,
    name: row.name,
    imageUrl: row.image_url,
    trackCount: row.track_count || 0,
  };
}

function toCard(
  row: TrackRow,
  playlistIds: string[],
  playlistNames: Map<string, string>
): TrackCard {
  const notes: string[] = [];
  const sinceLiked = daysSince(row.liked_at);
  const sincePlayed = daysSince(row.last_played_at);

  if (playlistIds.length === 0) {
    notes.push(row.liked ? "in no playlist" : "not liked, not filed");
  } else {
    const names = playlistIds
      .map((id) => playlistNames.get(id))
      .filter(Boolean) as string[];
    if (names.length) notes.push(`filed in ${names.join(", ")}`);
  }

  if ((row.affinity ?? 0) >= 0.6) notes.push("one of your most played");
  if (sincePlayed !== null && sincePlayed > 120) {
    notes.push(`last heard ${ago(sincePlayed)}`);
  }
  if (sinceLiked !== null && sinceLiked > 365) notes.push(`liked ${ago(sinceLiked)}`);

  return {
    id: row.track_id,
    uri: row.uri,
    title: row.title,
    artist: row.artist_display,
    album: row.album_name,
    art: row.album_image_url,
    songUrl: row.song_url,
    durationMs: row.duration_ms,
    releaseYear: row.release_year,
    liked: row.liked,
    affinity: row.affinity,
    lastPlayedAt: row.last_played_at,
    likedAt: row.liked_at,
    playlistIds,
    notes: notes.slice(0, 3),
  };
}

// ---------------------------------------------------------------------------
// The desk
// ---------------------------------------------------------------------------

export async function getDesk(): Promise<DeskSnapshot> {
  const supabase = createAdminClient();
  const { playlists, shelves, byTrack, byPlaylist } = await loadPlaylistIndex();

  const [{ data: tracks }, { count: lyricsKnown }, sequences, lastSync] =
    await Promise.all([
      supabase
        .from("music_tracks")
        .select("track_id, liked, shelf, liked_at, affinity, reviewed_at"),
      supabase
        .from("music_track_lyrics")
        .select("track_id", { count: "exact", head: true }),
      supabase
        .from("music_sequences")
        .select("playlist_id, order_uids, updated_at, applied_at"),
      getSetting<{ at?: string }>("last_sync"),
    ]);

  const active = (tracks || []).filter((t) => t.shelf === "active");
  const retired = (tracks || []).filter((t) => t.shelf === "retired");
  const liked = active.filter((t) => t.liked);
  const open = active.filter((t) => !settled(t.reviewed_at as string | null));
  const openLiked = open.filter((t) => t.liked);

  const unfiled = openLiked.filter((t) => !byTrack.has(t.track_id as string));
  const orphans = open.filter((t) => !t.liked && !byTrack.has(t.track_id as string));
  const fresh = openLiked.filter((t) => (daysSince(t.liked_at as string) ?? 9999) <= 60);
  const cold = open.filter(
    (t) =>
      byTrack.has(t.track_id as string) &&
      t.affinity === null &&
      (daysSince(t.liked_at as string) ?? 0) > COLD_AFTER_DAYS
  );

  const sequenceMap = new Map(
    (sequences.data || []).map((row: any) => [row.playlist_id as string, row])
  );

  const managed: ManagedPlaylist[] = playlists.map((row: any) => {
    const sequence = sequenceMap.get(row.playlist_id);
    const live = (byPlaylist.get(row.playlist_id) || [])
      .sort((a, b) => a.position - b.position)
      .map((t) => t.trackId);
    let drift: number | null = null;
    if (sequence?.order_uids?.length) {
      const saved = (sequence.order_uids as string[]).map((uid) => uid.split("#")[0]);
      drift = saved.reduce(
        (count, trackId, index) => count + (live[index] === trackId ? 0 : 1),
        0
      );
    }
    return {
      id: row.playlist_id,
      name: row.name,
      description: row.description,
      imageUrl: row.image_url,
      url: row.url,
      isPublic: Boolean(row.is_public),
      hidden: Boolean(row.hidden),
      trackCount: row.track_count || 0,
      role: row.role,
      sortPosition: row.sort_position,
      sequencedAt: sequence?.updated_at || null,
      appliedAt: sequence?.applied_at || null,
      drift,
    };
  });

  const decks: DeckSummary[] = ([
    {
      kind: "unfiled",
      label: "unfiled",
      blurb: "liked, but living in no playlist",
      count: unfiled.length,
    },
    {
      kind: "fresh",
      label: "new arrivals",
      blurb: "liked in the last two months",
      count: fresh.length,
    },
    {
      kind: "cold",
      label: "long settled",
      blurb: "filed years ago and never one of your top songs",
      count: cold.length,
    },
    {
      kind: "orphans",
      label: "adrift",
      blurb: "not liked, not filed — decide or let go",
      count: orphans.length,
    },
  ] as DeckSummary[]).filter((deck) => deck.count > 0);

  for (const playlist of shelves) {
    decks.push({
      kind: "playlist",
      playlistId: playlist.playlist_id,
      label: playlist.name,
      blurb: "walk the whole playlist",
      count: (byPlaylist.get(playlist.playlist_id) || []).length,
    });
  }

  return {
    connected: true,
    syncedAt: lastSync?.at || null,
    error: null,
    counts: {
      tracks: active.length,
      liked: liked.length,
      unfiled: unfiled.length,
      retired: retired.length,
      lyricsKnown: lyricsKnown ?? 0,
    },
    decks,
    playlists: managed,
  };
}

// ---------------------------------------------------------------------------
// Decks
// ---------------------------------------------------------------------------

const DECK_COPY: Record<DeckKind, { label: string; blurb: string }> = {
  unfiled: { label: "unfiled", blurb: "liked, but living in no playlist" },
  fresh: { label: "new arrivals", blurb: "liked in the last two months" },
  cold: {
    label: "long settled",
    blurb: "filed years ago and never one of your top songs",
  },
  orphans: { label: "adrift", blurb: "not liked, not filed — decide or let go" },
  playlist: { label: "playlist", blurb: "walk the whole playlist" },
};

export async function getDeck(
  kind: DeckKind,
  playlistId?: string | null
): Promise<DeckSnapshot> {
  const supabase = createAdminClient();
  const { shelves, byTrack, byPlaylist } = await loadPlaylistIndex();
  const playlistNames = new Map(shelves.map((p: any) => [p.playlist_id, p.name as string]));

  const { data } = await supabase
    .from("music_tracks")
    .select(TRACK_COLUMNS)
    .eq("shelf", "active");
  // A pile you just worked shouldn't hand you the same songs tomorrow.
  const rows = ((data || []) as unknown as TrackRow[]).filter(
    (row) => kind === "playlist" || !settled(row.reviewed_at)
  );

  let pool: TrackRow[] = [];
  let label = DECK_COPY[kind].label;
  const blurb = DECK_COPY[kind].blurb;

  if (kind === "playlist" && playlistId) {
    const contents = (byPlaylist.get(playlistId) || []).sort(
      (a, b) => a.position - b.position
    );
    const order = new Map(contents.map((c, index) => [c.trackId, index]));
    pool = rows
      .filter((row) => order.has(row.track_id))
      .sort((a, b) => order.get(a.track_id)! - order.get(b.track_id)!);
    label = playlistNames.get(playlistId) || "playlist";
  } else if (kind === "unfiled") {
    pool = rows
      .filter((row) => row.liked && !byTrack.has(row.track_id))
      .sort((a, b) => (b.liked_at || "").localeCompare(a.liked_at || ""));
  } else if (kind === "fresh") {
    pool = rows
      .filter((row) => row.liked && (daysSince(row.liked_at) ?? 999) <= 60)
      .sort((a, b) => (b.liked_at || "").localeCompare(a.liked_at || ""));
  } else if (kind === "cold") {
    pool = rows
      .filter(
        (row) =>
          byTrack.has(row.track_id) &&
          row.affinity === null &&
          (daysSince(row.liked_at) ?? 0) > COLD_AFTER_DAYS
      )
      .sort((a, b) => (a.liked_at || "").localeCompare(b.liked_at || ""));
  } else if (kind === "orphans") {
    pool = rows
      .filter((row) => !row.liked && !byTrack.has(row.track_id))
      .sort((a, b) => (a.liked_at || "").localeCompare(b.liked_at || ""));
  }

  return {
    kind,
    playlistId: playlistId || null,
    label,
    blurb,
    total: pool.length,
    cards: pool
      .slice(0, DECK_SIZE)
      .map((row) => toCard(row, byTrack.get(row.track_id) || [], playlistNames)),
    playlists: shelves.map(toChip),
    pinned: (await getSetting<{ ids?: string[] }>("pinned_playlists"))?.ids || [],
  };
}

// ---------------------------------------------------------------------------
// Graveyard
// ---------------------------------------------------------------------------

export async function getGraveyard(): Promise<GraveyardSnapshot> {
  const supabase = createAdminClient();
  const [{ data: rows }, { data: playlists }] = await Promise.all([
    supabase
      .from("music_tracks")
      .select(TRACK_COLUMNS)
      .eq("shelf", "retired")
      .order("retired_at", { ascending: false }),
    supabase
      .from("music_playlists")
      .select("playlist_id, url, graveyard_year, track_count")
      .eq("role", "graveyard")
      .eq("active", true),
  ]);

  const byYear = new Map<number, TrackRow[]>();
  for (const row of (rows || []) as unknown as TrackRow[]) {
    const year = row.retired_at
      ? new Date(row.retired_at).getUTCFullYear()
      : new Date().getUTCFullYear();
    const list = byYear.get(year) || [];
    list.push(row);
    byYear.set(year, list);
  }

  const mirrors = new Map(
    (playlists || [])
      .filter((p: any) => p.graveyard_year)
      .map((p: any) => [p.graveyard_year as number, p])
  );

  const years = Array.from(byYear.entries())
    .sort(([a], [b]) => b - a)
    .map(([year, tracks]) => {
      const mirror = mirrors.get(year);
      return {
        year,
        playlistId: mirror?.playlist_id || null,
        playlistUrl: mirror?.url || null,
        pending: Math.max(0, tracks.length - (mirror?.track_count || 0)),
        tracks: tracks.map((row) => ({
          id: row.track_id,
          title: row.title,
          artist: row.artist_display,
          art: row.album_image_url,
          songUrl: row.song_url,
          retiredAt: row.retired_at,
        })),
      };
    });

  return { total: (rows || []).length, years };
}
