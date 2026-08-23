/**
 * Shared shapes for the music manager. Client-safe (no server imports).
 *
 * The whole surface runs on one state model:
 *   · every track sits on exactly one `shelf` — 'active' or 'retired'
 *   · every playlist has one `role` — 'shelf', 'graveyard' or 'inbox'
 * Graveyard playlists are never filing destinations, so nothing can round-trip
 * back into triage the way it used to.
 */

export type Shelf = "active" | "retired";
export type PlaylistRole = "shelf" | "graveyard" | "inbox";

export interface PlaylistChip {
  id: string;
  name: string;
  imageUrl: string | null;
  trackCount: number;
}

export interface ManagedPlaylist extends PlaylistChip {
  description: string | null;
  url: string | null;
  isPublic: boolean;
  hidden: boolean;
  role: PlaylistRole;
  sortPosition: number | null;
  /** null when the playlist has never been sequenced */
  sequencedAt: string | null;
  appliedAt: string | null;
  /** how many songs sit somewhere other than where the saved order wants them */
  drift: number | null;
}

/** One card in the sorter. Deliberately slim — a deck ships ~120 of these. */
export interface TrackCard {
  id: string;
  uri: string | null;
  title: string;
  artist: string;
  album: string | null;
  art: string | null;
  songUrl: string | null;
  durationMs: number | null;
  releaseYear: number | null;
  liked: boolean;
  /** 0..1 from /me/top/tracks; null = never charted for you */
  affinity: number | null;
  lastPlayedAt: string | null;
  likedAt: string | null;
  playlistIds: string[];
  /** Spotify has delisted it — no title, no artist, nothing to play */
  unavailable: boolean;
  /** plain-language facts, not scores */
  notes: string[];
}

export const DECK_KINDS = [
  "unfiled",
  "cold",
  "fresh",
  "playlist",
  "orphans",
  "gone",
] as const;
export type DeckKind = (typeof DECK_KINDS)[number];

export interface DeckSummary {
  kind: DeckKind;
  playlistId?: string;
  label: string;
  blurb: string;
  count: number;
}

export interface DeckSnapshot {
  kind: DeckKind;
  playlistId: string | null;
  label: string;
  blurb: string;
  /** total in the pile; `cards` may be a prefix of it */
  total: number;
  cards: TrackCard[];
  playlists: PlaylistChip[];
  pinned: string[];
}

export interface DeskSnapshot {
  connected: boolean;
  syncedAt: string | null;
  error: string | null;
  counts: {
    tracks: number;
    /** active and still on Spotify — the denominator for every coverage bar */
    analysable: number;
    liked: number;
    unfiled: number;
    retired: number;
    lyricsKnown: number;
    soundKnown: number;
    senseKnown: number;
    feelKnown: number;
  };
  decks: DeckSummary[];
  playlists: ManagedPlaylist[];
}

export type DecisionVerb = "file" | "keep" | "retire" | "revive";

export interface Decision {
  trackId: string;
  verb: DecisionVerb;
  /** for `file`: the complete set of playlists the track should end up in */
  playlistIds?: string[];
  /**
   * for `file`: the memberships the card was showing when the choice was made.
   * The server only unfiles what was on this list, so a playlist you joined
   * elsewhere while the deck sat open is left alone instead of being stripped.
   */
  knownPlaylistIds?: string[];
}

export interface GraveyardYear {
  year: number;
  playlistId: string | null;
  playlistUrl: string | null;
  /** whether a mirror playlist for this year exists on Spotify at all */
  mirrored: boolean;
  tracks: Array<{
    id: string;
    title: string;
    artist: string;
    art: string | null;
    songUrl: string | null;
    retiredAt: string | null;
  }>;
}

export interface GraveyardSnapshot {
  total: number;
  years: GraveyardYear[];
}

// ---------------------------------------------------------------------------
// Sequencing
// ---------------------------------------------------------------------------

export const ARCS = ["album", "party", "even"] as const;
export type Arc = (typeof ARCS)[number];

export const ARC_LABELS: Record<Arc, string> = {
  album: "hot open, long fall",
  party: "settle, build, land",
  even: "no shape",
};

export const ARC_BLURBS: Record<Arc, string> = {
  album:
    "Open warm, drift down, lift hard about two thirds through, then let it go. What 51,000 real albums do.",
  party:
    "Start low, climb the whole way, peak near the end. For a room that fills up.",
  even: "Hold one level. No arc at all — only the local rules apply.",
};

/**
 * The shaping knobs.
 *
 * Four, deliberately. The old bench had five sliders, two toggles and a curve
 * picker, and three of those were multiplied by zero. Each of these moves
 * something a person can hear, and each one shows up in the scorecard.
 */
export interface Shape {
  /** the contour the run is fitted to */
  arc: Arc;
  /** how long a side runs before the arc starts again, in minutes */
  sideMinutes: number;
  /** how hard the contour is fitted — the arc */
  shape: number;
  /** how much contrast is demanded — the cure for bland */
  movement: number;
  /** how much unfamiliar material, and how early it is allowed */
  discovery: number;
  /** 0 = alike means what it sounds like, 1 = what it is about */
  alike: number;
  /** hold the first slot for something a stranger can walk into */
  openStrong: boolean;
}

export const DEFAULT_SHAPE: Shape = {
  arc: "album",
  sideMinutes: 62,
  shape: 0.75,
  movement: 0.7,
  discovery: 0.6,
  alike: 0.5,
  openStrong: true,
};

export interface SeqTrack {
  /** stable within a playlist; "<trackId>" or "<trackId>#2" for duplicates */
  uid: string;
  trackId: string;
  title: string;
  artist: string;
  artistId: string | null;
  art: string | null;
  songUrl: string | null;
  durationMs: number | null;
  releaseYear: number | null;
  affinity: number | null;
  language: string | null;
  wordsPerMin: number | null;
  instrumental: boolean;
  unavailable: boolean;
  /** how hard it drives, in SD of the whole library */
  arousal: number | null;
  /** bleak to bright, in SD of the whole library */
  valence: number | null;
  /** how likely a stranger is to know it, 0..1 */
  familiarity: number | null;
  /** in the least-known third of the library */
  stranger: boolean;
  /** in the best-known quarter — the thing a stranger can be anchored to */
  anchor: boolean;
  /** someone can get into it inside ten seconds */
  opensWell: boolean;
  bpm: number | null;
  /** does this track have a sound vector / a lyric embedding / a feel row */
  heard: boolean;
  read: boolean;
  felt: boolean;
  /** names of the owner's other playlists this song also lives in */
  kin: string[];
}

/**
 * One side of the tape.
 *
 * A 225-track playlist is twelve and a half hours; nobody hears an arc that
 * long. The run is cut into hour-ish sides and each one is a whole journey, so
 * pressing play at the top always buys a shaped hour, and leaving it on all
 * afternoon buys several.
 */
export interface Side {
  id: string;
  label: string;
  /** why these belong together, in plain language */
  reason: string;
  uids: string[];
  minutes: number;
  /** arousal per track, for the sparkline; null where it was never measured */
  arousal: Array<number | null>;
  /** how many of them were actually measured */
  measured: number;
  /** what the contour wanted, same length, drawn behind it */
  wanted: number[];
  /** Spearman of position against arousal — wants -0.30..-0.05 */
  ramp: number | null;
  /** where the loudest moment sits, 0..1 — wants 0.55..0.80 */
  peakAt: number | null;
  /** how far the peak rises above the three before it — wants >= 0.8 SD */
  peakLift: number | null;
  /** does every four-track window inside it still move */
  restless: boolean;
}

/** Every number here is null when there isn't enough measured data to mean it. */
export interface Scorecard {
  /**
   * Adjacent distance over average distance, x100. Real playlists sit at 85-95;
   * below 80 is the over-smoothed order that reads as bland. This is the one
   * number that says "bland" out loud.
   */
  adjacency: number | null;
  /** how often the direction of travel reverses, x100 — real albums sit at 66-70 */
  alternation: number | null;
  /** longest stretch that only goes one way */
  longestRun: number;
  /** how many sides keep moving inside every four tracks */
  restlessSides: number;
  sideCount: number;
  /** adjacent pairs further apart than nine tenths of the playlist. Few, not zero. */
  abrupt: number;
  artistClumps: number;
  artistTriples: number;
  /** the fewest same-artist tracks in a row this playlist could possibly manage */
  artistRunFloor: number;
  /** longest run of one non-dominant language */
  languageSlab: number;
  /** share of strangers in each third of a side, x100 — wants to rise */
  discovery: [number, number, number] | null;
  /** ...and across the whole run */
  discoveryRun: [number, number, number] | null;
  /** strangers with no familiar face on either side */
  unanchored: number;
  /** strangers back to back */
  strangerPairs: number;
  strangers: number;
  /** how many songs would move if you applied this */
  moves: number;
  /** ...in how many requests to Spotify, since runs move together */
  requests: number;
  /** songs Spotify has delisted, parked at the end */
  gone: number;
  /** how many of these have been listened to / embedded / measured */
  heard: number;
  read: number;
  felt: number;
  /** rules switched off because the playlist is too short to carry them */
  suspended: string[];
}

export interface Setlist {
  playlist: {
    id: string;
    name: string;
    imageUrl: string | null;
    url: string | null;
    trackCount: number;
  };
  tracks: SeqTrack[];
  /** current live order on Spotify */
  liveOrder: string[];
  /** the order being proposed / saved */
  order: string[];
  sides: Side[];
  shape: Shape;
  scorecard: Scorecard;
  /** plain-language observations about the proposed order */
  notes: string[];
  savedAt: string | null;
  appliedAt: string | null;
  lyricsPending: number;
  feelPending: number;
  /**
   * Spotify could not be reached, so this is the local copy of the playlist.
   * Fine to look at and shape; not safe to apply, because an order is written
   * as moves between live positions.
   */
  offline: boolean;
}
