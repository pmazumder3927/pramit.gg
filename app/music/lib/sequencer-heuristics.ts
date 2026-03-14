import type {
  SequencerArcProfile,
  SequencerBlock,
  SequencerBoundaryMode,
  SequencerGoal,
  SequencerQualityMetrics,
  SequencerRiskLabel,
  SequencerTrack,
  SequencerTrackFeatures,
} from "@/app/music/lib/sequencer-types";

export function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function getBoundaryKey(fromBlockId: string, toBlockId: string) {
  return `${fromBlockId}:${toBlockId}`;
}

export function getGoalTargets(goal: SequencerGoal, ratio: number) {
  const t = clamp(ratio, 0, 1);

  switch (goal) {
    case "emotion":
      return {
        energy: t < 0.6 ? 0.2 + t * 0.7 : 0.62 - (t - 0.6) * 0.55,
        familiarity: 0.68 - t * 0.12,
        novelty: 0.32 + t * 0.1,
        intensity: t < 0.55 ? 0.3 + t * 0.4 : 0.54 - (t - 0.55) * 0.2,
      };
    case "language":
      return {
        energy: 0.35 + t * 0.18,
        familiarity: 0.78 - t * 0.28,
        novelty: 0.2 + t * 0.35,
        intensity: 0.28 + t * 0.22,
      };
    case "discovery":
      return {
        energy: 0.34 + t * 0.34,
        familiarity: 0.64 - t * 0.12,
        novelty: 0.48 + t * 0.26,
        intensity: 0.36 + t * 0.26,
      };
    case "comfort":
      return {
        energy: 0.26 + t * 0.08,
        familiarity: 0.82 - t * 0.08,
        novelty: 0.18 + t * 0.08,
        intensity: 0.24 + t * 0.06,
      };
    case "background":
    default:
      return {
        energy: 0.32 + t * 0.06,
        familiarity: 0.58 + t * 0.04,
        novelty: 0.24 + t * 0.08,
        intensity: 0.26 + t * 0.08,
      };
  }
}

const GOAL_WEIGHT_MAP: Record<
  SequencerGoal,
  {
    energy: number;
    valence: number;
    intensity: number;
    lyricDensity: number;
    familiarity: number;
    genre: number;
    texture: number;
    language: number;
    noveltyPressure: number;
  }
> = {
  emotion: {
    energy: 1.15,
    valence: 1,
    intensity: 1,
    lyricDensity: 0.55,
    familiarity: 0.9,
    genre: 0.55,
    texture: 0.75,
    language: 0.45,
    noveltyPressure: 0.8,
  },
  language: {
    energy: 0.7,
    valence: 0.45,
    intensity: 0.65,
    lyricDensity: 0.85,
    familiarity: 0.75,
    genre: 0.4,
    texture: 0.45,
    language: 1.4,
    noveltyPressure: 0.95,
  },
  discovery: {
    energy: 0.7,
    valence: 0.55,
    intensity: 0.7,
    lyricDensity: 0.55,
    familiarity: 0.5,
    genre: 0.7,
    texture: 0.65,
    language: 0.4,
    noveltyPressure: 0.45,
  },
  comfort: {
    energy: 0.95,
    valence: 0.6,
    intensity: 0.95,
    lyricDensity: 0.55,
    familiarity: 1.15,
    genre: 0.55,
    texture: 0.8,
    language: 0.4,
    noveltyPressure: 1.15,
  },
  background: {
    energy: 0.95,
    valence: 0.45,
    intensity: 1.15,
    lyricDensity: 0.9,
    familiarity: 0.55,
    genre: 0.45,
    texture: 0.9,
    language: 0.35,
    noveltyPressure: 0.95,
  },
};

function textureDistance(a: string, b: string) {
  if (a === b) return 0;
  if (a === "hybrid" || b === "hybrid") return 0.35;
  if ((a === "acoustic" && b === "organic") || (a === "organic" && b === "acoustic")) {
    return 0.25;
  }
  return 0.82;
}

function languageDistance(a: string, b: string) {
  if (a === b) return 0;
  if (a === "Mixed" || b === "Mixed") return 0.4;
  if (a === "Unknown" || b === "Unknown") return 0.35;
  return 0.88;
}

export function computeCompatibility(
  left: SequencerTrackFeatures,
  right: SequencerTrackFeatures,
  goal: SequencerGoal,
  mode: SequencerBoundaryMode = "smooth"
) {
  const weights = GOAL_WEIGHT_MAP[goal];
  const riskParts = [
    Math.abs(left.energy - right.energy) * weights.energy,
    Math.abs(left.valence - right.valence) * weights.valence,
    Math.abs(left.intensity - right.intensity) * weights.intensity,
    Math.abs(left.lyricDensity - right.lyricDensity) * weights.lyricDensity,
    Math.max(0, left.familiarity - right.familiarity) * weights.familiarity,
    (left.genreFamily === right.genreFamily ? 0 : 0.75) * weights.genre,
    textureDistance(left.texture, right.texture) * weights.texture,
    languageDistance(left.language, right.language) * weights.language,
    Math.max(0, left.novelty + right.novelty - 1.1) * weights.noveltyPressure,
  ];

  const maxRisk =
    weights.energy +
    weights.valence +
    weights.intensity +
    weights.lyricDensity +
    weights.familiarity +
    weights.genre +
    weights.texture +
    weights.language +
    weights.noveltyPressure;

  let compatibility = 100 * (1 - clamp(riskParts.reduce((sum, part) => sum + part, 0) / maxRisk));

  if (mode === "neutral") {
    compatibility = clamp(compatibility / 100 + 0.08, 0, 1) * 100;
  }

  if (mode === "intentional") {
    compatibility = clamp(compatibility / 100 + 0.18, 0, 1) * 100;
  }

  return Math.round(compatibility);
}

export function getRiskLabel(compatibility: number): SequencerRiskLabel {
  if (compatibility >= 74) return "smooth";
  if (compatibility >= 52) return "noticeable";
  return "abrupt";
}

export function describeBoundaryChanges(
  left: SequencerTrackFeatures,
  right: SequencerTrackFeatures
) {
  const changes: string[] = [];

  if (Math.abs(left.energy - right.energy) > 0.22) changes.push("energy");
  if (Math.abs(left.intensity - right.intensity) > 0.2) changes.push("intensity");
  if (Math.abs(left.valence - right.valence) > 0.2) changes.push("emotional tone");
  if (Math.abs(left.lyricDensity - right.lyricDensity) > 0.24) changes.push("lyrical density");
  if (left.texture !== right.texture) changes.push("texture");
  if (left.genreFamily !== right.genreFamily) changes.push("genre neighborhood");
  if (left.language !== right.language) changes.push("language");
  if (left.familiarity - right.familiarity > 0.22) changes.push("familiarity");

  return changes.slice(0, 4);
}

export function buildArcProfile(goal: SequencerGoal, blocks: SequencerBlock[]): SequencerArcProfile {
  const ratios =
    blocks.length > 1
      ? blocks.map((_, index) => index / (blocks.length - 1))
      : [0];

  return {
    preset: goal,
    energy: ratios.map((ratio) => Number(getGoalTargets(goal, ratio).energy.toFixed(2))),
    valence: ratios.map((ratio) => Number((0.5 + getGoalTargets(goal, ratio).intensity * 0.15).toFixed(2))),
    familiarity: ratios.map((ratio) => Number(getGoalTargets(goal, ratio).familiarity.toFixed(2))),
    novelty: ratios.map((ratio) => Number(getGoalTargets(goal, ratio).novelty.toFixed(2))),
  };
}

function sequenceCompatibility(tracks: SequencerTrack[], goal: SequencerGoal) {
  const compatibilities = tracks.slice(0, -1).map((track, index) =>
    computeCompatibility(
      track.featureProfile,
      tracks[index + 1].featureProfile,
      goal
    )
  );

  return average(compatibilities);
}

function buildTradeoffs(goal: SequencerGoal, metrics: Omit<SequencerQualityMetrics, "tradeoffs" | "summary">) {
  const tradeoffs: string[] = [];

  if (metrics.cohesion > metrics.variety + 10) {
    tradeoffs.push("Smoother transitions, less surprise.");
  }

  if (metrics.variety > metrics.cohesion + 5) {
    tradeoffs.push("More contrast, slightly rougher handoffs.");
  }

  if (goal === "discovery" && metrics.noveltyPacing < 62) {
    tradeoffs.push("Safer pacing, weaker discovery push.");
  }

  if (goal === "language" && metrics.transitionHealth > 76 && metrics.variety < 58) {
    tradeoffs.push("Cleaner immersion, less stylistic spread.");
  }

  if (tradeoffs.length === 0) {
    tradeoffs.push("Balanced between coherence and surprise.");
  }

  return tradeoffs.slice(0, 3);
}

function buildSummary(goal: SequencerGoal, metrics: Omit<SequencerQualityMetrics, "tradeoffs" | "summary">) {
  const summary: string[] = [];

  if (metrics.transitionHealth < 60) {
    summary.push("Several seams still feel abrupt.");
  } else if (metrics.transitionHealth > 78) {
    summary.push("The playlist moves cleanly between sections.");
  }

  if (goal === "comfort" && metrics.anchorBalance > 75) {
    summary.push("Familiar anchors are carrying the flow well.");
  }

  if (goal === "discovery" && metrics.noveltyPacing > 70) {
    summary.push("New material is spaced well enough to stay inviting.");
  }

  if (metrics.endingStrength > 76) {
    summary.push("The ending lands with intent.");
  }

  if (summary.length === 0) {
    summary.push("The sequence is functional but still has room to sharpen its shape.");
  }

  return summary.slice(0, 3);
}

export function buildQualityMetrics(
  blocks: SequencerBlock[],
  goal: SequencerGoal,
  transitions: Array<{ compatibility: number }>
): SequencerQualityMetrics {
  const tracks = blocks.flatMap((block) => block.tracks);
  const compatibilities = tracks.slice(0, -1).map((track, index) =>
    computeCompatibility(
      track.featureProfile,
      tracks[index + 1].featureProfile,
      goal
    )
  );
  const cohesion = Math.round(average(compatibilities));

  const arcFit = Math.round(
    average(
      tracks.map((track, index) => {
        const target = getGoalTargets(goal, tracks.length <= 1 ? 0 : index / (tracks.length - 1));
        return (
          100 *
          (1 -
            average([
              Math.abs(track.featureProfile.energy - target.energy),
              Math.abs(track.featureProfile.familiarity - target.familiarity),
              Math.abs(track.featureProfile.novelty - target.novelty),
              Math.abs(track.featureProfile.intensity - target.intensity),
            ]))
        );
      })
    )
  );

  const genreFamilies = new Set(tracks.map((track) => track.featureProfile.genreFamily));
  const languageFamilies = new Set(tracks.map((track) => track.featureProfile.language));
  const variety = Math.round(
    clamp(
      genreFamilies.size / Math.max(2, Math.min(6, Math.ceil(tracks.length / 4))) * 0.6 +
        languageFamilies.size / Math.max(2, Math.min(4, Math.ceil(tracks.length / 8))) * 0.2 +
        (1 - Math.abs(0.5 - average(tracks.map((track) => track.featureProfile.energy)))) * 0.2,
      0,
      1
    ) * 100
  );

  const anchorIndices = tracks
    .map((track, index) => ({ value: track.featureProfile.anchor, index }))
    .filter((item) => item.value >= 0.7)
    .map((item) => item.index);
  const anchorGaps =
    anchorIndices.length <= 1
      ? [tracks.length]
      : anchorIndices.slice(1).map((value, index) => value - anchorIndices[index]);
  const anchorBalance = Math.round(
    clamp(1 - average(anchorGaps.map((gap) => Math.abs(gap - 4) / Math.max(4, tracks.length))), 0, 1) *
      100
  );

  const noveltyRuns: number[] = [];
  let currentRun = 0;
  for (const track of tracks) {
    if (track.featureProfile.novelty >= 0.66 || track.featureProfile.demand >= 0.7) {
      currentRun += 1;
    } else if (currentRun > 0) {
      noveltyRuns.push(currentRun);
      currentRun = 0;
    }
  }
  if (currentRun > 0) noveltyRuns.push(currentRun);
  const noveltyPacing = Math.round(
    clamp(1 - average(noveltyRuns.map((run) => Math.max(0, run - 2) / 4)), 0, 1) * 100
  );

  const transitionHealth = Math.round(average(transitions.map((transition) => transition.compatibility)));

  const endingTracks = tracks.slice(-3);
  const endingStrength = Math.round(
    average(
      endingTracks.map((track, index) => {
        if (goal === "discovery") {
          return (track.featureProfile.anchor * 0.55 + track.featureProfile.intensity * 0.45) * 100;
        }
        return (track.featureProfile.comfort * 0.6 + (1 - track.featureProfile.demand) * 0.4) * 100;
      })
    )
  );

  const base = {
    cohesion,
    arcFit,
    variety,
    anchorBalance,
    noveltyPacing,
    transitionHealth,
    endingStrength,
  };

  return {
    ...base,
    tradeoffs: buildTradeoffs(goal, base),
    summary: buildSummary(goal, base),
  };
}

export function summarizeBlock(block: SequencerBlock) {
  const traits = [
    block.metrics.energy >= 0.62
      ? "high-energy"
      : block.metrics.energy <= 0.32
        ? "soft"
        : "mid-energy",
    block.metrics.familiarity >= 0.68
      ? "familiar"
      : block.metrics.novelty >= 0.58
        ? "exploratory"
        : "balanced",
    block.metrics.intensity >= 0.6 ? "dense" : "open",
  ];

  return traits.join(" / ");
}

export function buildBlockMetrics(block: SequencerBlock, goal: SequencerGoal) {
  return {
    ...block.metrics,
    cohesion: Math.round(sequenceCompatibility(block.tracks, goal)),
  };
}
