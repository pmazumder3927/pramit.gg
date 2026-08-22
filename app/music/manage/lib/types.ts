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
  /** plain-language facts, not scores */
  notes: string[];
}

export const DECK_KINDS = ["unfiled", "cold", "fresh", "playlist", "orphans"] as const;
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
    liked: number;
    unfiled: number;
    retired: number;
    lyricsKnown: number;
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
}

export interface GraveyardYear {
  year: number;
  playlistId: string | null;
  playlistUrl: string | null;
  /** tracks in the DB that the Spotify mirror playlist doesn't have yet */
  pending: number;
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
 * The shaping knobs. Every one is a rule you can check by eye — no invented
 * "energy" or "valence", because Spotify no longer serves audio features and
 * guessing them from song titles is how the old sequencer produced noise.
 */
export interface Shape {
  /** keep the same artist from stacking up */
  spreadArtists: number;
  /** hold same-language runs together and cushion the switches */
  groupLanguage: number;
  /** deal the songs you actually play across the whole run */
  spreadFavorites: number;
  /** keep tracks from the same years near each other */
  keepEras: number;
  /** how wordiness should move across the playlist */
  wordCurve: WordCurve;
  /** open on something you play; close on something long and sparse */
  openStrong: boolean;
  landSoft: boolean;
}

export const DEFAULT_SHAPE: Shape = {
  spreadArtists: 0.7,
  groupLanguage: 0.5,
  spreadFavorites: 0.6,
  keepEras: 0.3,
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

export interface Scorecard {
  /** adjacent pairs by the same artist */
  artistClumps: number;
  /** points where the language changes */
  languageSwitches: number;
  /** ...of which land on an instrumental or near-wordless track */
  cushionedSwitches: number;
  /** 0-100, how evenly your most-played songs are dealt out */
  favoriteSpread: number;
  /** 0-100, how well wordiness follows the chosen curve */
  wordFit: number;
  /** how many songs would move if you applied this */
  moves: number;
  /** songs with no lyric data, so the word rules can't see them */
  unknownWords: number;
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
