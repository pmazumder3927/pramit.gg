"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import { AnimatePresence, motion } from "motion/react";
import { useAlbumColor } from "@/app/lib/use-album-color";
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

// ---------------------------------------------------------------------------
// Pure logic helpers (unchanged)
// ---------------------------------------------------------------------------

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
  const nextBlocks = cloneBlocks(blocks).map((block, blockIndex) => ({
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
      )
        roleTags.add("lift");
      if (
        previousTrack &&
        previousTrack.featureProfile.intensity - track.featureProfile.intensity >= 0.18 &&
        track.featureProfile.comfort >= 0.52
      )
        roleTags.add("reset");

      return {
        ...track,
        blockId: block.id,
        currentPosition: globalPosition++,
        roleTags: Array.from(roleTags).slice(0, 4),
        prevCompatibility: previousTrack
          ? computeCompatibility(previousTrack.featureProfile, track.featureProfile, goalType)
          : null,
        nextCompatibility: nextTrack
          ? computeCompatibility(track.featureProfile, nextTrack.featureProfile, goalType)
          : null,
      };
    });

    block.metrics = {
      cohesion:
        block.tracks.length <= 1
          ? 100
          : Math.round(
              block.tracks
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
          : block.tracks.reduce((s, t) => s + t.featureProfile.energy, 0) / block.tracks.length,
      familiarity:
        block.tracks.length === 0
          ? 0
          : block.tracks.reduce((s, t) => s + t.featureProfile.familiarity, 0) /
            block.tracks.length,
      novelty:
        block.tracks.length === 0
          ? 0
          : block.tracks.reduce((s, t) => s + t.featureProfile.novelty, 0) / block.tracks.length,
      intensity:
        block.tracks.length === 0
          ? 0
          : block.tracks.reduce((s, t) => s + t.featureProfile.intensity, 0) /
            block.tracks.length,
    };

    block.summary =
      block.tracks.length === 0
        ? "empty"
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
  const orderedTracks = nextBlocks.flatMap((b) => b.tracks);

  for (let i = 0; i < nextBlocks.length - 1; i++) {
    const current = nextBlocks[i];
    const next = nextBlocks[i + 1];
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
        (t) =>
          t.trackId !== tail.trackId &&
          t.trackId !== head.trackId &&
          t.blockId !== current.id &&
          t.blockId !== next.id
      )
      .map((t) => ({
        trackId: t.trackId,
        bridgeScore:
          (computeCompatibility(tail.featureProfile, t.featureProfile, goalType) +
            computeCompatibility(t.featureProfile, head.featureProfile, goalType)) /
            2 -
          compatibility +
          t.featureProfile.bridgePotential * 20,
      }))
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
      changeSummary: describeBoundaryChanges(tail.featureProfile, head.featureProfile),
      bridgeCandidateTrackIds,
    });

    if (compatibility < 52) current.warnings.push("abrupt edge");
    else if (compatibility < 74) current.warnings.push("noticeable edge");
  }

  return {
    blocks: nextBlocks.map((b) => ({
      ...b,
      warnings: Array.from(new Set(b.warnings)).slice(0, 2),
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

function serializeDraft(
  view: ReturnType<typeof buildDraftPresentation>,
  draft: DraftState
) {
  const payload: SequencerSaveInput = {
    goalType: draft.goalType,
    secondaryGoal: draft.secondaryGoal,
    arcProfile: view.arcProfile,
    boundaryPreferences: draft.boundaryPreferences,
    blocks: view.blocks.map((b) => ({
      id: b.id,
      name: b.name,
      purpose: b.purpose,
      position: b.position,
      colorToken: b.colorToken,
      notes: b.notes,
      locked: b.locked,
    })),
    tracks: view.blocks.flatMap((b) =>
      b.tracks.map((t) => ({
        trackId: t.trackId,
        blockId: b.id,
        position: t.currentPosition,
        roleTags: t.roleTags,
        locked: t.locked,
        hiddenFromAutosort: t.hiddenFromAutosort,
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
    .map((t, i) => (t.locked ? i : -1))
    .filter((i) => i >= 0);
  const boundaryIndexes = [-1, ...lockedIndexes, tracks.length];
  const output = [...tracks];

  const reorderSegment = (segment: SequencerTrack[]) => {
    if (segment.length <= 2) return segment;
    const pool = [...segment];
    const ordered: SequencerTrack[] = [];
    const start = pool
      .map((t) => ({
        track: t,
        score:
          mode === "surprise"
            ? t.featureProfile.anchor * 0.25 + t.featureProfile.novelty * 0.35
            : t.featureProfile.comfort * 0.42 + t.featureProfile.anchor * 0.24,
      }))
      .sort((a, b) => b.score - a.score)[0]?.track;

    if (start) {
      ordered.push(start);
      pool.splice(
        pool.findIndex((t) => t.trackId === start.trackId),
        1
      );
    }

    while (pool.length > 0) {
      const prev = ordered[ordered.length - 1];
      const next = pool
        .map((t) => ({
          track: t,
          score:
            computeCompatibility(prev.featureProfile, t.featureProfile, goalType) +
            (mode === "surprise"
              ? t.featureProfile.novelty * 22
              : t.featureProfile.anchor * 14 + t.featureProfile.comfort * 10),
        }))
        .sort((a, b) => b.score - a.score)[0]?.track;
      if (!next) break;
      ordered.push(next);
      pool.splice(
        pool.findIndex((t) => t.trackId === next.trackId),
        1
      );
    }
    return ordered;
  };

  for (let i = 0; i < boundaryIndexes.length - 1; i++) {
    const start = boundaryIndexes[i] + 1;
    const end = boundaryIndexes[i + 1];
    const segment = output.slice(start, end);
    const reordered = reorderSegment(segment);
    output.splice(start, segment.length, ...reordered);
  }

  return output;
}

// ---------------------------------------------------------------------------
// UI sub-components
// ---------------------------------------------------------------------------

const ROLE_COLORS: Record<string, string> = {
  anchor: "bg-blue-400",
  favorite: "bg-pink-400",
  bridge: "bg-amber-400",
  opener: "bg-emerald-400",
  closer: "bg-purple-400",
  new: "bg-cyan-400",
  lift: "bg-orange-400",
  reset: "bg-teal-400",
};

function CompatDot({ value }: { value: number | null }) {
  if (value == null) return null;
  const color =
    value >= 74
      ? "bg-emerald-400/70"
      : value >= 52
        ? "bg-amber-400/70"
        : "bg-rose-400/70";
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${color}`}
      title={`${value}/100 compatibility`}
    />
  );
}

function TrackRow({
  track,
  index,
  total,
  blockId,
  blockCount,
  accentColor,
  onUpdate,
}: {
  track: SequencerTrack;
  index: number;
  total: number;
  blockId: string;
  blockCount: number;
  accentColor: string;
  onUpdate: (updater: (d: DraftState) => DraftState) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const rgb = hexToRgb(accentColor);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const moveTrack = (dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= total) return;
    onUpdate((d) => ({
      ...d,
      blocks: d.blocks.map((b) =>
        b.id === blockId ? { ...b, tracks: moveArrayItem(b.tracks, index, to) } : b
      ),
    }));
  };

  const toggleLock = () =>
    onUpdate((d) => ({
      ...d,
      blocks: d.blocks.map((b) =>
        b.id === blockId
          ? {
              ...b,
              tracks: b.tracks.map((t) =>
                t.trackId === track.trackId ? { ...t, locked: !t.locked } : t
              ),
            }
          : b
      ),
    }));

  const sendToBlock = (dir: "prev" | "next") =>
    onUpdate((d) => {
      const ci = d.blocks.findIndex((b) => b.id === blockId);
      const ti = dir === "prev" ? ci - 1 : ci + 1;
      if (ti < 0 || ti >= d.blocks.length) return d;
      return {
        ...d,
        blocks: d.blocks.map((b, bi) => {
          if (bi === ci) return { ...b, tracks: b.tracks.filter((t) => t.trackId !== track.trackId) };
          if (bi === ti) {
            const insertTracks = dir === "prev" ? [...b.tracks, track] : [track, ...b.tracks];
            return { ...b, tracks: insertTracks };
          }
          return b;
        }),
      };
    });

  const splitAfter = () =>
    onUpdate((d) => ({
      ...d,
      blocks: d.blocks.flatMap((b) => {
        if (b.id !== blockId) return [b];
        const left = b.tracks.slice(0, index + 1);
        const right = b.tracks.slice(index + 1);
        if (right.length === 0) return [b];
        return [
          { ...b, tracks: left },
          {
            ...b,
            id: crypto.randomUUID(),
            name: `${b.name} (split)`,
            tracks: right,
            locked: false,
          },
        ];
      }),
    }));

  const hasJump = track.nextCompatibility != null && track.nextCompatibility < 58;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      className="group relative flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]"
    >
      {/* Compatibility edge indicator */}
      {track.prevCompatibility != null && (
        <div
          className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full"
          style={{
            backgroundColor:
              track.prevCompatibility >= 74
                ? "rgba(52,211,153,0.5)"
                : track.prevCompatibility >= 52
                  ? "rgba(251,191,36,0.5)"
                  : "rgba(251,113,133,0.6)",
          }}
        />
      )}

      {/* Position number */}
      <span className="w-5 flex-none text-center text-[11px] tabular-nums text-white/25">
        {index + 1}
      </span>

      {/* Album art */}
      <div className="relative h-10 w-10 flex-none overflow-hidden rounded-lg">
        {track.albumImageUrl ? (
          <Image src={track.albumImageUrl} alt="" fill className="object-cover" sizes="40px" />
        ) : (
          <div className="absolute inset-0 bg-white/5" />
        )}
      </div>

      {/* Track info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h4 className="truncate text-sm font-medium text-white">{track.title}</h4>
          {track.locked && (
            <svg className="h-3 w-3 flex-none text-white/40" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
          <CompatDot value={track.nextCompatibility} />
        </div>
        <p className="truncate text-xs text-white/40">{track.artistDisplay}</p>
        <div className="mt-1 flex items-center gap-1">
          {track.roleTags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className={`inline-block h-1.5 w-1.5 rounded-full ${ROLE_COLORS[tag] || "bg-white/20"}`}
              title={tag}
            />
          ))}
          {track.roleTags.length > 0 && (
            <span className="ml-1 text-[10px] text-white/25">
              {track.roleTags.slice(0, 2).join(" / ")}
            </span>
          )}
        </div>
      </div>

      {/* Hover actions */}
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => moveTrack(-1)}
          disabled={index === 0}
          className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-20"
          title="Move up"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => moveTrack(1)}
          disabled={index === total - 1}
          className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-20"
          title="Move down"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={toggleLock}
          className={`rounded-lg p-1.5 transition ${
            track.locked
              ? "text-white/80 hover:bg-white/[0.08]"
              : "text-white/40 hover:bg-white/[0.08] hover:text-white"
          }`}
          title={track.locked ? "Unlock" : "Lock position"}
        >
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
            {track.locked ? (
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            ) : (
              <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
            )}
          </svg>
        </button>

        {/* More actions dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/[0.08] hover:text-white"
          >
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl border border-white/10 bg-charcoal-black/95 py-1 shadow-xl backdrop-blur-xl"
              >
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => { sendToBlock("prev"); setMenuOpen(false); }}
                    className="w-full px-3 py-2 text-left text-xs text-white/60 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    Send to previous section
                  </button>
                )}
                {blockCount > 1 && (
                  <button
                    type="button"
                    onClick={() => { sendToBlock("next"); setMenuOpen(false); }}
                    className="w-full px-3 py-2 text-left text-xs text-white/60 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    Send to next section
                  </button>
                )}
                {index < total - 1 && (
                  <button
                    type="button"
                    onClick={() => { splitAfter(); setMenuOpen(false); }}
                    className="w-full px-3 py-2 text-left text-xs text-white/60 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    Split section here
                  </button>
                )}
                {hasJump && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdate((d) => ({
                        ...d,
                        blocks: d.blocks.map((b) =>
                          b.id === blockId
                            ? { ...b, tracks: reorderTracksWithinBlock(b.tracks, d.goalType, "smooth") }
                            : b
                        ),
                      }));
                      setMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-amber-200/80 transition hover:bg-amber-400/10"
                  >
                    Smooth this jump
                  </button>
                )}
                {track.songUrl && (
                  <a
                    href={track.songUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-full px-3 py-2 text-left text-xs text-white/60 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    Open in Spotify
                  </a>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function FlowStrip({
  blocks,
  transitions,
  selectedBlockId,
  onSelectBlock,
  onSelectTransition,
  accentColor,
}: {
  blocks: SequencerBlock[];
  transitions: SequencerBoundary[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string) => void;
  onSelectTransition: (id: string) => void;
  accentColor: string;
}) {
  const rgb = hexToRgb(accentColor);
  const totalTracks = blocks.reduce((s, b) => s + b.tracks.length, 0) || 1;
  const stripRef = useRef<HTMLDivElement>(null);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
      <div ref={stripRef} className="flex items-end gap-0" style={{ height: 88 }}>
        {blocks.map((block, bi) => {
          const pct = Math.max(6, (block.tracks.length / totalTracks) * 100);
          const isSelected = block.id === selectedBlockId;

          return (
            <Fragment key={block.id}>
              <button
                type="button"
                onClick={() => onSelectBlock(block.id)}
                className="relative flex items-end gap-px overflow-hidden transition-all duration-300"
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: isSelected
                    ? `linear-gradient(180deg, rgba(${rgb.r},${rgb.g},${rgb.b},0.06) 0%, rgba(${rgb.r},${rgb.g},${rgb.b},0.14) 100%)`
                    : "transparent",
                  borderBottom: isSelected ? `2px solid ${accentColor}` : "2px solid transparent",
                }}
              >
                {/* Energy waveform bars */}
                <div className="flex h-full w-full items-end justify-center gap-px px-1 pb-5">
                  {block.tracks.map((track) => {
                    const barH = 10 + track.featureProfile.energy * 48;
                    return (
                      <div
                        key={track.trackId}
                        className="rounded-t-sm transition-all duration-500"
                        style={{
                          height: barH,
                          flex: "1 1 0",
                          minWidth: 2,
                          maxWidth: 10,
                          backgroundColor: isSelected
                            ? `rgba(${rgb.r},${rgb.g},${rgb.b},${0.35 + track.featureProfile.energy * 0.55})`
                            : `rgba(255,255,255,${0.06 + track.featureProfile.energy * 0.14})`,
                        }}
                      />
                    );
                  })}
                  {block.tracks.length === 0 && (
                    <div className="flex h-full items-center">
                      <span className="text-[10px] text-white/20">empty</span>
                    </div>
                  )}
                </div>

                {/* Block label */}
                <div className="absolute bottom-0 left-0 right-0 px-2 py-1">
                  <p
                    className={`truncate text-[10px] font-medium transition-colors ${
                      isSelected ? "text-white/70" : "text-white/30"
                    }`}
                  >
                    {block.name}
                  </p>
                </div>
              </button>

              {/* Seam dot */}
              {bi < blocks.length - 1 && transitions[bi] && (
                <button
                  type="button"
                  onClick={() => onSelectTransition(transitions[bi].id)}
                  className="relative z-10 flex h-full flex-none items-center px-0.5"
                  title={`${transitions[bi].compatibility}/100 — ${transitions[bi].riskLabel}`}
                >
                  <motion.div
                    className={`h-2 w-2 rounded-full ${
                      transitions[bi].riskLabel === "smooth"
                        ? "bg-emerald-400/80"
                        : transitions[bi].riskLabel === "noticeable"
                          ? "bg-amber-400/80"
                          : "bg-rose-400/80"
                    }`}
                    animate={
                      transitions[bi].riskLabel === "abrupt"
                        ? { scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] }
                        : {}
                    }
                    transition={
                      transitions[bi].riskLabel === "abrupt"
                        ? { duration: 2, repeat: Infinity }
                        : {}
                    }
                  />
                </button>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function TransitionSheet({
  boundary,
  blocks,
  accentColor,
  onClose,
  onUpdate,
  goalType,
}: {
  boundary: SequencerBoundary;
  blocks: SequencerBlock[];
  accentColor: string;
  onClose: () => void;
  onUpdate: (updater: (d: DraftState) => DraftState) => void;
  goalType: SequencerGoal;
}) {
  const fromBlock = blocks.find((b) => b.id === boundary.fromBlockId);
  const toBlock = blocks.find((b) => b.id === boundary.toBlockId);
  const riskClass =
    boundary.riskLabel === "smooth"
      ? "text-emerald-300 border-emerald-400/20 bg-emerald-400/10"
      : boundary.riskLabel === "noticeable"
        ? "text-amber-200 border-amber-400/20 bg-amber-400/10"
        : "text-rose-200 border-rose-400/20 bg-rose-400/10";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      className="overflow-hidden rounded-2xl border border-white/[0.08] bg-charcoal-black/80 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
        <div className="flex items-center gap-3">
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${riskClass}`}>
            {boundary.riskLabel}
          </span>
          <span className="text-xs text-white/40">
            {fromBlock?.name} → {toBlock?.name}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-white/30 transition hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-5 py-4">
        <p className="text-sm text-white/60">
          This seam shifts{" "}
          <span className="text-white/90">
            {boundary.changeSummary.join(", ") || "subtle traits"}
          </span>
          .
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {boundary.bridgeCandidateTrackIds.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onUpdate((d) => {
                  const candidateId = boundary.bridgeCandidateTrackIds[0];
                  if (!candidateId) return d;
                  const fromIdx = d.blocks.findIndex((b) => b.tracks.some((t) => t.trackId === candidateId));
                  const leftIdx = d.blocks.findIndex((b) => b.id === boundary.fromBlockId);
                  if (fromIdx < 0 || leftIdx < 0) return d;
                  const candidate = d.blocks[fromIdx].tracks.find((t) => t.trackId === candidateId);
                  if (!candidate) return d;
                  const bridgeBlock: SequencerBlock = {
                    id: crypto.randomUUID(),
                    name: "bridge",
                    purpose: "bridge transition",
                    position: leftIdx + 1,
                    colorToken: accentColor,
                    notes: null,
                    locked: false,
                    summary: "bridge",
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
                  const blocks = d.blocks
                    .map((b) => ({ ...b, tracks: b.tracks.filter((t) => t.trackId !== candidateId) }))
                    .filter((b) => b.tracks.length > 0);
                  blocks.splice(leftIdx + 1, 0, bridgeBlock);
                  return { ...d, blocks };
                });
                onClose();
              }}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-left text-xs text-white/60 transition hover:bg-white/[0.06] hover:text-white"
            >
              Insert bridge song
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onUpdate((d) => ({
                ...d,
                blocks: d.blocks.map((b) =>
                  b.id === boundary.fromBlockId
                    ? { ...b, tracks: reorderTracksWithinBlock(b.tracks, d.goalType, "smooth") }
                    : b
                ),
              }));
              onClose();
            }}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-left text-xs text-white/60 transition hover:bg-white/[0.06] hover:text-white"
          >
            Soften previous ending
          </button>
          <button
            type="button"
            onClick={() => {
              onUpdate((d) => ({
                ...d,
                blocks: d.blocks.map((b) =>
                  b.id === boundary.toBlockId
                    ? { ...b, tracks: reorderTracksWithinBlock(b.tracks, d.goalType, "smooth") }
                    : b
                ),
              }));
              onClose();
            }}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-left text-xs text-white/60 transition hover:bg-white/[0.06] hover:text-white"
          >
            Strengthen next opening
          </button>
          <button
            type="button"
            onClick={() => {
              onUpdate((d) => ({
                ...d,
                boundaryPreferences: {
                  ...d.boundaryPreferences,
                  [boundary.id]: { mode: "intentional" },
                },
              }));
              onClose();
            }}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-left text-xs text-white/60 transition hover:bg-white/[0.06] hover:text-white"
          >
            Mark as intentional shift
          </button>
        </div>
      </div>
    </motion.div>
  );
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

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
  const [activeBoundaryId, setActiveBoundaryId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCoach, setShowCoach] = useState(false);
  const [editingBlockName, setEditingBlockName] = useState(false);

  useEffect(() => {
    if (!data || isDirty) return;
    const nextDraft = deepCloneDraft(data);
    setDraft(nextDraft);
    setSelectedBlockId(nextDraft.blocks[0]?.id || null);
  }, [data, isDirty]);

  const accentColor = useAlbumColor(data?.playlist.imageUrl || null);
  const rgb = hexToRgb(accentColor);
  const view = useMemo(() => (draft ? buildDraftPresentation(draft) : null), [draft]);
  const selectedBlock =
    view?.blocks.find((b) => b.id === selectedBlockId) || view?.blocks[0] || null;
  const activeBoundary =
    view?.transitions.find((t) => t.id === activeBoundaryId) || null;

  useEffect(() => {
    if (selectedBlock || !view?.blocks.length) return;
    setSelectedBlockId(view.blocks[0].id);
  }, [selectedBlock, view?.blocks]);

  const updateDraft = (updater: (current: DraftState) => DraftState) => {
    setDraft((current) => {
      if (!current) return current;
      setIsDirty(true);
      return updater(current);
    });
  };

  const persistDraft = async (showSavedNotice = true) => {
    if (!draft || !view) return null;
    setIsSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/spotify/sequencer/${playlistId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serializeDraft(view, draft)),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setIsDirty(false);
      await mutate(json, false);
      if (showSavedNotice) setNotice("Saved.");
      return json as SequencerSnapshot;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Save failed.");
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
      if (!saved) { setIsRegenerating(false); return; }
    }
    try {
      const next = await fetcher(`/api/spotify/sequencer/${playlistId}?regenerate=1`);
      setIsDirty(false);
      await mutate(next, false);
      setNotice("Rebuilt from current goal.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Rebuild failed.");
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
      const res = await fetch(`/api/spotify/sequencer/${playlistId}/apply`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Apply failed");
      setNotice("Applied to Spotify.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Apply failed.");
    } finally {
      setIsApplying(false);
    }
  };

  // Loading / error states
  if (isLoading || !draft || !view || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-white/40">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/15 border-t-white/70" />
          <span className="text-sm">Mapping the flow...</span>
        </div>
      </div>
    );
  }

  if ((error as FetchError | undefined)?.status === 401) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/30">Private</p>
          <h2 className="mt-3 text-xl font-semibold text-white">Sign in to sequence playlists</h2>
          <a
            href="/api/auth/login"
            className="mt-5 inline-flex rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition hover:bg-gray-200"
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-rose-500/20 bg-rose-500/10 p-8 text-center">
          <h2 className="text-xl font-semibold text-white">Sequencer unavailable</h2>
          <p className="mt-2 text-sm text-rose-100/60">{error.message}</p>
          <Link
            href={backHref}
            className="mt-5 inline-flex rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-white transition hover:bg-white/10"
          >
            Back
          </Link>
        </div>
      </div>
    );
  }

  const totalTracks = view.blocks.reduce((s, b) => s + b.tracks.length, 0);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-white/[0.06]"
        style={{ boxShadow: `0 20px 60px -30px rgba(${rgb.r},${rgb.g},${rgb.b},0.5)` }}
      >
        {/* Background art */}
        <div className="absolute inset-0">
          {data.playlist.imageUrl ? (
            <>
              <Image
                src={data.playlist.imageUrl}
                alt=""
                fill
                className="object-cover opacity-30 blur-sm"
                sizes="100vw"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/80" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-charcoal-black to-void-black" />
          )}
        </div>

        <div className="relative z-10 px-5 py-5 sm:px-6">
          {/* Top bar */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href={backHref}
                className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/[0.08] hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-lg font-semibold text-white sm:text-xl">
                  {data.playlist.name}
                </h1>
                <p className="text-xs text-white/35">
                  {totalTracks} tracks &middot; {view.blocks.length} sections
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isDirty && (
                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-amber-200/80">
                  unsaved
                </span>
              )}
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={isSaving || isApplying || isRegenerating}
                className="rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-xs text-white/60 transition hover:bg-white/[0.1] hover:text-white disabled:opacity-40"
              >
                {isRegenerating ? "Rebuilding..." : "Rebuild"}
              </button>
              <button
                type="button"
                onClick={() => void persistDraft()}
                disabled={!isDirty || isSaving || isApplying}
                className="rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-xs text-white/60 transition hover:bg-white/[0.1] hover:text-white disabled:opacity-30"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={isSaving || isApplying || isRegenerating}
                className="rounded-full px-4 py-1.5 text-xs font-medium text-black transition disabled:opacity-40"
                style={{ backgroundColor: accentColor }}
              >
                {isApplying ? "Applying..." : "Apply to Spotify"}
              </button>
            </div>
          </div>

          {/* Goal pills */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/25">Goal</span>
            {SEQUENCER_GOALS.map((goal) => (
              <motion.button
                key={goal}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => updateDraft((d) => ({ ...d, goalType: goal }))}
                className={`rounded-full px-3 py-1.5 text-xs transition-all ${
                  draft.goalType === goal
                    ? "font-medium text-black"
                    : "border border-white/10 bg-white/[0.04] text-white/50 hover:text-white"
                }`}
                style={
                  draft.goalType === goal
                    ? {
                        backgroundColor: accentColor,
                        boxShadow: `0 4px 14px rgba(${rgb.r},${rgb.g},${rgb.b},0.35)`,
                      }
                    : {}
                }
              >
                {SEQUENCER_GOAL_LABELS[goal]}
              </motion.button>
            ))}
          </div>

          {/* Compact metrics strip */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/30">
            {[
              { label: "Cohesion", value: view.metrics.cohesion },
              { label: "Arc", value: view.metrics.arcFit },
              { label: "Variety", value: view.metrics.variety },
              { label: "Anchors", value: view.metrics.anchorBalance },
              { label: "Pacing", value: view.metrics.noveltyPacing },
              { label: "Ending", value: view.metrics.endingStrength },
            ].map((m) => (
              <span key={m.label}>
                {m.label}{" "}
                <span
                  className={
                    m.value >= 75
                      ? "text-emerald-300/70"
                      : m.value >= 55
                        ? "text-amber-200/70"
                        : "text-rose-300/70"
                  }
                >
                  {m.value}
                </span>
              </span>
            ))}
            <button
              type="button"
              onClick={() => setShowCoach(!showCoach)}
              className="text-white/40 transition hover:text-white/70"
            >
              {showCoach ? "Hide coach" : "Show coach"}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Notice */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 overflow-hidden rounded-xl border px-4 py-2.5 text-xs"
            style={{
              borderColor: `rgba(${rgb.r},${rgb.g},${rgb.b},0.2)`,
              backgroundColor: `rgba(${rgb.r},${rgb.g},${rgb.b},0.08)`,
              color: "rgba(255,255,255,0.75)",
            }}
          >
            <div className="flex items-center justify-between">
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice(null)} className="text-white/40 hover:text-white">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Flow Strip (waveform) ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mt-4"
      >
        <FlowStrip
          blocks={view.blocks}
          transitions={view.transitions}
          selectedBlockId={selectedBlockId}
          onSelectBlock={(id) => {
            setSelectedBlockId(id);
            setActiveBoundaryId(null);
          }}
          onSelectTransition={(id) => setActiveBoundaryId(id)}
          accentColor={accentColor}
        />
      </motion.div>

      {/* ── Transition sheet (shows when a seam dot is clicked) ── */}
      <AnimatePresence>
        {activeBoundary && (
          <div className="mt-3">
            <TransitionSheet
              boundary={activeBoundary}
              blocks={view.blocks}
              accentColor={accentColor}
              onClose={() => setActiveBoundaryId(null)}
              onUpdate={updateDraft}
              goalType={draft.goalType}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ── Coach panel (collapsible) ── */}
      <AnimatePresence>
        {showCoach && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 overflow-hidden"
          >
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/25">Flow Coach</p>
                  <div className="mt-3 space-y-2">
                    {data.suggestions
                      .concat(
                        view.metrics.tradeoffs.map((detail, i) => ({
                          id: `tradeoff-${i}`,
                          type: "structure" as const,
                          title: "Tradeoff",
                          detail,
                        }))
                      )
                      .slice(0, 5)
                      .map((item) => (
                        <p key={item.id} className="text-xs leading-5 text-white/45">
                          <span className="text-white/60">{item.title}:</span> {item.detail}
                        </p>
                      ))}
                    {view.metrics.summary.map((s) => (
                      <p key={s} className="text-xs italic leading-5 text-white/35">
                        {s}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft((d) => ({
                        ...d,
                        blocks: d.blocks.map((b) => ({
                          ...b,
                          tracks: reorderTracksWithinBlock(b.tracks, d.goalType, "smooth"),
                        })),
                      }))
                    }
                    className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-xs text-white/50 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    Smooth everything
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft((d) => ({
                        ...d,
                        blocks: d.blocks.map((b) => ({
                          ...b,
                          tracks: reorderTracksWithinBlock(b.tracks, d.goalType, "surprise"),
                        })),
                      }))
                    }
                    className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-xs text-white/50 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    Add surprise
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Block detail + track list ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-4"
      >
        {selectedBlock ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            {/* Block toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-5">
              <div className="flex items-center gap-3">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: selectedBlock.colorToken || accentColor }}
                />
                {editingBlockName ? (
                  <input
                    autoFocus
                    value={selectedBlock.name}
                    onBlur={() => setEditingBlockName(false)}
                    onKeyDown={(e) => e.key === "Enter" && setEditingBlockName(false)}
                    onChange={(e) =>
                      updateDraft((d) => ({
                        ...d,
                        blocks: d.blocks.map((b) =>
                          b.id === selectedBlock.id ? { ...b, name: e.target.value } : b
                        ),
                      }))
                    }
                    className="rounded-lg border border-white/10 bg-transparent px-2 py-0.5 text-sm font-medium text-white outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingBlockName(true)}
                    className="text-sm font-medium text-white transition hover:text-white/70"
                  >
                    {selectedBlock.name}
                  </button>
                )}
                <span className="text-xs text-white/25">
                  {selectedBlock.tracks.length} tracks &middot; {selectedBlock.summary}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    updateDraft((d) => ({
                      ...d,
                      blocks: d.blocks.map((b) =>
                        b.id === selectedBlock.id
                          ? { ...b, tracks: reorderTracksWithinBlock(b.tracks, d.goalType, "smooth") }
                          : b
                      ),
                    }))
                  }
                  className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/50 transition hover:bg-white/[0.06] hover:text-white"
                >
                  Reorder
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateDraft((d) => {
                      const i = d.blocks.findIndex((b) => b.id === selectedBlock.id);
                      if (i <= 0) return d;
                      return { ...d, blocks: moveArrayItem(d.blocks, i, i - 1) };
                    })
                  }
                  className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/40 transition hover:bg-white/[0.06] hover:text-white"
                  title="Move section left"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateDraft((d) => {
                      const i = d.blocks.findIndex((b) => b.id === selectedBlock.id);
                      if (i < 0 || i >= d.blocks.length - 1) return d;
                      return { ...d, blocks: moveArrayItem(d.blocks, i, i + 1) };
                    })
                  }
                  className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/40 transition hover:bg-white/[0.06] hover:text-white"
                  title="Move section right"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateDraft((d) => {
                      const i = d.blocks.findIndex((b) => b.id === selectedBlock.id);
                      if (i < 0 || i === d.blocks.length - 1) return d;
                      const merged = [...d.blocks];
                      merged[i] = { ...merged[i], tracks: [...merged[i].tracks, ...merged[i + 1].tracks] };
                      merged.splice(i + 1, 1);
                      return { ...d, blocks: merged };
                    })
                  }
                  className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/40 transition hover:bg-white/[0.06] hover:text-white"
                  title="Merge with next section"
                >
                  Merge
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateDraft((d) => {
                      const insertAt = d.blocks.findIndex((b) => b.id === selectedBlock.id) + 1;
                      const nb: SequencerBlock = {
                        id: crypto.randomUUID(),
                        name: `section ${d.blocks.length + 1}`,
                        purpose: "new section",
                        position: insertAt,
                        colorToken: accentColor,
                        notes: null,
                        locked: false,
                        summary: "empty",
                        warnings: [],
                        metrics: { cohesion: 100, energy: 0, familiarity: 0, novelty: 0, intensity: 0 },
                        tracks: [],
                      };
                      const blocks = [...d.blocks];
                      blocks.splice(insertAt, 0, nb);
                      return { ...d, blocks };
                    })
                  }
                  className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/40 transition hover:bg-white/[0.06] hover:text-white"
                >
                  + Section
                </button>
                {view.blocks.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft((d) => {
                        if (d.blocks.length <= 1) return d;
                        const i = d.blocks.findIndex((b) => b.id === selectedBlock.id);
                        const targetIdx = i === 0 ? 1 : i - 1;
                        const dest = d.blocks[targetIdx];
                        const nextBlocks = d.blocks
                          .filter((b) => b.id !== selectedBlock.id)
                          .map((b) =>
                            b.id === dest.id
                              ? { ...b, tracks: [...b.tracks, ...selectedBlock.tracks] }
                              : b
                          );
                        setSelectedBlockId(dest.id);
                        return { ...d, blocks: nextBlocks };
                      })
                    }
                    className="rounded-lg border border-rose-400/15 bg-rose-400/[0.06] px-3 py-1.5 text-xs text-rose-200/60 transition hover:bg-rose-400/10 hover:text-rose-100"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            {/* Track list */}
            <div className="space-y-1 p-3 sm:p-4">
              <AnimatePresence initial={false} mode="popLayout">
                {selectedBlock.tracks.map((track, i) => (
                  <TrackRow
                    key={track.trackId}
                    track={track}
                    index={i}
                    total={selectedBlock.tracks.length}
                    blockId={selectedBlock.id}
                    blockCount={view.blocks.length}
                    accentColor={accentColor}
                    onUpdate={updateDraft}
                  />
                ))}
              </AnimatePresence>

              {selectedBlock.tracks.length === 0 && (
                <div className="py-12 text-center text-xs text-white/25">
                  No tracks in this section yet. Move songs here from another section.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/[0.08] py-16 text-center text-sm text-white/30">
            Select a section from the flow strip above
          </div>
        )}
      </motion.div>
    </main>
  );
}
