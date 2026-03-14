import type {
  SequencerArcProfile,
  SequencerBlock,
  SequencerBoundaryMode,
  SequencerGoal,
  SequencerModifier,
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
    case "journey":
      return {
        energy: t < 0.62 ? 0.22 + t * 0.78 : 0.7 - (t - 0.62) * 0.64,
        familiarity: 0.72 - t * 0.12,
        novelty: 0.24 + t * 0.22,
        intensity: t < 0.64 ? 0.24 + t * 0.62 : 0.64 - (t - 0.64) * 0.36,
      };
    case "immersion":
      return {
        energy: 0.3 + t * 0.12,
        familiarity: 0.82 - t * 0.12,
        novelty: 0.16 + t * 0.14,
        intensity: 0.24 + t * 0.12,
      };
    case "discovery":
      return {
        energy: 0.34 + t * 0.24,
        familiarity: 0.68 - t * 0.24,
        novelty: 0.34 + t * 0.36,
        intensity: 0.28 + t * 0.26,
      };
    case "comfort":
      return {
        energy: 0.18 + t * 0.08,
        familiarity: 0.88 - t * 0.08,
        novelty: 0.12 + t * 0.06,
        intensity: 0.16 + t * 0.06,
      };
    case "atmosphere":
      return {
        energy: 0.24 + t * 0.06,
        familiarity: 0.56 + t * 0.02,
        novelty: 0.18 + t * 0.08,
        intensity: 0.18 + t * 0.1,
      };
    case "drive":
      return {
        energy: t < 0.44 ? 0.46 + t * 0.44 : 0.65 + (t - 0.44) * 0.22,
        familiarity: 0.56 - t * 0.02,
        novelty: 0.22 + t * 0.14,
        intensity: t < 0.68 ? 0.38 + t * 0.42 : 0.66 + (t - 0.68) * 0.08,
      };
    case "release":
    default:
      return {
        energy: t < 0.74 ? 0.22 + t * 0.66 : 0.71 - (t - 0.74) * 0.46,
        familiarity: 0.66 - t * 0.08,
        novelty: 0.26 + t * 0.18,
        intensity: t < 0.78 ? 0.24 + t * 0.72 : 0.8 - (t - 0.78) * 0.52,
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
  journey: {
    energy: 1.2,
    valence: 1.05,
    intensity: 1.05,
    lyricDensity: 0.5,
    familiarity: 0.82,
    genre: 0.45,
    texture: 0.72,
    language: 0.35,
    noveltyPressure: 0.75,
  },
  immersion: {
    energy: 0.72,
    valence: 0.38,
    intensity: 0.62,
    lyricDensity: 0.78,
    familiarity: 0.82,
    genre: 0.48,
    texture: 0.76,
    language: 1.28,
    noveltyPressure: 1.02,
  },
  discovery: {
    energy: 0.78,
    valence: 0.55,
    intensity: 0.74,
    lyricDensity: 0.55,
    familiarity: 0.42,
    genre: 0.78,
    texture: 0.68,
    language: 0.4,
    noveltyPressure: 0.32,
  },
  comfort: {
    energy: 1.02,
    valence: 0.68,
    intensity: 1.02,
    lyricDensity: 0.5,
    familiarity: 1.18,
    genre: 0.55,
    texture: 0.82,
    language: 0.4,
    noveltyPressure: 1.18,
  },
  atmosphere: {
    energy: 0.92,
    valence: 0.42,
    intensity: 1.08,
    lyricDensity: 1.08,
    familiarity: 0.48,
    genre: 0.38,
    texture: 1.12,
    language: 0.26,
    noveltyPressure: 0.96,
  },
  drive: {
    energy: 1.34,
    valence: 0.48,
    intensity: 1.26,
    lyricDensity: 0.42,
    familiarity: 0.42,
    genre: 0.3,
    texture: 0.5,
    language: 0.22,
    noveltyPressure: 0.38,
  },
  release: {
    energy: 0.88,
    valence: 0.92,
    intensity: 0.86,
    lyricDensity: 0.48,
    familiarity: 0.66,
    genre: 0.42,
    texture: 0.62,
    language: 0.32,
    noveltyPressure: 0.56,
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

export function computeModifierAdjustment(
  left: SequencerTrackFeatures,
  right: SequencerTrackFeatures,
  modifier: SequencerModifier | null | undefined
) {
  if (!modifier) return 0;

  const energyDiff = Math.abs(left.energy - right.energy);
  const intensityDiff = Math.abs(left.intensity - right.intensity);
  const valenceDiff = Math.abs(left.valence - right.valence);
  const noveltyMean = (left.novelty + right.novelty) / 2;
  const familiarityMean = (left.familiarity + right.familiarity) / 2;
  const anchorMean = (left.anchor + right.anchor) / 2;
  const avgEnergy = (left.energy + right.energy) / 2;
  const avgIntensity = (left.intensity + right.intensity) / 2;
  const avgComfort = (left.comfort + right.comfort) / 2;
  const sameLanguage = left.language === right.language;
  const sameTexture = left.texture === right.texture;
  const sameGenre = left.genreFamily === right.genreFamily;

  switch (modifier) {
    case "smooth":
      return (
        10 -
        energyDiff * 18 -
        intensityDiff * 14 -
        valenceDiff * 8 +
        (sameTexture ? 4 : -3) +
        (sameGenre ? 2 : -2)
      );
    case "adventurous":
      return noveltyMean * 12 + intensityDiff * 4 + (sameGenre ? -2 : 4) + (sameLanguage ? -1 : 2);
    case "anchored":
      return anchorMean * 12 + avgComfort * 6 + familiarityMean * 4 - noveltyMean * 6 - energyDiff * 3;
    case "energized":
      return (
        avgEnergy * 14 +
        avgIntensity * 10 -
        Math.max(0, 0.38 - avgEnergy) * 16 -
        Math.max(0, 0.32 - avgIntensity) * 10
      );
    case "soft-landing":
      return avgComfort * 10 + familiarityMean * 4 - intensityDiff * 5 - Math.max(0, avgEnergy - 0.56) * 6;
    case "focused":
      return (sameLanguage ? 7 : -5) + (sameTexture ? 4 : -3) + (sameGenre ? 3 : -2) - energyDiff * 4;
    case "contrast":
      return energyDiff * 12 + valenceDiff * 10 + intensityDiff * 6 + (sameTexture ? -2 : 3) + (sameGenre ? -1 : 2);
    default:
      return 0;
  }
}

export function computeSequencerCompatibility(
  left: SequencerTrackFeatures,
  right: SequencerTrackFeatures,
  goal: SequencerGoal,
  modifier: SequencerModifier | null | undefined,
  mode: SequencerBoundaryMode = "smooth"
) {
  const primary = computeCompatibility(left, right, goal, mode);
  return Math.round(clamp((primary + computeModifierAdjustment(left, right, modifier)) / 100, 0, 1) * 100);
}

export function isPersonallyNewFeature(
  feature: Pick<SequencerTrackFeatures, "familiarity" | "novelty">
) {
  return feature.novelty >= 0.66 && feature.familiarity <= 0.54;
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

function sequenceCompatibility(
  tracks: SequencerTrack[],
  goal: SequencerGoal,
  modifier?: SequencerModifier | null
) {
  const compatibilities = tracks.slice(0, -1).map((track, index) =>
    computeSequencerCompatibility(
      track.featureProfile,
      tracks[index + 1].featureProfile,
      goal,
      modifier
    )
  );

  return average(compatibilities);
}

function buildTradeoffs(
  goal: SequencerGoal,
  modifier: SequencerModifier | null | undefined,
  metrics: Omit<SequencerQualityMetrics, "tradeoffs" | "summary">
) {
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

  if (goal === "immersion" && metrics.transitionHealth > 76 && metrics.variety < 58) {
    tradeoffs.push("Cleaner immersion, less stylistic spread.");
  }

  if (goal === "atmosphere" && metrics.variety > 64) {
    tradeoffs.push("More palette shifts, weaker atmosphere lock.");
  }

  if (goal === "drive" && metrics.transitionHealth > 80 && metrics.variety < 52) {
    tradeoffs.push("Tighter momentum, less edge and release.");
  }

  if (goal === "release" && metrics.transitionHealth > 78 && metrics.variety < 56) {
    tradeoffs.push("Cleaner setup, slightly less payoff contrast.");
  }

  if (modifier === "smooth" && metrics.transitionHealth < 72) {
    tradeoffs.push("Smooth mode still has a few rough handoffs to clean up.");
  }

  if (modifier === "anchored" && metrics.anchorBalance < 68) {
    tradeoffs.push("Anchored mode needs more recognizable reset points.");
  }

  if (modifier === "focused" && metrics.variety > 68) {
    tradeoffs.push("The palette still wanders more than focused mode wants.");
  }

  if (modifier === "contrast" && metrics.variety < 58) {
    tradeoffs.push("Section turns are still flatter than contrast mode wants.");
  }

  if (tradeoffs.length === 0) {
    tradeoffs.push("Balanced between coherence and surprise.");
  }

  return tradeoffs.slice(0, 3);
}

function buildSummary(
  goal: SequencerGoal,
  modifier: SequencerModifier | null | undefined,
  metrics: Omit<SequencerQualityMetrics, "tradeoffs" | "summary">
) {
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

  if (goal === "immersion" && metrics.transitionHealth > 76) {
    summary.push("The sequence holds a steady world without obvious interruptions.");
  }

  if (goal === "drive" && metrics.arcFit > 74) {
    summary.push("The sequence keeps forward pressure without flattening out.");
  }

  if (goal === "atmosphere" && metrics.cohesion > 76) {
    summary.push("The atmosphere stays coherent section to section.");
  }

  if (goal === "release" && metrics.arcFit > 72 && metrics.endingStrength > 74) {
    summary.push("The late stretch pays off with a clearer sense of release.");
  }

  if (modifier === "smooth" && metrics.transitionHealth > 78) {
    summary.push("Smooth mode is paying off in cleaner handoffs.");
  }

  if (modifier === "adventurous" && metrics.noveltyPacing > 66) {
    summary.push("The bolder picks are spaced well enough to stay fun.");
  }

  if (modifier === "anchored" && metrics.anchorBalance > 74) {
    summary.push("Anchor songs are giving the sequence reliable recovery points.");
  }

  if (modifier === "energized" && metrics.arcFit > 72) {
    summary.push("The energy stays elevated without breaking the larger arc.");
  }

  if (modifier === "soft-landing" && metrics.endingStrength > 76) {
    summary.push("The final stretch settles without feeling like it fizzles.");
  }

  if (modifier === "focused" && metrics.transitionHealth > 74) {
    summary.push("Focused mode keeps the palette locked section to section.");
  }

  if (modifier === "contrast" && metrics.variety > 64) {
    summary.push("Contrast mode gives the sections more distinct identities.");
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
  transitions: Array<{ compatibility: number }>,
  modifier?: SequencerModifier | null
): SequencerQualityMetrics {
  const tracks = blocks.flatMap((block) => block.tracks);
  const compatibilities = tracks.slice(0, -1).map((track, index) =>
    computeSequencerCompatibility(
      track.featureProfile,
      tracks[index + 1].featureProfile,
      goal,
      modifier
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
        if (goal === "discovery" || goal === "drive") {
          return (track.featureProfile.anchor * 0.55 + track.featureProfile.intensity * 0.45) * 100;
        }
        if (goal === "release") {
          return (
            track.featureProfile.anchor * 0.38 +
            track.featureProfile.intensity * 0.34 +
            (1 - track.featureProfile.demand) * 0.16 +
            track.featureProfile.valence * 0.12
          ) * 100;
        }
        if (goal === "journey") {
          return (
            track.featureProfile.comfort * 0.4 +
            track.featureProfile.anchor * 0.24 +
            (1 - track.featureProfile.demand) * 0.2 +
            track.featureProfile.valence * 0.16
          ) * 100;
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
    tradeoffs: buildTradeoffs(goal, modifier, base),
    summary: buildSummary(goal, modifier, base),
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

export function buildBlockMetrics(
  block: SequencerBlock,
  goal: SequencerGoal,
  modifier?: SequencerModifier | null
) {
  return {
    ...block.metrics,
    cohesion: Math.round(sequenceCompatibility(block.tracks, goal, modifier)),
  };
}
