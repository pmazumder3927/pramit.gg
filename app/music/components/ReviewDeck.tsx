"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import useSWR from "swr";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "motion/react";
import { formatDistanceToNow } from "date-fns";
import { useAlbumColor } from "@/app/lib/use-album-color";
import { hexToRgb } from "@/app/music/lib/chaotic-styles";
import type {
  ReviewActionInput,
  ReviewBucket,
  ReviewQueueSnapshot,
} from "@/app/music/lib/review-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type FetchError = Error & { status?: number };

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || "Failed to load review queue") as FetchError;
    err.status = res.status;
    throw err;
  }
  return data as ReviewQueueSnapshot;
};

const PINNED_KEY = "review-pinned-buckets";

function getPinnedBucketIds(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

function setPinnedBucketIds(ids: string[]) {
  localStorage.setItem(PINNED_KEY, JSON.stringify(ids));
}

const SWIPE_THRESHOLD = 120;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BucketCard({
  bucket,
  selected,
  onToggle,
  accentColor,
}: {
  bucket: ReviewBucket;
  selected: boolean;
  onToggle: (id: string) => void;
  accentColor: string;
}) {
  const rgb = hexToRgb(accentColor);

  return (
    <motion.button
      type="button"
      onClick={() => onToggle(bucket.bucketId)}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={{ scale: 0.95 }}
      className="relative overflow-hidden rounded-2xl border text-left transition-all duration-200 focus:outline-none"
      style={{
        borderColor: selected
          ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`
          : "rgba(255,255,255,0.08)",
        boxShadow: selected
          ? `0 0 24px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2), inset 0 0 30px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.06)`
          : "none",
      }}
    >
      {/* Background image */}
      <div className="relative h-28 sm:h-32">
        {bucket.imageUrl ? (
          <>
            <Image
              src={bucket.imageUrl}
              alt={bucket.name}
              fill
              className={`object-cover transition-all duration-300 ${
                selected ? "opacity-50 scale-105" : "opacity-25"
              }`}
              sizes="(max-width: 640px) 50vw, 33vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: selected
                ? `linear-gradient(135deg, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15), rgba(0,0,0,0.9))`
                : "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(0,0,0,0.9))",
            }}
          />
        )}

        {/* Selected check */}
        {selected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-full"
            style={{ backgroundColor: accentColor }}
          >
            <svg className="h-3.5 w-3.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
        )}

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="text-sm font-semibold text-white leading-tight line-clamp-2">
            {bucket.name}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {bucket.trackCount} tracks
          </p>
        </div>
      </div>
    </motion.button>
  );
}

function BucketManageOverlay({
  allBuckets,
  pinnedIds,
  onSave,
  onClose,
}: {
  allBuckets: ReviewBucket[];
  pinnedIds: string[];
  onSave: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(pinnedIds));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/10 bg-charcoal-black p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-white">Manage buckets</h3>
            <p className="text-sm text-gray-400 mt-1">
              Pin the playlists you want to see during review.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onSave(Array.from(selected));
              onClose();
            }}
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-gray-200"
          >
            Done
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {allBuckets.map((bucket) => (
            <button
              key={bucket.bucketId}
              type="button"
              onClick={() => toggle(bucket.bucketId)}
              className={`relative overflow-hidden rounded-2xl border text-left transition-all ${
                selected.has(bucket.bucketId)
                  ? "border-white/30 ring-1 ring-white/20"
                  : "border-white/5 opacity-50 hover:opacity-75"
              }`}
            >
              <div className="relative h-24">
                {bucket.imageUrl ? (
                  <>
                    <Image
                      src={bucket.imageUrl}
                      alt={bucket.name}
                      fill
                      className="object-cover opacity-40"
                      sizes="33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-black" />
                )}
                {selected.has(bucket.bucketId) && (
                  <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-white">
                    <svg className="h-3 w-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  <p className="text-xs font-medium text-white leading-tight line-clamp-2">
                    {bucket.name}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setSelected(new Set(allBuckets.map((b) => b.bucketId)));
          }}
          className="mt-4 mr-3 text-sm text-gray-400 hover:text-white transition"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={() => setSelected(new Set())}
          className="mt-4 text-sm text-gray-400 hover:text-white transition"
        >
          Clear all
        </button>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ReviewDeck() {
  const { data, error, isLoading, mutate } = useSWR<ReviewQueueSnapshot>(
    "/api/spotify/review",
    fetcher,
    { revalidateOnFocus: false }
  );

  const [selectedBucketIds, setSelectedBucketIds] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const [showManage, setShowManage] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<string[] | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState<"idle" | "spotify" | "preview" | "failed">("idle");
  const audioRef = useRef<HTMLAudioElement>(null);
  const playingTrackId = useRef<string | null>(null);

  // Swipe state
  const dragX = useMotionValue(0);
  const rotate = useTransform(dragX, [-200, 0, 200], [-12, 0, 12]);
  const keepOpacity = useTransform(dragX, [0, SWIPE_THRESHOLD], [0, 1]);
  const skipOpacity = useTransform(dragX, [-SWIPE_THRESHOLD, 0], [1, 0]);

  const currentTrack = data?.currentTrack || null;
  const accentColor = useAlbumColor(currentTrack?.albumImageUrl || null);
  const rgb = hexToRgb(accentColor);

  // Load pinned buckets from localStorage
  useEffect(() => {
    setPinnedIds(getPinnedBucketIds());
  }, []);

  // Reset bucket selection when track changes
  useEffect(() => {
    setSelectedBucketIds(
      currentTrack?.activeBuckets.map((b) => b.bucketId) || []
    );
  }, [currentTrack?.trackId]);

  // Autoplay when track changes
  useEffect(() => {
    if (!currentTrack || currentTrack.trackId === playingTrackId.current) return;
    playingTrackId.current = currentTrack.trackId;
    setPlaybackStatus("idle");

    // Stop any current preview
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    // Try Spotify Connect first
    if (currentTrack.spotifyUri) {
      fetch("/api/spotify/review/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uri: currentTrack.spotifyUri }),
      })
        .then((res) => res.json())
        .then((result) => {
          if (playingTrackId.current !== currentTrack.trackId) return;
          if (result.playing) {
            setPlaybackStatus("spotify");
          } else if (currentTrack.previewUrl && audioRef.current) {
            // Fallback to preview
            audioRef.current.src = currentTrack.previewUrl;
            audioRef.current.play().then(() => {
              setPlaybackStatus("preview");
            }).catch(() => {
              setPlaybackStatus("failed");
            });
          } else {
            setPlaybackStatus("failed");
          }
        })
        .catch(() => {
          if (currentTrack.previewUrl && audioRef.current) {
            audioRef.current.src = currentTrack.previewUrl;
            audioRef.current.play().then(() => {
              setPlaybackStatus("preview");
            }).catch(() => {
              setPlaybackStatus("failed");
            });
          } else {
            setPlaybackStatus("failed");
          }
        });
    } else if (currentTrack.previewUrl && audioRef.current) {
      audioRef.current.src = currentTrack.previewUrl;
      audioRef.current.play().then(() => {
        setPlaybackStatus("preview");
      }).catch(() => {
        setPlaybackStatus("failed");
      });
    }
  }, [currentTrack?.trackId, currentTrack?.spotifyUri, currentTrack?.previewUrl]);

  // Visible buckets (pinned subset or all)
  const visibleBuckets = useMemo(() => {
    if (!data) return [];
    const all = data.allBuckets;
    if (!pinnedIds || pinnedIds.length === 0) return all;
    const pinSet = new Set(pinnedIds);
    return all.filter((b) => pinSet.has(b.bucketId));
  }, [data, pinnedIds]);

  const handleToggleBucket = (bucketId: string) => {
    setSelectedBucketIds((cur) =>
      cur.includes(bucketId) ? cur.filter((id) => id !== bucketId) : [...cur, bucketId]
    );
  };

  const handleAction = useCallback(
    async (
      intent: ReviewActionInput["intent"],
      overrides?: Partial<Pick<ReviewActionInput, "liked" | "bucketIds">>
    ) => {
      if (!currentTrack || isSubmitting) return;
      setIsSubmitting(true);
      setSubmitError(null);

      // Stop audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }

      const payload: ReviewActionInput = {
        trackId: currentTrack.trackId,
        liked: overrides?.liked ?? currentTrack.isLiked,
        bucketIds: overrides?.bucketIds ?? selectedBucketIds,
        intent,
      };

      try {
        const res = await fetch("/api/spotify/review/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const snapshot = await res.json();
        if (!res.ok) throw new Error(snapshot.error || "Failed to save review");

        setSessionReviewed((c) => c + 1);
        playingTrackId.current = null;
        await mutate(snapshot, false);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Failed to save review");
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentTrack, isSubmitting, selectedBucketIds, mutate]
  );

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.x > SWIPE_THRESHOLD) {
        handleAction("confirm", { liked: true });
      } else if (info.offset.x < -SWIPE_THRESHOLD) {
        handleAction("defer", { liked: currentTrack?.isLiked });
      }
    },
    [handleAction, currentTrack?.isLiked]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showManage) return;
      if (e.key === "ArrowRight" || e.key === "k") {
        e.preventDefault();
        handleAction("confirm", { liked: true });
      } else if (e.key === "ArrowLeft" || e.key === "s") {
        e.preventDefault();
        handleAction("defer", { liked: currentTrack?.isLiked });
      } else if (e.key === "Backspace" || e.key === "d") {
        e.preventDefault();
        handleAction("unlike", { liked: false, bucketIds: [] });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleAction, showManage, currentTrack?.isLiked]);

  const handleSavePins = (ids: string[]) => {
    setPinnedIds(ids);
    setPinnedBucketIds(ids);
  };

  // ---------- Render states ----------

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <span className="text-sm">Building your queue...</span>
        </div>
      </div>
    );
  }

  if ((error as FetchError | undefined)?.status === 401) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Private</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">
            Sign in to review your library.
          </h3>
          <p className="mt-3 text-gray-400 text-sm">
            This tool modifies your Spotify library, so it requires authentication.
          </p>
          <a
            href="/api/auth/login"
            className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-gray-200"
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  if (!data) return null;

  if (!currentTrack) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h3 className="text-2xl font-semibold text-white">Queue cleared.</h3>
          <p className="mt-3 text-gray-400 text-sm">
            Your library looks stable. Check back later or force a sync.
          </p>
          <button
            type="button"
            onClick={async () => {
              setIsSubmitting(true);
              try {
                const snapshot = await fetcher("/api/spotify/review?sync=1");
                await mutate(snapshot, false);
              } catch {} finally {
                setIsSubmitting(false);
              }
            }}
            disabled={isSubmitting}
            className="mt-6 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-white transition hover:bg-white/10 disabled:opacity-50"
          >
            {isSubmitting ? "Syncing..." : "Force sync"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      {/* Hidden audio element for preview fallback */}
      <audio ref={audioRef} preload="none" />

      {/* Session header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            {data.stats.dueNow} due
          </span>
          <span className="text-xs text-gray-600">|</span>
          <span className="text-sm text-gray-500">
            {sessionReviewed} reviewed
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Playback indicator */}
          {playbackStatus === "spotify" && (
            <span className="flex items-center gap-1.5 text-xs text-accent-green">
              <span className="inline-block h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent-green" />
              Playing
            </span>
          )}
          {playbackStatus === "preview" && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="inline-block h-1.5 w-1.5 animate-pulse-soft rounded-full bg-gray-400" />
              Preview
            </span>
          )}
          {data.sync.needsReconnect && (
            <a
              href="/dashboard"
              className="text-xs text-accent-orange hover:underline"
            >
              Reconnect
            </a>
          )}
        </div>
      </div>

      {submitError && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {submitError}
        </div>
      )}

      {/* Song Card */}
      <div className="relative mb-6">
        {/* Ambient glow behind card */}
        <div
          className="absolute -inset-4 rounded-[3rem] blur-3xl opacity-20 transition-colors duration-700"
          style={{ backgroundColor: accentColor }}
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={currentTrack.trackId}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.9}
            onDragEnd={handleDragEnd}
            style={{ x: dragX, rotate }}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative cursor-grab overflow-hidden rounded-3xl border border-white/10 bg-charcoal-black active:cursor-grabbing"
          >
            {/* Swipe indicators */}
            <motion.div
              style={{ opacity: keepOpacity }}
              className="absolute inset-0 z-30 flex items-center justify-center bg-accent-green/10 pointer-events-none"
            >
              <span className="rounded-full border-2 border-accent-green bg-accent-green/20 px-6 py-2 text-lg font-bold uppercase tracking-widest text-accent-green">
                Keep
              </span>
            </motion.div>
            <motion.div
              style={{ opacity: skipOpacity }}
              className="absolute inset-0 z-30 flex items-center justify-center bg-white/5 pointer-events-none"
            >
              <span className="rounded-full border-2 border-gray-400 bg-white/10 px-6 py-2 text-lg font-bold uppercase tracking-widest text-gray-300">
                Skip
              </span>
            </motion.div>

            {/* Album art */}
            <div className="relative aspect-square w-full">
              {currentTrack.albumImageUrl ? (
                <Image
                  src={currentTrack.albumImageUrl}
                  alt={currentTrack.albumName || currentTrack.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 576px"
                  priority
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-white/[0.03] text-6xl text-gray-600">
                  <svg className="w-20 h-20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                  </svg>
                </div>
              )}

              {/* Gradient overlay at bottom of image */}
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal-black via-transparent to-transparent" />

              {/* Song info overlaid on bottom of art */}
              <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {currentTrack.reasons.slice(0, 2).map((reason) => (
                    <span
                      key={reason}
                      className="rounded-full bg-black/50 backdrop-blur-sm px-2.5 py-1 text-[10px] uppercase tracking-widest text-white/70"
                    >
                      {reason}
                    </span>
                  ))}
                </div>

                <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                  {currentTrack.title}
                </h2>
                <p className="mt-1 text-base text-white/70">
                  {currentTrack.artistDisplay}
                </p>
                <div className="mt-1 flex items-center gap-3 text-xs text-white/40">
                  {currentTrack.albumName && (
                    <span>{currentTrack.albumName}</span>
                  )}
                  {currentTrack.lastPlayedAt && (
                    <>
                      <span>-</span>
                      <span>
                        heard {formatDistanceToNow(new Date(currentTrack.lastPlayedAt), { addSuffix: true })}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bucket section */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-400">
            Drop into
            {selectedBucketIds.length > 0 && (
              <span
                className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-semibold text-black"
                style={{ backgroundColor: accentColor }}
              >
                {selectedBucketIds.length}
              </span>
            )}
          </h3>
          <button
            type="button"
            onClick={() => setShowManage(true)}
            className="text-xs text-gray-500 transition hover:text-white"
          >
            Manage
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {visibleBuckets.map((bucket) => (
            <BucketCard
              key={bucket.bucketId}
              bucket={bucket}
              selected={selectedBucketIds.includes(bucket.bucketId)}
              onToggle={handleToggleBucket}
              accentColor={accentColor}
            />
          ))}
        </div>

        {visibleBuckets.length === 0 && (
          <button
            type="button"
            onClick={() => setShowManage(true)}
            className="w-full rounded-2xl border border-dashed border-white/10 py-8 text-sm text-gray-500 transition hover:border-white/20 hover:text-gray-400"
          >
            Pin some playlists to get started
          </button>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-center gap-4">
        {/* Remove */}
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => handleAction("unlike", { liked: false, bucketIds: [] })}
          className="group flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-gray-400 transition hover:border-accent-pink/40 hover:bg-accent-pink/10 hover:text-accent-pink disabled:opacity-40"
          title="Remove from liked (D)"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>

        {/* Skip */}
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => handleAction("defer", { liked: currentTrack.isLiked })}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-gray-300 transition hover:border-white/25 hover:bg-white/[0.08] disabled:opacity-40"
          title="Skip for now (S / Left arrow)"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Keep */}
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => handleAction("confirm", { liked: true })}
          className="flex h-16 w-16 items-center justify-center rounded-full text-black transition hover:scale-105 active:scale-95 disabled:opacity-40"
          style={{ backgroundColor: accentColor }}
          title="Keep + advance (K / Right arrow)"
        >
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </button>

        {/* Not sure */}
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => handleAction("unsure", { liked: currentTrack.isLiked })}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-gray-300 transition hover:border-accent-yellow/30 hover:bg-accent-yellow/10 hover:text-accent-yellow disabled:opacity-40"
          title="Not sure"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />
          </svg>
        </button>

        {/* Save buckets (when changed from original) */}
        {currentTrack.activeBuckets.map((b) => b.bucketId).sort().join(",") !==
          [...selectedBucketIds].sort().join(",") && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleAction("update_buckets", { liked: true })}
            className="flex h-12 w-12 items-center justify-center rounded-full border text-white transition hover:scale-105 disabled:opacity-40"
            style={{
              borderColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`,
              backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`,
            }}
            title="Save bucket changes"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
          </button>
        )}
      </div>

      {/* Keyboard hint */}
      <div className="mt-4 flex items-center justify-center gap-4 text-[10px] uppercase tracking-widest text-gray-600">
        <span><kbd className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-gray-500">←</kbd> skip</span>
        <span><kbd className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-gray-500">→</kbd> keep</span>
        <span><kbd className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-gray-500">D</kbd> remove</span>
      </div>

      {/* Spotify link */}
      {currentTrack.songUrl && (
        <div className="mt-4 text-center">
          <a
            href={currentTrack.songUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-600 transition hover:text-gray-400"
          >
            Open in Spotify
          </a>
        </div>
      )}

      {/* Manage overlay */}
      <AnimatePresence>
        {showManage && data && (
          <BucketManageOverlay
            allBuckets={data.allBuckets}
            pinnedIds={pinnedIds || data.allBuckets.map((b) => b.bucketId)}
            onSave={handleSavePins}
            onClose={() => setShowManage(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
