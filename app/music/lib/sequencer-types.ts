export const SEQUENCER_GOALS = [
  "journey",
  "discovery",
  "immersion",
  "comfort",
  "atmosphere",
  "drive",
  "release",
] as const;

export type SequencerGoal = (typeof SEQUENCER_GOALS)[number];

export const SEQUENCER_MODIFIERS = [
  "smooth",
  "adventurous",
  "anchored",
  "energized",
  "soft-landing",
  "focused",
  "contrast",
] as const;

export type SequencerModifier = (typeof SEQUENCER_MODIFIERS)[number];

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
  secondaryGoal: SequencerModifier | null;
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
  secondaryGoal: SequencerModifier | null;
  arcProfile: SequencerArcProfile;
  boundaryPreferences: Record<string, SequencerBoundaryPreference>;
  blocks: SequencerSaveBlockInput[];
  tracks: SequencerSaveTrackInput[];
}

export const SEQUENCER_GOAL_LABELS: Record<SequencerGoal, string> = {
  journey: "Journey",
  discovery: "Discovery",
  immersion: "Immersion",
  comfort: "Comfort",
  atmosphere: "Atmosphere",
  drive: "Drive",
  release: "Release",
};

export const SEQUENCER_MODIFIER_LABELS: Record<SequencerModifier, string> = {
  smooth: "Smooth",
  adventurous: "Adventurous",
  anchored: "Anchored",
  energized: "Energized",
  "soft-landing": "Soft Landing",
  focused: "Focused",
  contrast: "Contrast",
};

export const SEQUENCER_GOAL_DESCRIPTIONS: Record<SequencerGoal, string> = {
  journey: "Shape a visible rise, depth, and release instead of staying flat.",
  discovery: "Push unfamiliar songs forward without letting the set turn hostile.",
  immersion: "Lock into one world long enough to feel coherent and absorbing.",
  comfort: "Keep the playlist familiar, low-friction, and easy to settle into.",
  atmosphere: "Prioritize mood and texture over obvious statements or big pivots.",
  drive: "Keep forward pressure high and avoid stretches that sag.",
  release: "Build toward a bigger payoff so the late stretch lands with force.",
};

export const SEQUENCER_GOAL_PURPOSES: Record<SequencerGoal, string> = {
  journey: "shape a clear rise, depth, and release",
  discovery: "push into new terrain without losing the listener",
  immersion: "hold one world long enough to sink into it",
  comfort: "keep the room familiar and low-friction",
  atmosphere: "maintain a stable atmosphere with minimal grabs",
  drive: "keep forward momentum without flattening the ride",
  release: "build toward a bigger payoff and let the final stretch hit harder",
};

export const SEQUENCER_MODIFIER_DESCRIPTIONS: Record<SequencerModifier, string> = {
  smooth: "Reduce rough seams and keep handoffs easier to live with.",
  adventurous: "Allow stranger turns and push unfamiliar material harder.",
  anchored: "Lean harder on recognizable anchors and recovery points.",
  energized: "Keep the average lift and intensity higher.",
  "soft-landing": "Protect the final stretch so it can come down cleanly.",
  focused: "Tighten the palette around language, texture, and family.",
  contrast: "Let sections separate more clearly with bigger lifts, drops, and turns.",
};

const LEGACY_GOAL_ALIASES: Record<string, SequencerGoal> = {
  emotion: "journey",
  language: "immersion",
  background: "atmosphere",
  journey: "journey",
  discovery: "discovery",
  immersion: "immersion",
  comfort: "comfort",
  atmosphere: "atmosphere",
  drive: "drive",
  release: "release",
};

const LEGACY_MODIFIER_ALIASES: Record<string, SequencerModifier> = {
  smooth: "smooth",
  adventurous: "adventurous",
  anchored: "anchored",
  energized: "energized",
  "soft-landing": "soft-landing",
  focused: "focused",
  contrast: "contrast",
  emotion: "adventurous",
  language: "focused",
  discovery: "adventurous",
  comfort: "anchored",
  background: "smooth",
  journey: "adventurous",
  immersion: "focused",
  atmosphere: "smooth",
  drive: "energized",
  release: "contrast",
};

export function normalizeSequencerGoal(value: unknown): SequencerGoal | null {
  if (typeof value !== "string") return null;
  return LEGACY_GOAL_ALIASES[value] || null;
}

export function normalizeSequencerModifier(
  value: unknown
): SequencerModifier | null {
  if (typeof value !== "string") return null;
  return LEGACY_MODIFIER_ALIASES[value] || null;
}
