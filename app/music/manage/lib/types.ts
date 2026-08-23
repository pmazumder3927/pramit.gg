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

export const WORD_CURVES = ["flat", "rise", "arc", "settle"] as const;
export type WordCurve = (typeof WORD_CURVES)[number];

export const WORD_CURVE_LABELS: Record<WordCurve, string> = {
  flat: "even",
  rise: "builds",
  arc: "swells and eases",
  settle: "unwinds",
};

export const WORD_CURVE_BLURBS: Record<WordCurve, string> = {
  flat: "Keep the density of words about the same the whole way through.",
  rise: "Open with room to breathe, end with the most to say.",
  arc: "Quiet at both ends, wordiest in the middle.",
  settle: "Say the most early, then thin out toward the end.",
};

/**
 * The shaping knobs.
 *
 * `flow` is the engine: it wants each song to sit next to one it resembles.
 * `likeness` decides what "resembles" means — what a song is about (an
 * embedding of its lyrics) or what it sounds like (tempo, loudness, brightness
 * and timbre measured off a real 30-second preview). Everything else is a rule
 * you can check by eye.
 */
export interface Shape {
  /** how hard to keep neighbours alike */
  flow: number;
  /** 0 = purely how it sounds, 1 = purely what it's about */
  likeness: number;
  /** keep the same artist from stacking up */
  spreadArtists: number;
  /** deal the songs you actually play across the whole run */
  spreadFavorites: number;
  /** pull new-to-you and newly-released songs toward the front */
  leadWithNew: number;
  /** how wordiness should move across the playlist */
  wordCurve: WordCurve;
  /** open on something you play; close on something long and sparse */
  openStrong: boolean;
  landSoft: boolean;
}

export const DEFAULT_SHAPE: Shape = {
  flow: 0.75,
  likeness: 0.55,
  spreadArtists: 0.7,
  spreadFavorites: 0.5,
  leadWithNew: 0.6,
  wordCurve: "arc",
  openStrong: true,
  landSoft: true,
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
  lastPlayedAt: string | null;
  language: string | null;
  wordsPerMin: number | null;
  instrumental: boolean;
  unavailable: boolean;
  /** 0..1 — new to you, newly released, or both */
  freshness: number;
  /** measured off a real preview; null when no preview could be found */
  bpm: number | null;
  /** does this track have a sound vector / a lyric embedding */
  heard: boolean;
  read: boolean;
  /** names of the owner's other playlists this song also lives in */
  kin: string[];
}

export interface Section {
  id: string;
  label: string;
  /** why these belong together, in plain language */
  reason: string;
  uids: string[];
}

/** Every number here is null when there isn't enough measured data to mean it. */
export interface Scorecard {
  /** 0-100, share of handovers that go to one of that song's nearest quarter */
  flow: number | null;
  /** 0-100, where the newest quarter sits; 50 is scattered evenly */
  newUpFront: number | null;
  /** adjacent pairs by the same artist */
  artistClumps: number;
  /** points where the language changes */
  languageSwitches: number;
  /** ...of which land on an instrumental or near-wordless track */
  cushionedSwitches: number;
  /** 0-100, how evenly your most-played songs are dealt out; null if too few */
  favoriteSpread: number | null;
  /** 0-100, how well wordiness follows the chosen curve */
  wordFit: number | null;
  /** how many songs would move if you applied this */
  moves: number;
  /** ...in how many requests to Spotify, since runs move together */
  requests: number;
  /** songs with no lyric data, so the word rules can't see them */
  unknownWords: number;
  /** songs Spotify has delisted, parked at the end */
  gone: number;
  /** how many of these songs have been listened to / embedded */
  heard: number;
  read: number;
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
  sections: Section[];
  shape: Shape;
  scorecard: Scorecard;
  /** plain-language observations about the proposed order */
  notes: string[];
  savedAt: string | null;
  appliedAt: string | null;
  lyricsPending: number;
}
