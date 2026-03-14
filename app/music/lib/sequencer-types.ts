export const SEQUENCER_GOALS = [
  "emotion",
  "language",
  "discovery",
  "comfort",
  "background",
] as const;

export type SequencerGoal = (typeof SEQUENCER_GOALS)[number];

export const SEQUENCER_BOUNDARY_MODES = [
  "smooth",
  "neutral",
  "intentional",
] as const;

export type SequencerBoundaryMode = (typeof SEQUENCER_BOUNDARY_MODES)[number];

export type SequencerRiskLabel = "smooth" | "noticeable" | "abrupt";

export interface SequencerPlaylistMeta {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  playlistUrl: string | null;
  owner: string | null;
  trackCount: number;
  snapshotId: string | null;
}

export interface SequencerTrackFeatures {
  energy: number;
  familiarity: number;
  novelty: number;
  intensity: number;
  valence: number;
  lyricDensity: number;
  bridgePotential: number;
  comfort: number;
  anchor: number;
  demand: number;
  language: string;
  genreFamily: string;
  texture: string;
}

export interface SequencerTrack {
  trackId: string;
  spotifyUri: string | null;
  title: string;
  artistDisplay: string;
  artistNames: string[];
  albumName: string | null;
  albumImageUrl: string | null;
  previewUrl: string | null;
  songUrl: string | null;
  durationMs: number | null;
  popularity: number | null;
  explicit: boolean;
  currentPosition: number;
  blockId: string;
  roleTags: string[];
  locked: boolean;
  hiddenFromAutosort: boolean;
  reasons: string[];
  featureProfile: SequencerTrackFeatures;
  prevCompatibility: number | null;
  nextCompatibility: number | null;
}

export interface SequencerBlockMetrics {
  cohesion: number;
  energy: number;
  familiarity: number;
  novelty: number;
  intensity: number;
}

export interface SequencerBlock {
  id: string;
  name: string;
  purpose: string;
  position: number;
  colorToken: string | null;
  notes: string | null;
  locked: boolean;
  summary: string;
  warnings: string[];
  metrics: SequencerBlockMetrics;
  tracks: SequencerTrack[];
}

export interface SequencerBoundaryPreference {
  mode: SequencerBoundaryMode;
}

export interface SequencerBoundary {
  id: string;
  fromBlockId: string;
  toBlockId: string;
  mode: SequencerBoundaryMode;
  compatibility: number;
  riskLabel: SequencerRiskLabel;
  changeSummary: string[];
  bridgeCandidateTrackIds: string[];
}

export interface SequencerSuggestion {
  id: string;
  type:
    | "boundary"
    | "anchor"
    | "novelty"
    | "ending"
    | "block"
    | "structure";
  title: string;
  detail: string;
  blockId?: string;
  boundaryId?: string;
  trackId?: string;
}

export interface SequencerQualityMetrics {
  cohesion: number;
  arcFit: number;
  variety: number;
  anchorBalance: number;
  noveltyPacing: number;
  transitionHealth: number;
  endingStrength: number;
  tradeoffs: string[];
  summary: string[];
}

export interface SequencerArcProfile {
  preset: string;
  energy: number[];
  valence: number[];
  familiarity: number[];
  novelty: number[];
}

export interface SequencerMiniPlaylist {
  id: string;
  title: string;
  summary: string;
  trackCount: number;
  durationMs: number;
  targetDurationMs: number;
  quality: number;
  startBlockId: string | null;
  endBlockId: string | null;
  blockIds: string[];
  trackIds: string[];
}

export interface SequencerSnapshot {
  authenticated: boolean;
  playlist: SequencerPlaylistMeta;
  goalType: SequencerGoal;
  secondaryGoal: SequencerGoal | null;
  arcProfile: SequencerArcProfile;
  boundaryPreferences: Record<string, SequencerBoundaryPreference>;
  blocks: SequencerBlock[];
  transitions: SequencerBoundary[];
  chapters: SequencerMiniPlaylist[];
  metrics: SequencerQualityMetrics;
  suggestions: SequencerSuggestion[];
  generatedAt: string;
  savedAt: string | null;
  dirty: boolean;
}

export interface SequencerSaveBlockInput {
  id: string;
  name: string;
  purpose: string;
  position: number;
  colorToken: string | null;
  notes: string | null;
  locked: boolean;
}

export interface SequencerSaveTrackInput {
  trackId: string;
  blockId: string;
  position: number;
  roleTags: string[];
  locked: boolean;
  hiddenFromAutosort: boolean;
}

export interface SequencerSaveInput {
  goalType: SequencerGoal;
  secondaryGoal: SequencerGoal | null;
  arcProfile: SequencerArcProfile;
  boundaryPreferences: Record<string, SequencerBoundaryPreference>;
  blocks: SequencerSaveBlockInput[];
  tracks: SequencerSaveTrackInput[];
}

export const SEQUENCER_GOAL_LABELS: Record<SequencerGoal, string> = {
  emotion: "Emotion",
  language: "Language Immersion",
  discovery: "Discovery",
  comfort: "Comfort",
  background: "Background",
};
