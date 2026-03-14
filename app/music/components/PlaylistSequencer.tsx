"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import { AnimatePresence, motion } from "motion/react";
import { useAlbumColor } from "@/app/lib/use-album-color";
import { GradientOrbs } from "@/app/music/components";
import { hexToRgb } from "@/app/music/lib/chaotic-styles";
import {
  buildArcProfile,
  buildQualityMetrics,
  computeCompatibility,
  describeBoundaryChanges,
  getBoundaryKey,
  getRiskLabel,
} from "@/app/music/lib/sequencer-heuristics";
import {
  SEQUENCER_GOAL_LABELS,
  SEQUENCER_GOALS,
  type SequencerBlock,
  type SequencerBoundary,
  type SequencerBoundaryPreference,
  type SequencerGoal,
  type SequencerSaveInput,
  type SequencerSnapshot,
  type SequencerTrack,
} from "@/app/music/lib/sequencer-types";

type FetchError = Error & { status?: number };

interface PlaylistSequencerProps {
  playlistId: string;
  backHref?: string;
}

interface DraftState {
  goalType: SequencerGoal;
  secondaryGoal: SequencerGoal | null;
  boundaryPreferences: Record<string, SequencerBoundaryPreference>;
  blocks: SequencerBlock[];
}

function cloneBlocks(blocks: SequencerBlock[]) {
  return blocks.map((block) => ({
    ...block,
    warnings: [...block.warnings],
    metrics: { ...block.metrics },
    tracks: block.tracks.map((track) => ({
      ...track,
      roleTags: [...track.roleTags],
      reasons: [...track.reasons],
      featureProfile: { ...track.featureProfile },
    })),
  }));
}

function deepCloneDraft(snapshot: SequencerSnapshot): DraftState {
  return {
    goalType: snapshot.goalType,
    secondaryGoal: snapshot.secondaryGoal,
    boundaryPreferences: { ...snapshot.boundaryPreferences },
    blocks: cloneBlocks(snapshot.blocks),
  };
}

function moveArrayItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function annotateTracks(
  blocks: SequencerBlock[],
  goalType: SequencerGoal,
  boundaryPreferences: Record<string, SequencerBoundaryPreference>
) {
  const nextBlocks = cloneBlocks(blocks)
    .map((block, blockIndex) => ({
      ...block,
      position: blockIndex,
      warnings: [] as string[],
    }));

  let globalPosition = 0;
  for (const block of nextBlocks) {
    block.tracks = block.tracks.map((track, trackIndex) => {
      const previousTrack = block.tracks[trackIndex - 1] || null;
      const nextTrack = block.tracks[trackIndex + 1] || null;
      const roleTags = new Set(track.roleTags);

      if (trackIndex === 0) roleTags.add("opener");
      if (trackIndex === block.tracks.length - 1) roleTags.add("closer");
      if (track.featureProfile.anchor >= 0.72) roleTags.add("anchor");
      if (track.featureProfile.familiarity >= 0.76) roleTags.add("favorite");
      if (track.featureProfile.novelty >= 0.7) roleTags.add("new");
      if (track.featureProfile.bridgePotential >= 0.68) roleTags.add("bridge");

      if (
        previousTrack &&
        track.featureProfile.energy - previousTrack.featureProfile.energy >= 0.16
      ) {
        roleTags.add("lift");
      }

      if (
        previousTrack &&
        previousTrack.featureProfile.intensity - track.featureProfile.intensity >= 0.18 &&
        track.featureProfile.comfort >= 0.52
      ) {
        roleTags.add("reset");
      }

      return {
        ...track,
        blockId: block.id,
        currentPosition: globalPosition++,
        roleTags: Array.from(roleTags).slice(0, 4),
        prevCompatibility: previousTrack
          ? computeCompatibility(
              previousTrack.featureProfile,
              track.featureProfile,
              goalType
            )
          : null,
        nextCompatibility: nextTrack
          ? computeCompatibility(
              track.featureProfile,
              nextTrack.featureProfile,
              goalType
            )
          : null,
      };
    });

    block.metrics = {
      cohesion:
        block.tracks.length === 0
          ? 100
          : Math.round(
              block.tracks.length === 1
                ? 100
                : block.tracks
                    .slice(0, -1)
                    .reduce(
                      (sum, track, index) =>
                        sum +
                        computeCompatibility(
                          track.featureProfile,
                          block.tracks[index + 1].featureProfile,
                          goalType
                        ),
                      0
                    ) /
                    (block.tracks.length - 1)
            ),
      energy:
        block.tracks.length === 0
          ? 0
          : block.tracks.reduce((sum, track) => sum + track.featureProfile.energy, 0) /
            block.tracks.length,
      familiarity:
        block.tracks.length === 0
          ? 0
          : block.tracks.reduce(
              (sum, track) => sum + track.featureProfile.familiarity,
              0
            ) / block.tracks.length,
      novelty:
        block.tracks.length === 0
          ? 0
          : block.tracks.reduce((sum, track) => sum + track.featureProfile.novelty, 0) /
            block.tracks.length,
      intensity:
        block.tracks.length === 0
          ? 0
          : block.tracks.reduce(
              (sum, track) => sum + track.featureProfile.intensity,
              0
            ) / block.tracks.length,
    };

    block.summary =
      block.tracks.length === 0
        ? "empty / staging / waiting for songs"
        : [
            block.metrics.energy >= 0.62
              ? "high-energy"
              : block.metrics.energy <= 0.32
                ? "soft"
                : "mid-energy",
            block.metrics.familiarity >= 0.68
              ? "familiar"
              : block.metrics.novelty >= 0.56
                ? "exploratory"
                : "balanced",
            block.metrics.intensity >= 0.6 ? "dense" : "open",
          ].join(" / ");
  }

  const transitions: SequencerBoundary[] = [];
  const orderedTracks = nextBlocks.flatMap((block) => block.tracks);

  for (let index = 0; index < nextBlocks.length - 1; index += 1) {
    const current = nextBlocks[index];
    const next = nextBlocks[index + 1];
    if (current.tracks.length === 0 || next.tracks.length === 0) continue;
    const tail = current.tracks[current.tracks.length - 1];
    const head = next.tracks[0];
    const id = getBoundaryKey(current.id, next.id);
    const mode = boundaryPreferences[id]?.mode || "smooth";
    const compatibility = computeCompatibility(
      tail.featureProfile,
      head.featureProfile,
      goalType,
      mode
    );
    const bridgeCandidateTrackIds = orderedTracks
      .filter(
        (track) =>
          track.trackId !== tail.trackId &&
          track.trackId !== head.trackId &&
          track.blockId !== current.id &&
          track.blockId !== next.id
      )
      .map((track) => {
        const direct = compatibility;
        const bridgeScore =
          (computeCompatibility(tail.featureProfile, track.featureProfile, goalType) +
            computeCompatibility(track.featureProfile, head.featureProfile, goalType)) /
            2 -
          direct +
          track.featureProfile.bridgePotential * 20;
        return { trackId: track.trackId, bridgeScore };
      })
      .sort((a, b) => b.bridgeScore - a.bridgeScore)
      .slice(0, 3)
      .map((item) => item.trackId);

    transitions.push({
      id,
      fromBlockId: current.id,
      toBlockId: next.id,
      mode,
      compatibility,
      riskLabel: getRiskLabel(compatibility),
      changeSummary: describeBoundaryChanges(
        tail.featureProfile,
        head.featureProfile
      ),
      bridgeCandidateTrackIds,
    });

    if (compatibility < 52) current.warnings.push("edge transition is abrupt");
    else if (compatibility < 74) current.warnings.push("edge transition is noticeable");
  }

  return {
    blocks: nextBlocks.map((block) => ({
      ...block,
      warnings: Array.from(new Set(block.warnings)).slice(0, 2),
    })),
    transitions,
  };
}

function buildDraftPresentation(draft: DraftState) {
  const { blocks, transitions } = annotateTracks(
    draft.blocks,
    draft.goalType,
    draft.boundaryPreferences
  );
  const arcProfile = buildArcProfile(draft.goalType, blocks);
  const metrics = buildQualityMetrics(blocks, draft.goalType, transitions);

  return { blocks, transitions, arcProfile, metrics };
}

function serializeDraft(view: ReturnType<typeof buildDraftPresentation>, draft: DraftState) {
  const payload: SequencerSaveInput = {
    goalType: draft.goalType,
    secondaryGoal: draft.secondaryGoal,
    arcProfile: view.arcProfile,
    boundaryPreferences: draft.boundaryPreferences,
    blocks: view.blocks.map((block) => ({
      id: block.id,
      name: block.name,
      purpose: block.purpose,
      position: block.position,
      colorToken: block.colorToken,
      notes: block.notes,
      locked: block.locked,
    })),
    tracks: view.blocks.flatMap((block) =>
      block.tracks.map((track) => ({
        trackId: track.trackId,
        blockId: block.id,
        position: track.currentPosition,
        roleTags: track.roleTags,
        locked: track.locked,
        hiddenFromAutosort: track.hiddenFromAutosort,
      }))
    ),
  };

  return payload;
}

function reorderTracksWithinBlock(
  tracks: SequencerTrack[],
  goalType: SequencerGoal,
  mode: "smooth" | "surprise"
) {
  const lockedIndexes = tracks
    .map((track, index) => (track.locked ? index : -1))
    .filter((index) => index >= 0);
  const boundaryIndexes = [-1, ...lockedIndexes, tracks.length];
  const output = [...tracks];

  const reorderSegment = (segment: SequencerTrack[]) => {
    if (segment.length <= 2) return segment;
    const pool = [...segment];
    const ordered: SequencerTrack[] = [];
    const start = pool
      .map((track) => ({
        track,
        score:
          mode === "surprise"
            ? track.featureProfile.anchor * 0.25 + track.featureProfile.novelty * 0.35
            : track.featureProfile.comfort * 0.42 + track.featureProfile.anchor * 0.24,
      }))
      .sort((a, b) => b.score - a.score)[0]?.track;

    if (start) {
      ordered.push(start);
      pool.splice(
        pool.findIndex((track) => track.trackId === start.trackId),
        1
      );
    }

    while (pool.length > 0) {
      const previous = ordered[ordered.length - 1];
      const next = pool
        .map((track) => ({
          track,
          score:
            computeCompatibility(previous.featureProfile, track.featureProfile, goalType) +
            (mode === "surprise"
              ? track.featureProfile.novelty * 22
              : track.featureProfile.anchor * 14 + track.featureProfile.comfort * 10),
        }))
        .sort((a, b) => b.score - a.score)[0]?.track;

      if (!next) break;
      ordered.push(next);
      pool.splice(
        pool.findIndex((track) => track.trackId === next.trackId),
        1
      );
    }

    return ordered;
  };

  for (let index = 0; index < boundaryIndexes.length - 1; index += 1) {
    const start = boundaryIndexes[index] + 1;
    const end = boundaryIndexes[index + 1];
    const segment = output.slice(start, end);
    const reordered = reorderSegment(segment);
    output.splice(start, segment.length, ...reordered);
  }

  return output;
}

function MetricBadge({
  label,
  value,
  accentColor,
}: {
  label: string;
  value: number;
  accentColor: string;
}) {
  const rgb = hexToRgb(accentColor);
  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
      style={{
        boxShadow: `0 14px 30px -18px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`,
      }}
    >
      <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">{label}</p>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-xl font-semibold text-white">{value}</span>
        <span className="pb-0.5 text-xs text-white/45">/100</span>
      </div>
    </div>
  );
}

function transitionToneClass(riskLabel: SequencerBoundary["riskLabel"]) {
  if (riskLabel === "smooth") return "text-emerald-300 border-emerald-400/20 bg-emerald-400/10";
  if (riskLabel === "noticeable") return "text-amber-200 border-amber-400/20 bg-amber-400/10";
  return "text-rose-200 border-rose-400/20 bg-rose-400/10";
}

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const json = await response.json();
  if (!response.ok) {
    const error = new Error(json.error || "Failed to load") as FetchError;
    error.status = response.status;
    throw error;
  }
  return json as SequencerSnapshot;
};

export function PlaylistSequencer({
  playlistId,
  backHref = "/music",
}: PlaylistSequencerProps) {
  const { data, error, isLoading, mutate } = useSWR<SequencerSnapshot>(
    `/api/spotify/sequencer/${playlistId}`,
    fetcher
  );
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedBoundaryId, setSelectedBoundaryId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    if (isDirty) return;

    const nextDraft = deepCloneDraft(data);
    setDraft(nextDraft);
    setSelectedBlockId(nextDraft.blocks[0]?.id || null);
    setSelectedBoundaryId(data.transitions[0]?.id || null);
  }, [data, isDirty]);

  const accentColor = useAlbumColor(data?.playlist.imageUrl || null);
  const rgb = hexToRgb(accentColor);
  const view = useMemo(() => (draft ? buildDraftPresentation(draft) : null), [draft]);
  const selectedBlock = view?.blocks.find((block) => block.id === selectedBlockId) || view?.blocks[0] || null;
  const selectedBoundary =
    view?.transitions.find((transition) => transition.id === selectedBoundaryId) ||
    view?.transitions[0] ||
    null;

  useEffect(() => {
    if (selectedBlock || !view?.blocks.length) return;
    setSelectedBlockId(view.blocks[0].id);
  }, [selectedBlock, view?.blocks]);

  const updateDraft = (updater: (current: DraftState) => DraftState) => {
    setDraft((current) => {
      if (!current) return current;
      const next = updater(current);
      setIsDirty(true);
      return next;
    });
  };

  const persistDraft = async (showSavedNotice = true) => {
    if (!draft || !view) return null;
    setIsSaving(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/spotify/sequencer/${playlistId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serializeDraft(view, draft)),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to save");
      setIsDirty(false);
      await mutate(json, false);
      if (showSavedNotice) setNotice("Sequence saved.");
      return json as SequencerSnapshot;
    } catch (saveError) {
      setNotice(
        saveError instanceof Error ? saveError.message : "Failed to save sequence."
      );
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!draft) return;
    setIsRegenerating(true);
    setNotice(null);
    if (isDirty) {
      const saved = await persistDraft(false);
      if (!saved) {
        setIsRegenerating(false);
        return;
      }
    }

    try {
      const nextSnapshot = await fetcher(
        `/api/spotify/sequencer/${playlistId}?regenerate=1`
      );
      setIsDirty(false);
      await mutate(nextSnapshot, false);
      setNotice("Rebuilt the structure from the current goal.");
    } catch (regenError) {
      setNotice(
        regenError instanceof Error
          ? regenError.message
          : "Failed to rebuild the structure."
      );
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleApply = async () => {
    if (!draft) return;

    if (isDirty) {
      const saved = await persistDraft(false);
      if (!saved) return;
    }

    setIsApplying(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/spotify/sequencer/${playlistId}/apply`, {
        method: "POST",
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to apply to Spotify");
      setNotice("Applied the draft order back to Spotify.");
    } catch (applyError) {
      setNotice(
        applyError instanceof Error
          ? applyError.message
          : "Failed to apply the order to Spotify."
      );
    } finally {
      setIsApplying(false);
    }
  };

  if (isLoading || !draft || !view || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-void-black">
        <div className="flex items-center gap-3 text-white/55">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
          <span className="text-sm">Mapping the playlist flow...</span>
        </div>
      </div>
    );
  }

  if ((error as FetchError | undefined)?.status === 401) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-void-black px-6">
        <div className="max-w-sm rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-white/35">Private</p>
          <h2 className="mt-4 text-2xl font-semibold text-white">Sign in to sequence playlists.</h2>
          <p className="mt-3 text-sm text-white/55">
            This workspace writes structure back to your Spotify playlists.
          </p>
          <a
            href="/api/auth/login"
            className="mt-6 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-gray-200"
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-void-black px-6">
        <div className="max-w-md rounded-[2rem] border border-red-500/20 bg-red-500/10 p-8 text-center">
          <h2 className="text-2xl font-semibold text-white">Sequencer unavailable.</h2>
          <p className="mt-3 text-sm text-red-100/70">
            {error.message || "Failed to load this playlist."}
          </p>
          <Link
            href={backHref}
            className="mt-6 inline-flex rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white transition hover:bg-white/10"
          >
            Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-void-black via-charcoal-black to-void-black page-reveal">
      <GradientOrbs primaryColor={accentColor} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(255,255,255,0.05),transparent_36%)]" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 82% 20%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2), transparent 34%)`,
        }}
      />

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center justify-between gap-4">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/55 transition hover:border-white/20 hover:text-white"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isSaving || isApplying || isRegenerating}
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.08] disabled:opacity-50"
            >
              {isRegenerating ? "Rebuilding..." : "Rebuild Shape"}
            </button>
            <button
              type="button"
              onClick={() => {
                void persistDraft();
              }}
              disabled={!isDirty || isSaving || isApplying}
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.08] disabled:opacity-40"
            >
              {isSaving ? "Saving..." : isDirty ? "Save Draft" : "Saved"}
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={isSaving || isApplying || isRegenerating}
              className="rounded-full px-5 py-2 text-sm font-medium text-black transition disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            >
              {isApplying ? "Applying..." : "Apply to Spotify"}
            </button>
          </div>
        </div>

        {notice && (
          <div
            className="mb-5 rounded-2xl border px-4 py-3 text-sm"
            style={{
              borderColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`,
              backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`,
              color: "rgba(255,255,255,0.84)",
            }}
          >
            {notice}
          </div>
        )}

        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04]"
            style={{
              boxShadow: `0 30px 80px -40px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.55)`,
            }}
          >
            <div className="relative min-h-[280px] overflow-hidden">
              {data.playlist.imageUrl ? (
                <>
                  <Image
                    src={data.playlist.imageUrl}
                    alt={data.playlist.name}
                    fill
                    className="object-cover opacity-45"
                    sizes="(max-width: 1024px) 100vw, 60vw"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-black/35 via-black/55 to-black/90" />
                </>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-charcoal-black via-black to-void-black" />
              )}

              <div className="relative z-10 flex h-full flex-col justify-between p-6 md:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">
                      Playlist Sequencer
                    </p>
                    <h1 className="mt-3 max-w-2xl text-3xl font-semibold text-white md:text-5xl">
                      {data.playlist.name}
                    </h1>
                    {data.playlist.description && (
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65 md:text-base">
                        {data.playlist.description}
                      </p>
                    )}
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-md">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">Flow Goal</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {SEQUENCER_GOALS.map((goal) => (
                        <button
                          key={goal}
                          type="button"
                          onClick={() =>
                            updateDraft((current) => ({
                              ...current,
                              goalType: goal,
                            }))
                          }
                          className={`rounded-full border px-3 py-1.5 text-xs transition ${
                            draft.goalType === goal
                              ? "border-white/20 bg-white text-black"
                              : "border-white/10 bg-white/[0.05] text-white/65 hover:border-white/20 hover:text-white"
                          }`}
                        >
                          {SEQUENCER_GOAL_LABELS[goal]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                  <MetricBadge label="Cohesion" value={view.metrics.cohesion} accentColor={accentColor} />
                  <MetricBadge label="Arc Fit" value={view.metrics.arcFit} accentColor={accentColor} />
                  <MetricBadge label="Variety" value={view.metrics.variety} accentColor={accentColor} />
                  <MetricBadge label="Anchors" value={view.metrics.anchorBalance} accentColor={accentColor} />
                  <MetricBadge label="Novelty" value={view.metrics.noveltyPacing} accentColor={accentColor} />
                  <MetricBadge label="Ending" value={view.metrics.endingStrength} accentColor={accentColor} />
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Arc Shape</p>
                <h2 className="mt-2 text-lg font-semibold text-white">How the playlist feels over time</h2>
              </div>
              {isDirty && (
                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-amber-100">
                  Unsaved
                </span>
              )}
            </div>

            <div className="mt-5 space-y-4">
              {[
                { label: "Energy", values: view.arcProfile.energy },
                { label: "Valence", values: view.arcProfile.valence },
                { label: "Familiarity", values: view.arcProfile.familiarity },
                { label: "Novelty", values: view.arcProfile.novelty },
              ].map((lane) => (
                <div key={lane.label}>
                  <div className="mb-2 flex items-center justify-between text-xs text-white/50">
                    <span>{lane.label}</span>
                    <span>{view.arcProfile.preset}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {lane.values.map((value, index) => (
                      <div
                        key={`${lane.label}-${index}`}
                        className="h-12 rounded-2xl border border-white/8 bg-white/[0.03]"
                        style={{
                          background: `linear-gradient(180deg, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.25 + value * 0.45}) 0%, rgba(255,255,255,0.03) 100%)`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-2 text-sm text-white/58">
              {view.metrics.summary.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </motion.div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Flow Rail</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Sections, seams, and block order</h2>
            </div>
            <button
              type="button"
              onClick={() =>
                updateDraft((current) => {
                  const insertAt = current.blocks.length;
                  return {
                    ...current,
                    blocks: [
                      ...current.blocks,
                      {
                        id: crypto.randomUUID(),
                        name: `new block ${insertAt + 1}`,
                        purpose: "manual bridge region",
                        position: insertAt,
                        colorToken: accentColor,
                        notes: null,
                        locked: false,
                        summary: "empty",
                        warnings: [],
                        metrics: {
                          cohesion: 100,
                          energy: 0,
                          familiarity: 0,
                          novelty: 0,
                          intensity: 0,
                        },
                        tracks: [],
                      },
                    ],
                  };
                })
              }
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.08]"
            >
              Insert Block
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2">
            {view.blocks.map((block, index) => (
              <div key={block.id} className="flex items-center gap-3">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSelectedBlockId(block.id);
                    const nextBoundary = view.transitions.find(
                      (transition) => transition.fromBlockId === block.id
                    );
                    if (nextBoundary) setSelectedBoundaryId(nextBoundary.id);
                  }}
                  className={`min-w-[250px] rounded-[1.75rem] border p-4 text-left transition ${
                    selectedBlock?.id === block.id
                      ? "border-white/22 bg-white/[0.08]"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                  }`}
                  style={{
                    boxShadow:
                      selectedBlock?.id === block.id
                        ? `0 22px 50px -30px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`
                        : "none",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <span
                          className="inline-flex h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: block.colorToken || accentColor }}
                        />
                        <span className="text-[11px] uppercase tracking-[0.22em] text-white/38">
                          Section {index + 1}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-white">{block.name}</h3>
                      <p className="mt-2 text-sm text-white/55">{block.summary}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        updateDraft((current) => ({
                          ...current,
                          blocks: current.blocks.map((item) =>
                            item.id === block.id ? { ...item, locked: !item.locked } : item
                          ),
                        }));
                      }}
                      className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.18em] ${
                        block.locked
                          ? "border-white/18 bg-white text-black"
                          : "border-white/10 bg-white/[0.04] text-white/55"
                      }`}
                    >
                      {block.locked ? "Locked" : "Open"}
                    </button>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-white/45">
                    <span>{block.tracks.length} songs</span>
                    <span>{Math.round(block.metrics.cohesion)}/100 cohesion</span>
                  </div>

                  {block.warnings.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {block.warnings.map((warning) => (
                        <span
                          key={warning}
                          className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] text-amber-100"
                        >
                          {warning}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.button>

                {index < view.blocks.length - 1 && (
                  <button
                    type="button"
                    onClick={() => setSelectedBoundaryId(view.transitions[index]?.id || null)}
                    className={`rounded-full border px-3 py-2 text-xs ${transitionToneClass(
                      view.transitions[index]?.riskLabel || "smooth"
                    )}`}
                  >
                    {view.transitions[index]?.compatibility || 0}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 md:p-5"
          >
            {selectedBlock ? (
              <>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Selected Block</p>
                    <input
                      value={selectedBlock.name}
                      onChange={(event) =>
                        updateDraft((current) => ({
                          ...current,
                          blocks: current.blocks.map((block) =>
                            block.id === selectedBlock.id
                              ? { ...block, name: event.target.value }
                              : block
                          ),
                        }))
                      }
                      className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-2xl font-semibold text-white outline-none placeholder:text-white/25"
                    />
                    <textarea
                      value={selectedBlock.purpose}
                      onChange={(event) =>
                        updateDraft((current) => ({
                          ...current,
                          blocks: current.blocks.map((block) =>
                            block.id === selectedBlock.id
                              ? { ...block, purpose: event.target.value }
                              : block
                          ),
                        }))
                      }
                      rows={2}
                      className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/68 outline-none placeholder:text-white/25"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateDraft((current) => {
                          const index = current.blocks.findIndex(
                            (block) => block.id === selectedBlock.id
                          );
                          if (index <= 0) return current;
                          return {
                            ...current,
                            blocks: moveArrayItem(current.blocks, index, index - 1),
                          };
                        })
                      }
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70 transition hover:bg-white/[0.08]"
                    >
                      Move Left
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateDraft((current) => {
                          const index = current.blocks.findIndex(
                            (block) => block.id === selectedBlock.id
                          );
                          if (index < 0 || index >= current.blocks.length - 1) return current;
                          return {
                            ...current,
                            blocks: moveArrayItem(current.blocks, index, index + 1),
                          };
                        })
                      }
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70 transition hover:bg-white/[0.08]"
                    >
                      Move Right
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateDraft((current) => {
                          const index = current.blocks.findIndex(
                            (block) => block.id === selectedBlock.id
                          );
                          const nextBlock = {
                            id: crypto.randomUUID(),
                            name: `bridge ${index + 2}`,
                            purpose: "manual bridge region",
                            position: index + 1,
                            colorToken: selectedBlock.colorToken,
                            notes: null,
                            locked: false,
                            summary: "empty",
                            warnings: [],
                            metrics: {
                              cohesion: 100,
                              energy: 0,
                              familiarity: 0,
                              novelty: 0,
                              intensity: 0,
                            },
                            tracks: [],
                          } satisfies SequencerBlock;

                          const blocks = [...current.blocks];
                          blocks.splice(index + 1, 0, nextBlock);
                          return { ...current, blocks };
                        })
                      }
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70 transition hover:bg-white/[0.08]"
                    >
                      Insert After
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateDraft((current) => {
                          const index = current.blocks.findIndex(
                            (block) => block.id === selectedBlock.id
                          );
                          if (index < 0 || index === current.blocks.length - 1) return current;
                          const merged = [...current.blocks];
                          merged[index] = {
                            ...merged[index],
                            tracks: [...merged[index].tracks, ...merged[index + 1].tracks],
                          };
                          merged.splice(index + 1, 1);
                          return { ...current, blocks: merged };
                        })
                      }
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70 transition hover:bg-white/[0.08]"
                    >
                      Merge Next
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateDraft((current) => {
                          if (current.blocks.length <= 1) return current;
                          const index = current.blocks.findIndex(
                            (block) => block.id === selectedBlock.id
                          );
                          const targetIndex = index === 0 ? 1 : index - 1;
                          const destination = current.blocks[targetIndex];
                          return {
                            ...current,
                            blocks: current.blocks
                              .filter((block) => block.id !== selectedBlock.id)
                              .map((block) =>
                                block.id === destination.id
                                  ? { ...block, tracks: [...block.tracks, ...selectedBlock.tracks] }
                                  : block
                              ),
                          };
                        })
                      }
                      className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-100 transition hover:bg-red-400/16"
                    >
                      Delete Block
                    </button>
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft((current) => ({
                        ...current,
                        blocks: current.blocks.map((block) =>
                          block.id === selectedBlock.id
                            ? {
                                ...block,
                                tracks: reorderTracksWithinBlock(
                                  block.tracks,
                                  current.goalType,
                                  "smooth"
                                ),
                              }
                            : block
                        ),
                      }))
                    }
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70 transition hover:bg-white/[0.08]"
                  >
                    Reorder Block
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft((current) => ({
                        ...current,
                        blocks: current.blocks.map((block) =>
                          block.id === selectedBlock.id
                            ? {
                                ...block,
                                tracks: reorderTracksWithinBlock(
                                  block.tracks,
                                  current.goalType,
                                  "surprise"
                                ),
                              }
                            : block
                        ),
                      }))
                    }
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70 transition hover:bg-white/[0.08]"
                  >
                    Add Surprise
                  </button>
                </div>

                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {selectedBlock.tracks.map((track, index) => (
                      <motion.div
                        key={track.trackId}
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        className="rounded-[1.5rem] border border-white/10 bg-black/20 p-3"
                      >
                        <div className="flex gap-3">
                          <div className="relative h-16 w-16 flex-none overflow-hidden rounded-2xl">
                            {track.albumImageUrl ? (
                              <Image
                                src={track.albumImageUrl}
                                alt={track.title}
                                fill
                                className="object-cover"
                                sizes="64px"
                              />
                            ) : (
                              <div className="absolute inset-0 bg-white/5" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="truncate text-sm font-medium text-white">
                                  {track.title}
                                </h3>
                                <p className="truncate text-xs text-white/48">
                                  {track.artistDisplay}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {track.roleTags.map((tag) => (
                                    <span
                                      key={tag}
                                      className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white/55"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="flex flex-col gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDraft((current) => ({
                                      ...current,
                                      blocks: current.blocks.map((block) =>
                                        block.id === selectedBlock.id
                                          ? {
                                              ...block,
                                              tracks: block.tracks.map((item) =>
                                                item.trackId === track.trackId
                                                  ? { ...item, locked: !item.locked }
                                                  : item
                                              ),
                                            }
                                          : block
                                      ),
                                    }))
                                  }
                                  className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${
                                    track.locked
                                      ? "border-white/18 bg-white text-black"
                                      : "border-white/10 bg-white/[0.05] text-white/55"
                                  }`}
                                >
                                  {track.locked ? "Locked" : "Open"}
                                </button>
                                {track.songUrl && (
                                  <a
                                    href={track.songUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/55 transition hover:text-white"
                                  >
                                    Spotify
                                  </a>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/45">
                              <span>{track.nextCompatibility ?? track.prevCompatibility ?? 100}/100 fit</span>
                              <span>{track.featureProfile.genreFamily}</span>
                              <span>{track.featureProfile.language}</span>
                              <span>{track.featureProfile.texture}</span>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() =>
                                  updateDraft((current) => ({
                                    ...current,
                                    blocks: current.blocks.map((block) =>
                                      block.id === selectedBlock.id
                                        ? {
                                            ...block,
                                            tracks: moveArrayItem(block.tracks, index, index - 1),
                                          }
                                        : block
                                    ),
                                  }))
                                }
                                className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-white/65 transition hover:bg-white/[0.09] disabled:opacity-30"
                              >
                                Earlier
                              </button>
                              <button
                                type="button"
                                disabled={index === selectedBlock.tracks.length - 1}
                                onClick={() =>
                                  updateDraft((current) => ({
                                    ...current,
                                    blocks: current.blocks.map((block) =>
                                      block.id === selectedBlock.id
                                        ? {
                                            ...block,
                                            tracks: moveArrayItem(block.tracks, index, index + 1),
                                          }
                                        : block
                                    ),
                                  }))
                                }
                                className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-white/65 transition hover:bg-white/[0.09] disabled:opacity-30"
                              >
                                Later
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updateDraft((current) => {
                                    const currentIndex = current.blocks.findIndex(
                                      (block) => block.id === selectedBlock.id
                                    );
                                    if (currentIndex <= 0) return current;
                                    const previousBlock = current.blocks[currentIndex - 1];
                                    return {
                                      ...current,
                                      blocks: current.blocks.map((block) => {
                                        if (block.id === selectedBlock.id) {
                                          return {
                                            ...block,
                                            tracks: block.tracks.filter(
                                              (item) => item.trackId !== track.trackId
                                            ),
                                          };
                                        }
                                        if (block.id === previousBlock.id) {
                                          return {
                                            ...block,
                                            tracks: [...block.tracks, track],
                                          };
                                        }
                                        return block;
                                      }),
                                    };
                                  })
                                }
                                className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-white/65 transition hover:bg-white/[0.09]"
                              >
                                To Previous Block
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updateDraft((current) => {
                                    const currentIndex = current.blocks.findIndex(
                                      (block) => block.id === selectedBlock.id
                                    );
                                    if (currentIndex < 0 || currentIndex >= current.blocks.length - 1) {
                                      return current;
                                    }
                                    const nextBlock = current.blocks[currentIndex + 1];
                                    return {
                                      ...current,
                                      blocks: current.blocks.map((block) => {
                                        if (block.id === selectedBlock.id) {
                                          return {
                                            ...block,
                                            tracks: block.tracks.filter(
                                              (item) => item.trackId !== track.trackId
                                            ),
                                          };
                                        }
                                        if (block.id === nextBlock.id) {
                                          return {
                                            ...block,
                                            tracks: [track, ...block.tracks],
                                          };
                                        }
                                        return block;
                                      }),
                                    };
                                  })
                                }
                                className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-white/65 transition hover:bg-white/[0.09]"
                              >
                                To Next Block
                              </button>
                              {index < selectedBlock.tracks.length - 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDraft((current) => ({
                                      ...current,
                                      blocks: current.blocks.flatMap((block) => {
                                        if (block.id !== selectedBlock.id) return [block];
                                        const leftTracks = block.tracks.slice(0, index + 1);
                                        const rightTracks = block.tracks.slice(index + 1);
                                        if (rightTracks.length === 0) return [block];
                                        return [
                                          { ...block, tracks: leftTracks },
                                          {
                                            ...block,
                                            id: crypto.randomUUID(),
                                            name: `${block.name} split`,
                                            tracks: rightTracks,
                                            locked: false,
                                          },
                                        ];
                                      }),
                                    }))
                                  }
                                  className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-white/65 transition hover:bg-white/[0.09]"
                                >
                                  Split After
                                </button>
                              )}
                              {track.nextCompatibility != null && track.nextCompatibility < 58 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDraft((current) => ({
                                      ...current,
                                      blocks: current.blocks.map((block) =>
                                        block.id === selectedBlock.id
                                          ? {
                                              ...block,
                                              tracks: reorderTracksWithinBlock(
                                                block.tracks,
                                                current.goalType,
                                                "smooth"
                                              ),
                                            }
                                          : block
                                      ),
                                    }))
                                  }
                                  className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-100 transition hover:bg-amber-400/15"
                                >
                                  Smooth Jump
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-white/10 px-5 py-10 text-center text-white/45">
                Select a block to edit its local order.
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="space-y-5"
          >
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Transition Panel</p>
                  <h2 className="mt-2 text-lg font-semibold text-white">Manage seams between blocks</h2>
                </div>
                {selectedBoundary && (
                  <span
                    className={`rounded-full border px-3 py-1 text-xs ${transitionToneClass(
                      selectedBoundary.riskLabel
                    )}`}
                  >
                    {selectedBoundary.riskLabel}
                  </span>
                )}
              </div>

              {selectedBoundary ? (
                <>
                  <div className="mt-5 space-y-3">
                    <p className="text-sm text-white/72">
                      This seam shifts{" "}
                      <span className="text-white">
                        {selectedBoundary.changeSummary.join(", ") || "a few subtle traits"}
                      </span>
                      .
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {view.transitions.map((transition) => (
                        <button
                          key={transition.id}
                          type="button"
                          onClick={() => setSelectedBoundaryId(transition.id)}
                          className={`rounded-full border px-3 py-1.5 text-xs transition ${
                            selectedBoundary.id === transition.id
                              ? transitionToneClass(transition.riskLabel)
                              : "border-white/10 bg-white/[0.04] text-white/55 hover:text-white"
                          }`}
                        >
                          {transition.compatibility} {transition.id.split(":").length > 1 ? "fit" : ""}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 space-y-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateDraft((current) => {
                          const candidateId = selectedBoundary.bridgeCandidateTrackIds[0];
                          if (!candidateId) return current;
                          const fromIndex = current.blocks.findIndex((block) =>
                            block.tracks.some((track) => track.trackId === candidateId)
                          );
                          const leftIndex = current.blocks.findIndex(
                            (block) => block.id === selectedBoundary.fromBlockId
                          );
                          if (fromIndex < 0 || leftIndex < 0) return current;
                          const candidate =
                            current.blocks[fromIndex].tracks.find(
                              (track) => track.trackId === candidateId
                            ) || null;
                          if (!candidate) return current;

                          const bridgeBlock: SequencerBlock = {
                            id: crypto.randomUUID(),
                            name: "bridge",
                            purpose: "bridge the boundary cleanly",
                            position: leftIndex + 1,
                            colorToken: accentColor,
                            notes: null,
                            locked: false,
                            summary: "bridge / mixed / stabilizing",
                            warnings: [],
                            metrics: {
                              cohesion: 100,
                              energy: candidate.featureProfile.energy,
                              familiarity: candidate.featureProfile.familiarity,
                              novelty: candidate.featureProfile.novelty,
                              intensity: candidate.featureProfile.intensity,
                            },
                            tracks: [candidate],
                          };

                          const blocks = current.blocks
                            .map((block) => ({
                              ...block,
                              tracks: block.tracks.filter(
                                (track) => track.trackId !== candidateId
                              ),
                            }))
                            .filter((block) => block.tracks.length > 0);
                          blocks.splice(leftIndex + 1, 0, bridgeBlock);

                          return { ...current, blocks };
                        })
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-left text-sm text-white/72 transition hover:bg-white/[0.08]"
                    >
                      Insert bridge song
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateDraft((current) => ({
                          ...current,
                          blocks: current.blocks.map((block) =>
                            block.id === selectedBoundary.fromBlockId
                              ? {
                                  ...block,
                                  tracks: reorderTracksWithinBlock(
                                    block.tracks,
                                    current.goalType,
                                    "smooth"
                                  ),
                                }
                              : block
                          ),
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-left text-sm text-white/72 transition hover:bg-white/[0.08]"
                    >
                      Soften the previous ending
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateDraft((current) => ({
                          ...current,
                          blocks: current.blocks.map((block) =>
                            block.id === selectedBoundary.toBlockId
                              ? {
                                  ...block,
                                  tracks: reorderTracksWithinBlock(
                                    block.tracks,
                                    current.goalType,
                                    "smooth"
                                  ),
                                }
                              : block
                          ),
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-left text-sm text-white/72 transition hover:bg-white/[0.08]"
                    >
                      Strengthen the next opening
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateDraft((current) => ({
                          ...current,
                          boundaryPreferences: {
                            ...current.boundaryPreferences,
                            [selectedBoundary.id]: { mode: "intentional" },
                          },
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-left text-sm text-white/72 transition hover:bg-white/[0.08]"
                    >
                      Mark as intentional shift
                    </button>
                  </div>
                </>
              ) : (
                <div className="mt-5 rounded-[1.5rem] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/45">
                  This playlist only has one block so there is no seam to manage yet.
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Flow Coach</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Suggestions and tradeoffs</h2>

              <div className="mt-5 space-y-3">
                {data.suggestions
                  .concat(
                    view.metrics.tradeoffs.map((detail, index) => ({
                      id: `tradeoff-${index}`,
                      type: "structure" as const,
                      title: "Tradeoff in play",
                      detail,
                    }))
                  )
                  .map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4"
                  >
                    <h3 className="text-sm font-medium text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/58">{item.detail}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateDraft((current) => ({
                      ...current,
                      blocks: current.blocks.map((block) => ({
                        ...block,
                        tracks: reorderTracksWithinBlock(
                          block.tracks,
                          current.goalType,
                          "smooth"
                        ),
                      })),
                    }))
                  }
                  className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/72 transition hover:bg-white/[0.08]"
                >
                  Make this flow better
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateDraft((current) => ({
                      ...current,
                      goalType: "comfort",
                    }))
                  }
                  className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/72 transition hover:bg-white/[0.08]"
                >
                  Make it more comforting
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateDraft((current) => ({
                      ...current,
                      goalType: "discovery",
                    }))
                  }
                  className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/72 transition hover:bg-white/[0.08]"
                >
                  Make it more exploratory
                </button>
              </div>
            </div>
          </motion.div>
        </section>
      </main>
    </div>
  );
}
