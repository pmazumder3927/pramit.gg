import {
  average,
  clamp,
  computeCompatibility,
  getGoalTargets,
} from "@/app/music/lib/sequencer-heuristics";
import type {
  SequencerArcProfile,
  SequencerBlock,
  SequencerGoal,
  SequencerMiniPlaylist,
  SequencerTrack,
} from "@/app/music/lib/sequencer-types";

type ReorderMode = "smooth" | "surprise";

interface OptimizerOptions {
  goalType: SequencerGoal;
  secondaryGoal?: SequencerGoal | null;
  arcProfile?: SequencerArcProfile | null;
  mode?: ReorderMode;
  leadingTrack?: SequencerTrack | null;
  trailingTrack?: SequencerTrack | null;
}

interface BeamState {
  ordered: SequencerTrack[];
  remaining: SequencerTrack[];
  score: number;
  tracksSinceAnchor: number;
  noveltyRun: number;
  demandRun: number;
}

interface BlockPlanRange {
  start: number;
  end: number;
}

const DEFAULT_TRACK_DURATION_MS = 3.5 * 60 * 1000;

function trackDurationMs(track: Pick<SequencerTrack, "durationMs">) {
  return Math.max(30_000, track.durationMs || DEFAULT_TRACK_DURATION_MS);
}

function totalDurationMs<T extends Pick<SequencerTrack, "durationMs">>(tracks: T[]) {
  return tracks.reduce((sum, track) => sum + trackDurationMs(track), 0);
}

function interpolate(values: number[], ratio: number, fallback: number) {
  if (!values.length) return fallback;
  if (values.length === 1) return values[0];
  const position = clamp(ratio, 0, 1) * (values.length - 1);
  const left = Math.floor(position);
  const right = Math.ceil(position);
  if (left === right) return values[left];
  const weight = position - left;
  return values[left] * (1 - weight) + values[right] * weight;
}

function blendedCompatibility(
  left: SequencerTrack,
  right: SequencerTrack,
  goalType: SequencerGoal,
  secondaryGoal: SequencerGoal | null | undefined
) {
  const primary = computeCompatibility(left.featureProfile, right.featureProfile, goalType);
  if (!secondaryGoal || secondaryGoal === goalType) return primary;
  const secondary = computeCompatibility(
    left.featureProfile,
    right.featureProfile,
    secondaryGoal
  );
  return Math.round(primary * 0.7 + secondary * 0.3);
}

function trackTargetProfile(
  ratio: number,
  goalType: SequencerGoal,
  secondaryGoal?: SequencerGoal | null,
  arcProfile?: SequencerArcProfile | null
) {
  const primary = getGoalTargets(goalType, ratio);
  const secondary =
    secondaryGoal && secondaryGoal !== goalType
      ? getGoalTargets(secondaryGoal, ratio)
      : primary;

  const energy =
    arcProfile?.energy?.length
      ? interpolate(arcProfile.energy, ratio, primary.energy)
      : primary.energy * 0.72 + secondary.energy * 0.28;
  const familiarity =
    arcProfile?.familiarity?.length
      ? interpolate(arcProfile.familiarity, ratio, primary.familiarity)
      : primary.familiarity * 0.72 + secondary.familiarity * 0.28;
  const novelty =
    arcProfile?.novelty?.length
      ? interpolate(arcProfile.novelty, ratio, primary.novelty)
      : primary.novelty * 0.72 + secondary.novelty * 0.28;

  return {
    energy,
    familiarity,
    novelty,
    intensity: primary.intensity * 0.72 + secondary.intensity * 0.28,
    valence:
      arcProfile?.valence?.length
        ? interpolate(arcProfile.valence, ratio, 0.5 + primary.intensity * 0.15)
        : 0.5 + (primary.intensity * 0.72 + secondary.intensity * 0.28) * 0.15,
  };
}

function arcAffinity(
  track: SequencerTrack,
  ratio: number,
  goalType: SequencerGoal,
  secondaryGoal?: SequencerGoal | null,
  arcProfile?: SequencerArcProfile | null
) {
  const target = trackTargetProfile(ratio, goalType, secondaryGoal, arcProfile);
  return (
    100 *
    (1 -
      average([
        Math.abs(track.featureProfile.energy - target.energy),
        Math.abs(track.featureProfile.familiarity - target.familiarity),
        Math.abs(track.featureProfile.novelty - target.novelty),
        Math.abs(track.featureProfile.intensity - target.intensity),
        Math.abs(track.featureProfile.valence - target.valence),
      ]))
  );
}

function openerStrength(
  track: SequencerTrack,
  goalType: SequencerGoal,
  secondaryGoal?: SequencerGoal | null
) {
  const languageFocus =
    goalType === "language" || secondaryGoal === "language"
      ? track.featureProfile.language !== "Unknown"
        ? 0.08
        : 0
      : 0;

  return (
    (track.featureProfile.comfort * 0.42 +
      track.featureProfile.anchor * 0.28 +
      (1 - track.featureProfile.demand) * 0.18 +
      (1 - track.featureProfile.novelty) * 0.12 +
      languageFocus) *
    100
  );
}

function closerStrength(
  track: SequencerTrack,
  goalType: SequencerGoal,
  secondaryGoal?: SequencerGoal | null
) {
  const discoveryWeight =
    goalType === "discovery" || secondaryGoal === "discovery";

  const value = discoveryWeight
    ? track.featureProfile.anchor * 0.34 +
      track.featureProfile.intensity * 0.28 +
      (1 - track.featureProfile.novelty) * 0.1 +
      (1 - track.featureProfile.demand) * 0.28
    : track.featureProfile.comfort * 0.38 +
      (1 - track.featureProfile.demand) * 0.28 +
      track.featureProfile.familiarity * 0.22 +
      track.featureProfile.anchor * 0.12;

  return value * 100;
}

function noveltyRunPenalty(tracks: SequencerTrack[]) {
  let run = 0;
  let penalty = 0;
  for (const track of tracks) {
    if (track.featureProfile.novelty >= 0.68 || track.featureProfile.demand >= 0.72) {
      run += 1;
      if (run > 2) penalty += (run - 2) * 6.5;
    } else {
      run = 0;
    }
  }
  return penalty;
}

function anchorSpacingScore(tracks: SequencerTrack[]) {
  const anchorIndices = tracks
    .map((track, index) => ({ index, anchor: track.featureProfile.anchor }))
    .filter((item) => item.anchor >= 0.7)
    .map((item) => item.index);

  if (tracks.length <= 1) return 100;
  if (anchorIndices.length === 0) return 42;
  if (anchorIndices.length === 1) return clamp(1 - Math.abs(anchorIndices[0] - tracks.length / 2) / tracks.length) * 100;

  const gaps = anchorIndices.slice(1).map((value, index) => value - anchorIndices[index]);
  return clamp(1 - average(gaps.map((gap) => Math.abs(gap - 4) / Math.max(4, tracks.length / 2))), 0, 1) * 100;
}

function scoreSequence(
  tracks: SequencerTrack[],
  {
    goalType,
    secondaryGoal = null,
    arcProfile = null,
    leadingTrack = null,
    trailingTrack = null,
    mode = "smooth",
  }: OptimizerOptions
) {
  if (tracks.length === 0) return 0;

  const adjacencyPairs: number[] = [];
  if (leadingTrack && tracks[0]) {
    adjacencyPairs.push(blendedCompatibility(leadingTrack, tracks[0], goalType, secondaryGoal));
  }
  for (let index = 0; index < tracks.length - 1; index += 1) {
    adjacencyPairs.push(
      blendedCompatibility(tracks[index], tracks[index + 1], goalType, secondaryGoal)
    );
  }
  if (trailingTrack && tracks[tracks.length - 1]) {
    adjacencyPairs.push(
      blendedCompatibility(tracks[tracks.length - 1], trailingTrack, goalType, secondaryGoal)
    );
  }

  const adjacencyScore = average(adjacencyPairs);
  const arcScore = average(
    tracks.map((track, index) =>
      arcAffinity(
        track,
        tracks.length <= 1 ? 0 : index / (tracks.length - 1),
        goalType,
        secondaryGoal,
        arcProfile
      )
    )
  );

  const pacingPenalty = noveltyRunPenalty(tracks);
  const anchorScore = anchorSpacingScore(tracks);
  const openerScore = openerStrength(tracks[0], goalType, secondaryGoal);
  const closerScore = closerStrength(tracks[tracks.length - 1], goalType, secondaryGoal);

  const surpriseBoost =
    mode === "surprise"
      ? average(tracks.slice(0, -1).map((track, index) => {
          const next = tracks[index + 1];
          const energyChange = Math.abs(track.featureProfile.energy - next.featureProfile.energy);
          const genreChange =
            track.featureProfile.genreFamily === next.featureProfile.genreFamily ? 0 : 1;
          return clamp(energyChange * 0.6 + genreChange * 0.4) * 100;
        }))
      : 0;

  const modeAdjustment = mode === "surprise" ? surpriseBoost * 0.08 : 0;

  return (
    adjacencyScore * (mode === "surprise" ? 0.42 : 0.5) +
    arcScore * 0.24 +
    openerScore * 0.08 +
    closerScore * 0.08 +
    anchorScore * 0.08 -
    pacingPenalty +
    modeAdjustment
  );
}

function candidateScore(
  state: BeamState,
  track: SequencerTrack,
  nextIndex: number,
  totalCount: number,
  options: OptimizerOptions
) {
  const prev = state.ordered[state.ordered.length - 1] || options.leadingTrack || null;
  const ratio = totalCount <= 1 ? 0 : nextIndex / (totalCount - 1);
  const arcScore = arcAffinity(
    track,
    ratio,
    options.goalType,
    options.secondaryGoal,
    options.arcProfile
  );
  const continuity = prev
    ? blendedCompatibility(prev, track, options.goalType, options.secondaryGoal)
    : openerStrength(track, options.goalType, options.secondaryGoal);

  const needAnchor = state.tracksSinceAnchor >= 3;
  const anchorBonus = needAnchor ? track.featureProfile.anchor * 18 : track.featureProfile.anchor * 4;
  const resetBonus =
    state.demandRun >= 1 && track.featureProfile.comfort >= 0.56
      ? track.featureProfile.comfort * 12
      : 0;
  const noveltyPenalty =
    state.noveltyRun >= 2 && track.featureProfile.novelty >= 0.68
      ? 18
      : 0;
  const demandPenalty =
    state.demandRun >= 1 && track.featureProfile.demand >= 0.72
      ? 14
      : 0;
  const surpriseBonus =
    options.mode === "surprise"
      ? track.featureProfile.novelty * 16 +
        (track.featureProfile.genreFamily !== prev?.featureProfile.genreFamily ? 8 : 0)
      : 0;

  return (
    continuity * (options.mode === "surprise" ? 0.44 : 0.58) +
    arcScore * 0.24 +
    anchorBonus +
    resetBonus +
    surpriseBonus -
    noveltyPenalty -
    demandPenalty
  );
}

function pruneCandidates(state: BeamState, options: OptimizerOptions, totalCount: number) {
  const nextIndex = state.ordered.length;
  return [...state.remaining]
    .map((track) => ({
      track,
      score: candidateScore(state, track, nextIndex, totalCount, options),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(12, Math.max(6, Math.ceil(state.remaining.length / 6))))
    .map((item) => item.track);
}

function finalizeBeamState(state: BeamState, options: OptimizerOptions) {
  return (
    state.score +
    closerStrength(
      state.ordered[state.ordered.length - 1],
      options.goalType,
      options.secondaryGoal
    ) *
      0.18
  );
}

function improveOrderLocally(
  tracks: SequencerTrack[],
  options: OptimizerOptions
) {
  if (tracks.length <= 3) return tracks;

  let best = [...tracks];
  let bestScore = scoreSequence(best, options);

  for (let pass = 0; pass < 3; pass += 1) {
    let improved = false;

    for (let from = 0; from < best.length; from += 1) {
      const minTo = Math.max(0, from - 4);
      const maxTo = Math.min(best.length - 1, from + 4);

      for (let to = minTo; to <= maxTo; to += 1) {
        if (to === from) continue;
        const candidate = [...best];
        const [item] = candidate.splice(from, 1);
        candidate.splice(to, 0, item);
        const score = scoreSequence(candidate, options);
        if (score > bestScore + 0.9) {
          best = candidate;
          bestScore = score;
          improved = true;
        }
      }
    }

    for (let left = 0; left < best.length - 1; left += 1) {
      for (let right = left + 1; right < Math.min(best.length, left + 6); right += 1) {
        const candidate = [...best];
        [candidate[left], candidate[right]] = [candidate[right], candidate[left]];
        const score = scoreSequence(candidate, options);
        if (score > bestScore + 0.9) {
          best = candidate;
          bestScore = score;
          improved = true;
        }
      }
    }

    if (!improved) break;
  }

  return best;
}

function optimizeTrackOrder(
  tracks: SequencerTrack[],
  options: OptimizerOptions
) {
  if (tracks.length <= 2) return tracks;

  const sortedOpeners = [...tracks]
    .map((track) => ({
      track,
      score: openerStrength(track, options.goalType, options.secondaryGoal),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(8, tracks.length));

  let beam: BeamState[] = sortedOpeners.map(({ track }) => ({
    ordered: [track],
    remaining: tracks.filter((candidate) => candidate.trackId !== track.trackId),
    score: openerStrength(track, options.goalType, options.secondaryGoal) * 0.28,
    tracksSinceAnchor: track.featureProfile.anchor >= 0.7 ? 0 : 1,
    noveltyRun: track.featureProfile.novelty >= 0.68 ? 1 : 0,
    demandRun: track.featureProfile.demand >= 0.72 ? 1 : 0,
  }));

  const beamWidth = Math.min(18, Math.max(8, Math.ceil(tracks.length / 6)));

  while (beam.some((state) => state.remaining.length > 0)) {
    const nextBeam: BeamState[] = [];

    for (const state of beam) {
      if (state.remaining.length === 0) {
        nextBeam.push(state);
        continue;
      }

      const candidates = pruneCandidates(state, options, tracks.length);
      for (const candidate of candidates) {
        const nextOrdered = [...state.ordered, candidate];
        const nextRemaining = state.remaining.filter(
          (track) => track.trackId !== candidate.trackId
        );
        const delta = candidateScore(
          state,
          candidate,
          state.ordered.length,
          tracks.length,
          options
        );

        nextBeam.push({
          ordered: nextOrdered,
          remaining: nextRemaining,
          score: state.score + delta,
          tracksSinceAnchor: candidate.featureProfile.anchor >= 0.7 ? 0 : state.tracksSinceAnchor + 1,
          noveltyRun:
            candidate.featureProfile.novelty >= 0.68
              ? state.noveltyRun + 1
              : 0,
          demandRun:
            candidate.featureProfile.demand >= 0.72
              ? state.demandRun + 1
              : 0,
        });
      }
    }

    beam = nextBeam
      .sort((a, b) => finalizeBeamState(b, options) - finalizeBeamState(a, options))
      .slice(0, beamWidth);
  }

  const best = beam.sort((a, b) => finalizeBeamState(b, options) - finalizeBeamState(a, options))[0];
  return improveOrderLocally(best?.ordered || tracks, options);
}

export function buildOptimizedTrackOrder(
  tracks: SequencerTrack[],
  options: OptimizerOptions
) {
  return optimizeTrackOrder(tracks, {
    ...options,
    mode: options.mode || "smooth",
  });
}

export function reorderTracksWithinBlockOptimized(
  tracks: SequencerTrack[],
  options: OptimizerOptions
) {
  if (tracks.length <= 2) return tracks;

  const immovableIndexes = tracks
    .map((track, index) => (track.locked || track.hiddenFromAutosort ? index : -1))
    .filter((index) => index >= 0);

  if (immovableIndexes.length === 0) {
    return buildOptimizedTrackOrder(tracks, options);
  }

  const boundaries = [-1, ...immovableIndexes, tracks.length];
  const next = [...tracks];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index] + 1;
    const end = boundaries[index + 1];
    const segment = next.slice(start, end);
    if (segment.length <= 1) continue;
    const leadingTrack = start > 0 ? next[start - 1] : options.leadingTrack || null;
    const trailingTrack =
      end < next.length ? next[end] : options.trailingTrack || null;
    const reordered = buildOptimizedTrackOrder(segment, {
      ...options,
      leadingTrack,
      trailingTrack,
    });
    next.splice(start, segment.length, ...reordered);
  }

  return next;
}

function estimateBlockTargetCount(tracks: SequencerTrack[]) {
  const durationMinutes = totalDurationMs(tracks) / 60_000;
  const durationDriven = Math.round(durationMinutes / 26);
  const trackDriven = Math.round(tracks.length / 9);
  return clamp(Math.round(durationDriven * 0.65 + trackDriven * 0.35), 2, 14);
}

function buildPrefixDurations(tracks: SequencerTrack[]) {
  const prefix = [0];
  for (const track of tracks) {
    prefix.push(prefix[prefix.length - 1] + trackDurationMs(track));
  }
  return prefix;
}

function durationBetween(prefix: number[], start: number, end: number) {
  return prefix[end] - prefix[start];
}

function segmentScore(
  tracks: SequencerTrack[],
  start: number,
  end: number,
  targetDurationMs: number,
  options: OptimizerOptions,
  prefixDurations: number[]
) {
  const slice = tracks.slice(start, end);
  if (slice.length === 0) return -Infinity;

  const duration = durationBetween(prefixDurations, start, end);
  const durationFit =
    100 *
    clamp(
      1 - Math.abs(duration - targetDurationMs) / Math.max(targetDurationMs, 8 * 60_000),
      0,
      1
    );
  const cohesion = average(
    slice.slice(0, -1).map((track, index) =>
      blendedCompatibility(track, slice[index + 1], options.goalType, options.secondaryGoal)
    )
  );
  const arcScore = average(
    slice.map((track, index) =>
      arcAffinity(
        track,
        tracks.length <= 1 ? 0 : (start + index) / (tracks.length - 1),
        options.goalType,
        options.secondaryGoal,
        options.arcProfile
      )
    )
  );
  const openerScore = openerStrength(slice[0], options.goalType, options.secondaryGoal);
  const closerScore = closerStrength(
    slice[slice.length - 1],
    options.goalType,
    options.secondaryGoal
  );

  return cohesion * 0.42 + arcScore * 0.22 + durationFit * 0.2 + openerScore * 0.08 + closerScore * 0.08;
}

export function buildOptimizedBlockPlan(
  tracks: SequencerTrack[],
  options: OptimizerOptions
) {
  if (tracks.length === 0) return [] satisfies BlockPlanRange[];

  const prefixDurations = buildPrefixDurations(tracks);
  const totalDuration = totalDurationMs(tracks);
  const estimatedCount = estimateBlockTargetCount(tracks);
  const minTracks = tracks.length >= 30 ? 4 : 3;
  const maxTracks = Math.max(minTracks + 2, Math.ceil(tracks.length / Math.max(2, estimatedCount - 1)) + 2);
  const targetDurationMs = totalDuration / estimatedCount;

  let bestRanges: BlockPlanRange[] = [{ start: 0, end: tracks.length }];
  let bestScore = -Infinity;

  for (const blockCount of [estimatedCount - 1, estimatedCount, estimatedCount + 1]) {
    if (blockCount < 2) continue;

    const dp = Array.from({ length: blockCount + 1 }, () =>
      Array.from({ length: tracks.length + 1 }, () => -Infinity)
    );
    const prev = Array.from({ length: blockCount + 1 }, () =>
      Array.from({ length: tracks.length + 1 }, () => -1)
    );
    dp[0][0] = 0;

    for (let used = 1; used <= blockCount; used += 1) {
      for (let end = used * minTracks; end <= tracks.length; end += 1) {
        for (
          let start = Math.max((used - 1) * minTracks, end - maxTracks);
          start <= end - minTracks;
          start += 1
        ) {
          if (dp[used - 1][start] === -Infinity) continue;
          const score = segmentScore(
            tracks,
            start,
            end,
            targetDurationMs,
            options,
            prefixDurations
          );
          if (!Number.isFinite(score)) continue;

          const seamBonus =
            start > 0
              ? 100 -
                blendedCompatibility(
                  tracks[start - 1],
                  tracks[start],
                  options.goalType,
                  options.secondaryGoal
                )
              : 0;
          const total = dp[used - 1][start] + score + seamBonus * 0.12;
          if (total > dp[used][end]) {
            dp[used][end] = total;
            prev[used][end] = start;
          }
        }
      }
    }

    if (dp[blockCount][tracks.length] <= bestScore) continue;

    const ranges: BlockPlanRange[] = [];
    let end = tracks.length;
    let used = blockCount;
    while (used > 0 && end > 0) {
      const start = prev[used][end];
      if (start < 0) break;
      ranges.push({ start, end });
      end = start;
      used -= 1;
    }

    if (ranges.length === blockCount) {
      bestScore = dp[blockCount][tracks.length];
      bestRanges = ranges.reverse();
    }
  }

  return bestRanges;
}

function chapterQuality(
  tracks: SequencerTrack[],
  options: OptimizerOptions
) {
  if (tracks.length === 0) return 0;
  const adjacency = average(
    tracks.slice(0, -1).map((track, index) =>
      blendedCompatibility(track, tracks[index + 1], options.goalType, options.secondaryGoal)
    )
  );
  const opener = openerStrength(tracks[0], options.goalType, options.secondaryGoal);
  const closer = closerStrength(
    tracks[tracks.length - 1],
    options.goalType,
    options.secondaryGoal
  );
  return Math.round(adjacency * 0.56 + opener * 0.16 + closer * 0.16 + anchorSpacingScore(tracks) * 0.12);
}

function chapterSummary(tracks: SequencerTrack[], quality: number) {
  const energy = average(tracks.map((track) => track.featureProfile.energy));
  const novelty = average(tracks.map((track) => track.featureProfile.novelty));
  const landing =
    closerStrength(tracks[tracks.length - 1], "comfort") >= 70
      ? "clean landing"
      : "open ending";

  const energyLabel =
    energy >= 0.62 ? "high lift" : energy <= 0.32 ? "soft drift" : "steady cruise";
  const noveltyLabel =
    novelty >= 0.58 ? "exploratory" : novelty <= 0.32 ? "familiar" : "balanced";
  const polishLabel = quality >= 76 ? "smooth handoffs" : quality >= 60 ? "textured flow" : "rougher seams";

  return `${energyLabel} · ${noveltyLabel} · ${polishLabel} · ${landing}`;
}

export function buildMiniPlaylistChapters(
  blocks: SequencerBlock[],
  options: OptimizerOptions
) {
  if (blocks.length === 0) return [] satisfies SequencerMiniPlaylist[];

  const blockDurations = blocks.map((block) => totalDurationMs(block.tracks));
  const totalDuration = blockDurations.reduce((sum, value) => sum + value, 0);
  if (totalDuration < 75 * 60_000 || blocks.length < 3) {
    return [] satisfies SequencerMiniPlaylist[];
  }

  const targetChapterCount = clamp(
    Math.round(totalDuration / (44 * 60_000)),
    2,
    Math.min(8, Math.max(2, blocks.length))
  );
  const targetDuration = totalDuration / targetChapterCount;
  const prefixDurations = [0];
  for (const duration of blockDurations) {
    prefixDurations.push(prefixDurations[prefixDurations.length - 1] + duration);
  }

  const dp = Array.from({ length: targetChapterCount + 1 }, () =>
    Array.from({ length: blocks.length + 1 }, () => -Infinity)
  );
  const prev = Array.from({ length: targetChapterCount + 1 }, () =>
    Array.from({ length: blocks.length + 1 }, () => -1)
  );
  dp[0][0] = 0;

  for (let used = 1; used <= targetChapterCount; used += 1) {
    for (let end = used; end <= blocks.length; end += 1) {
      for (let start = used - 1; start < end; start += 1) {
        if (dp[used - 1][start] === -Infinity) continue;
        const duration = prefixDurations[end] - prefixDurations[start];
        const durationFit =
          100 *
          clamp(
            1 - Math.abs(duration - targetDuration) / Math.max(targetDuration, 10 * 60_000),
            0,
            1
          );
        const segmentTracks = blocks.slice(start, end).flatMap((block) => block.tracks);
        const quality = chapterQuality(segmentTracks, options);
        const total = dp[used - 1][start] + quality * 0.66 + durationFit * 0.34;
        if (total > dp[used][end]) {
          dp[used][end] = total;
          prev[used][end] = start;
        }
      }
    }
  }

  const segments: Array<{ start: number; end: number }> = [];
  let end = blocks.length;
  let used = targetChapterCount;
  while (used > 0) {
    const start = prev[used][end];
    if (start < 0) break;
    segments.push({ start, end });
    end = start;
    used -= 1;
  }

  const orderedSegments = (segments.length ? segments.reverse() : [{ start: 0, end: blocks.length }]);

  return orderedSegments.map((segment, index) => {
    const chapterBlocks = blocks.slice(segment.start, segment.end);
    const tracks = chapterBlocks.flatMap((block) => block.tracks);
    const duration = totalDurationMs(tracks);
    const quality = chapterQuality(tracks, options);

    return {
      id: `chapter-${index + 1}`,
      title: `Ride ${index + 1}`,
      summary: chapterSummary(tracks, quality),
      trackCount: tracks.length,
      durationMs: duration,
      targetDurationMs: Math.round(targetDuration),
      quality,
      startBlockId: chapterBlocks[0]?.id || null,
      endBlockId: chapterBlocks[chapterBlocks.length - 1]?.id || null,
      blockIds: chapterBlocks.map((block) => block.id),
      trackIds: tracks.map((track) => track.trackId),
    } satisfies SequencerMiniPlaylist;
  });
}
