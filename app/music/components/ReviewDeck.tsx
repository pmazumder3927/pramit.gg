"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "motion/react";
import { useAlbumColor } from "@/app/lib/use-album-color";
import { hexToRgb } from "@/app/music/lib/chaotic-styles";
import type {
  ReviewActionInput,
  ReviewBucket,
  ReviewQueueSnapshot,
} from "@/app/music/lib/review-types";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type FetchError = Error & { status?: number };
type PlayerMode = "connecting" | "sdk" | "preview" | "none";

const SWIPE_THRESHOLD = 120;
const PINNED_KEY = "review-pinned-buckets";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error || "Failed to load") as FetchError;
    err.status = res.status;
    throw err;
  }
  return json as ReviewQueueSnapshot;
};

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function getPinnedIds(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

function savePinnedIds(ids: string[]) {
  localStorage.setItem(PINNED_KEY, JSON.stringify(ids));
}

async function fetchSpotifyToken(): Promise<string> {
  const res = await fetch("/api/spotify/token");
  const data = await res.json();
  if (!res.ok || !data.token) throw new Error("Token fetch failed");
  return data.token;
}

// ---------------------------------------------------------------------------
// BucketPill (horizontal scroll card)
// ---------------------------------------------------------------------------

function BucketPill({
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
      whileTap={{ scale: 0.93 }}
      className="relative flex-shrink-0 overflow-hidden rounded-xl border text-left transition-all duration-200"
      style={{
        width: 112,
        height: 80,
        borderColor: selected
          ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`
          : "rgba(255,255,255,0.06)",
        boxShadow: selected
          ? `0 0 20px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`
          : "none",
      }}
    >
      {bucket.imageUrl ? (
        <>
          <Image
            src={bucket.imageUrl}
            alt=""
            fill
            className={`object-cover transition-opacity duration-200 ${
              selected ? "opacity-45" : "opacity-20"
            }`}
            sizes="112px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: selected
              ? `linear-gradient(135deg, rgba(${rgb.r},${rgb.g},${rgb.b},0.12), rgba(0,0,0,0.9))`
              : "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(0,0,0,0.9))",
          }}
        />
      )}

      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full"
          style={{ backgroundColor: accentColor }}
        >
          <svg className="h-2.5 w-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </motion.div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-2">
        <p className="text-[11px] font-medium text-white leading-tight line-clamp-2">
          {bucket.name}
        </p>
      </div>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// BucketManageOverlay
// ---------------------------------------------------------------------------

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
        className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/10 bg-charcoal-black p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-semibold text-white">Manage buckets</h3>
            <p className="text-xs text-gray-500 mt-1">Pin playlists for review.</p>
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

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {allBuckets.map((bucket) => (
            <button
              key={bucket.bucketId}
              type="button"
              onClick={() => toggle(bucket.bucketId)}
              className={`relative overflow-hidden rounded-xl border text-left transition-all ${
                selected.has(bucket.bucketId)
                  ? "border-white/25 ring-1 ring-white/15"
                  : "border-white/5 opacity-50 hover:opacity-75"
              }`}
            >
              <div className="relative h-20">
                {bucket.imageUrl ? (
                  <>
                    <Image src={bucket.imageUrl} alt="" fill className="object-cover opacity-35" sizes="33vw" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-black" />
                )}
                {selected.has(bucket.bucketId) && (
                  <div className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-white">
                    <svg className="h-2.5 w-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <p className="text-[11px] font-medium text-white leading-tight line-clamp-2">{bucket.name}</p>
                  <p className="text-[10px] text-gray-500">{bucket.trackCount} tracks</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-4">
          <button type="button" onClick={() => setSelected(new Set(allBuckets.map((b) => b.bucketId)))} className="text-xs text-gray-500 hover:text-white transition">
            Select all
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:text-white transition">
            Clear
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// ReviewDeck
// ---------------------------------------------------------------------------

export function ReviewDeck() {
  // ---- Data ----
  const { data, error, isLoading, mutate } = useSWR<ReviewQueueSnapshot>(
    "/api/spotify/review",
    fetcher,
    { revalidateOnFocus: false }
  );

  // ---- UI state ----
  const [selectedBucketIds, setSelectedBucketIds] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const [showManage, setShowManage] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<string[] | null>(null);

  // ---- Player state ----
  const [playerMode, setPlayerMode] = useState<PlayerMode>("connecting");
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [activated, setActivated] = useState(false);
  const playerRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playedTrackRef = useRef<string | null>(null);

  // ---- Swipe ----
  const dragX = useMotionValue(0);
  const rotate = useTransform(dragX, [-200, 0, 200], [-8, 0, 8]);
  const keepOpacity = useTransform(dragX, [0, SWIPE_THRESHOLD], [0, 1]);
  const skipOpacity = useTransform(dragX, [-SWIPE_THRESHOLD, 0], [1, 0]);

  // ---- Derived ----
  const currentTrack = data?.currentTrack || null;
  const accentColor = useAlbumColor(currentTrack?.albumImageUrl || null);
  const rgb = hexToRgb(accentColor);

  const originalBucketIds = useMemo(
    () => (currentTrack?.activeBuckets.map((b) => b.bucketId) || []).sort().join(","),
    [currentTrack?.trackId]
  );
  const bucketsChanged = [...selectedBucketIds].sort().join(",") !== originalBucketIds;

  const visibleBuckets = useMemo(() => {
    if (!data) return [];
    const all = data.allBuckets;
    if (!pinnedIds || pinnedIds.length === 0) return all;
    const pinSet = new Set(pinnedIds);
    const activeIds = new Set(currentTrack?.activeBuckets.map((b) => b.bucketId) || []);
    return all
      .filter((b) => pinSet.has(b.bucketId) || activeIds.has(b.bucketId))
      .sort((a, b) => {
        const aActive = activeIds.has(a.bucketId) ? 1 : 0;
        const bActive = activeIds.has(b.bucketId) ? 1 : 0;
        return bActive - aActive;
      });
  }, [data, pinnedIds, currentTrack?.activeBuckets]);

  const progress = duration > 0 ? (position / duration) * 100 : 0;

  // ---- Effects ----

  // Load pinned buckets
  useEffect(() => {
    setPinnedIds(getPinnedIds());
  }, []);

  // Reset bucket selection on track change
  useEffect(() => {
    setSelectedBucketIds(currentTrack?.activeBuckets.map((b) => b.bucketId) || []);
  }, [currentTrack?.trackId]);

  // Activate SDK audio on user gesture (required by browser autoplay policy)
  const activatePlayer = useCallback(() => {
    if (activated || !playerRef.current) return;
    playerRef.current.activateElement();
    setActivated(true);
  }, [activated]);

  // Initialize Spotify Web Playback SDK
  useEffect(() => {
    if (typeof window === "undefined") return;

    let mounted = true;

    // Fallback timeout: if SDK doesn't connect in 8s, use preview mode
    const fallbackTimer = setTimeout(() => {
      if (mounted && playerMode === "connecting") {
        setPlayerMode("preview");
      }
    }, 8000);

    (window as any).onSpotifyWebPlaybackSDKReady = () => {
      if (!mounted) return;

      const player = new (window as any).Spotify.Player({
        name: "pramit.gg",
        getOAuthToken: (cb: (t: string) => void) => {
          fetchSpotifyToken().then(cb).catch(() => {});
        },
        volume: 1.0,
      });

      player.addListener("ready", ({ device_id }: { device_id: string }) => {
        if (!mounted) return;
        setDeviceId(device_id);
        setPlayerMode("sdk");
        clearTimeout(fallbackTimer);
        player.setVolume(1.0);
      });

      player.addListener("not_ready", () => {
        if (!mounted) return;
        setDeviceId(null);
        // Try to reconnect after a delay
        setTimeout(() => {
          if (mounted) player.connect();
        }, 3000);
      });

      player.addListener("player_state_changed", (state: any) => {
        if (!state || !mounted) return;
        setIsPlaying(!state.paused);
        setPosition(state.position);
        setDuration(state.duration);
      });

      player.addListener("initialization_error", () => {
        if (mounted) setPlayerMode("preview");
      });

      player.addListener("authentication_error", () => {
        // Token expired, SDK will call getOAuthToken again automatically
      });

      player.addListener("account_error", () => {
        if (mounted) setPlayerMode("preview");
      });

      player.connect();
      playerRef.current = player;
    };

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      mounted = false;
      clearTimeout(fallbackTimer);
      playerRef.current?.disconnect();
      script.remove();
    };
  }, []);

  // Smooth position increment when playing
  useEffect(() => {
    if (!isPlaying || duration === 0) return;
    const id = setInterval(() => {
      setPosition((p) => Math.min(p + 250, duration));
    }, 250);
    return () => clearInterval(id);
  }, [isPlaying, duration]);

  // Preview audio events (fallback mode)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setPosition(audio.currentTime * 1000);
    const onLoadedMetadata = () => setDuration(audio.duration * 1000);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setPosition(0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  // Auto-play on track change or device becoming available
  useEffect(() => {
    if (!currentTrack) return;

    // Build a key combining track + device so we don't re-play the same combo
    const playKey = `${currentTrack.trackId}:${deviceId ?? "none"}`;
    if (playKey === playedTrackRef.current) return;

    // Stop any current preview
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }

    if (playerMode === "sdk" && currentTrack.spotifyUri && deviceId) {
      playedTrackRef.current = playKey;
      setPosition(0);
      setDuration(0);
      setIsPlaying(false);

      fetchSpotifyToken()
        .then((token) =>
          fetch(
            `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ uris: [currentTrack.spotifyUri] }),
            }
          )
        )
        .catch(() => {
          // SDK play failed, try preview
          if (currentTrack.previewUrl && audioRef.current) {
            audioRef.current.src = currentTrack.previewUrl;
            audioRef.current.play().catch(() => {});
          }
        });
    } else if (playerMode !== "connecting" && currentTrack.previewUrl && audioRef.current) {
      // Only use preview if we've given up on SDK (not still connecting)
      playedTrackRef.current = playKey;
      setPosition(0);
      setDuration(0);
      setIsPlaying(false);
      audioRef.current.src = currentTrack.previewUrl;
      audioRef.current.play().catch(() => {});
    }
  }, [currentTrack?.trackId, playerMode, deviceId]);

  // Retry playback after user activates audio
  useEffect(() => {
    if (!activated || !currentTrack?.spotifyUri || !deviceId || playerMode !== "sdk") return;
    if (!isPlaying) {
      // User just activated - replay the current track
      fetchSpotifyToken()
        .then((token) =>
          fetch(
            `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ uris: [currentTrack.spotifyUri] }),
            }
          )
        )
        .catch(() => {});
    }
  }, [activated]);

  // ---- Handlers ----

  const togglePlay = useCallback(() => {
    activatePlayer();
    if (playerMode === "sdk" && playerRef.current) {
      playerRef.current.setVolume(1.0);
      playerRef.current.togglePlay();
    } else if (audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    }
  }, [playerMode, activatePlayer]);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (duration === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const ms = Math.round(fraction * duration);

      if (playerMode === "sdk" && playerRef.current) {
        playerRef.current.seek(ms);
      } else if (audioRef.current) {
        audioRef.current.currentTime = ms / 1000;
      }
      setPosition(ms);
    },
    [playerMode, duration]
  );

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
      activatePlayer();
      setIsSubmitting(true);
      setSubmitError(null);

      // Pause playback
      if (playerMode === "sdk" && playerRef.current) {
        playerRef.current.pause();
      } else if (audioRef.current) {
        audioRef.current.pause();
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
        if (!res.ok) throw new Error(snapshot.error || "Failed to save");

        setSessionReviewed((c) => c + 1);
        playedTrackRef.current = null;
        await mutate(snapshot, false);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Failed to save");
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentTrack, isSubmitting, selectedBucketIds, mutate, playerMode, activatePlayer]
  );

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.x > SWIPE_THRESHOLD) {
        handleAction(bucketsChanged ? "update_buckets" : "confirm", { liked: true });
      } else if (info.offset.x < -SWIPE_THRESHOLD) {
        handleAction("defer", { liked: currentTrack?.isLiked });
      }
    },
    [handleAction, bucketsChanged, currentTrack?.isLiked]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showManage) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      activatePlayer();

      if (e.key === "ArrowRight" || e.key === "k") {
        e.preventDefault();
        handleAction(bucketsChanged ? "update_buckets" : "confirm", { liked: true });
      } else if (e.key === "ArrowLeft" || e.key === "s") {
        e.preventDefault();
        handleAction("defer", { liked: currentTrack?.isLiked });
      } else if (e.key === "d") {
        e.preventDefault();
        handleAction("unlike", { liked: false, bucketIds: [] });
      } else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleAction, showManage, currentTrack?.isLiked, bucketsChanged, togglePlay]);

  const handleSavePins = (ids: string[]) => {
    setPinnedIds(ids);
    savePinnedIds(ids);
  };

  // ---- Render ----

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-void-black">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
          <span className="text-sm">Building queue...</span>
        </div>
      </div>
    );
  }

  if ((error as FetchError | undefined)?.status === 401) {
    return (
      <div className="flex h-dvh items-center justify-center bg-void-black px-6">
        <div className="max-w-sm text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-600">Private</p>
          <h3 className="mt-3 text-xl font-semibold text-white">Sign in to review.</h3>
          <p className="mt-2 text-sm text-gray-500">
            This tool modifies your Spotify library.
          </p>
          <a
            href="/api/auth/login"
            className="mt-5 inline-flex rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black transition hover:bg-gray-200"
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
      <div className="flex h-dvh items-center justify-center bg-void-black px-6">
        <div className="max-w-sm text-center">
          <h3 className="text-xl font-semibold text-white">Queue cleared.</h3>
          <p className="mt-2 text-sm text-gray-500">
            Your library looks stable. Check back later.
          </p>
          <button
            type="button"
            onClick={async () => {
              setIsSubmitting(true);
              try {
                const snap = await fetcher("/api/spotify/review?sync=1");
                await mutate(snap, false);
              } catch {} finally {
                setIsSubmitting(false);
              }
            }}
            disabled={isSubmitting}
            className="mt-5 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white transition hover:bg-white/10 disabled:opacity-50"
          >
            {isSubmitting ? "Syncing..." : "Force sync"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-dvh flex-col bg-void-black pb-16 md:pb-0"
      onClick={activatePlayer}
    >
      {/* Hidden audio element for preview fallback */}
      <audio ref={audioRef} preload="none" />

      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute inset-0 transition-all duration-1000"
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% 25%, rgba(${rgb.r},${rgb.g},${rgb.b},0.1), transparent)`,
        }}
      />

      {/* Top bar */}
      <div className="relative z-10 flex flex-none items-center justify-between px-4 py-3">
        <Link href="/music" className="text-xs text-gray-600 transition hover:text-gray-400">
          <svg className="inline h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          music
        </Link>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          {playerMode === "sdk" && (
            <span className="flex items-center gap-1 text-accent-green">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse-soft" />
              Spotify
            </span>
          )}
          <span>{data.stats.dueNow} due</span>
          {sessionReviewed > 0 && <span>{sessionReviewed} done</span>}
        </div>
      </div>

      {submitError && (
        <div className="relative z-10 mx-4 mb-2 flex-none rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {submitError}
        </div>
      )}

      {/* Song card (fills available space) */}
      <div className="relative z-10 mx-auto flex-1 min-h-0 w-full max-w-lg px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTrack.trackId}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.9}
            onDragEnd={handleDragEnd}
            style={{ x: dragX, rotate }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative h-full cursor-grab overflow-hidden rounded-3xl border border-white/[0.08] active:cursor-grabbing"
          >
            {/* Album art */}
            {currentTrack.albumImageUrl ? (
              <Image
                src={currentTrack.albumImageUrl}
                alt={currentTrack.title}
                fill
                className="object-cover"
                sizes="(max-width:512px) 100vw, 512px"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-charcoal-black">
                <svg className="h-20 w-20 text-gray-800" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>
            )}

            {/* Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

            {/* Swipe indicators */}
            <motion.div
              style={{ opacity: keepOpacity }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-accent-green/10 pointer-events-none"
            >
              <span className="rounded-2xl border-2 border-accent-green bg-black/40 backdrop-blur-sm px-8 py-3 text-xl font-bold uppercase tracking-widest text-accent-green">
                Keep
              </span>
            </motion.div>
            <motion.div
              style={{ opacity: skipOpacity }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-white/5 pointer-events-none"
            >
              <span className="rounded-2xl border-2 border-gray-500 bg-black/40 backdrop-blur-sm px-8 py-3 text-xl font-bold uppercase tracking-widest text-gray-400">
                Skip
              </span>
            </motion.div>

            {/* Tap to start audio prompt */}
            {playerMode === "sdk" && !activated && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 pointer-events-none">
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="flex flex-col items-center gap-2"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
                    <svg className="h-6 w-6 ml-0.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <span className="text-xs text-white/60 tracking-wider">tap anywhere to start</span>
                </motion.div>
              </div>
            )}

            {/* Song info */}
            <div className="absolute bottom-0 left-0 right-0 z-10 p-5">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {currentTrack.reasons.slice(0, 2).map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-white/10 backdrop-blur-sm px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/60"
                  >
                    {r}
                  </span>
                ))}
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                {currentTrack.title}
              </h2>
              <p className="mt-1 text-sm text-white/60">{currentTrack.artistDisplay}</p>
              {currentTrack.albumName && (
                <p className="mt-0.5 text-xs text-white/30">{currentTrack.albumName}</p>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Player bar */}
      <div className="relative z-10 mx-auto w-full max-w-lg flex-none px-6 pt-3 pb-1">
        {/* Progress bar */}
        <div
          className="relative h-1 cursor-pointer rounded-full bg-white/10"
          onClick={handleSeek}
        >
          <motion.div
            className="absolute left-0 top-0 h-full rounded-full"
            style={{
              width: `${progress}%`,
              backgroundColor: accentColor,
            }}
          />
          {/* Dot */}
          <div
            className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white bg-white shadow-sm transition-opacity"
            style={{ left: `calc(${progress}% - 6px)`, opacity: duration > 0 ? 1 : 0 }}
          />
        </div>

        {/* Controls row */}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] font-mono text-gray-600 w-10">
            {duration > 0 ? formatMs(position) : "--:--"}
          </span>

          <button
            type="button"
            onClick={togglePlay}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/15"
          >
            {isPlaying ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <span className="text-[10px] font-mono text-gray-600 w-10 text-right">
            {duration > 0 ? formatMs(duration) : "--:--"}
          </span>
        </div>
      </div>

      {/* Bucket strip */}
      <div className="relative z-10 mx-auto w-full max-w-lg flex-none px-4 py-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] text-gray-600">
            Buckets
            {selectedBucketIds.length > 0 && (
              <span
                className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold text-black"
                style={{ backgroundColor: accentColor }}
              >
                {selectedBucketIds.length}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => setShowManage(true)}
            className="text-[11px] text-gray-600 transition hover:text-white"
          >
            Manage
          </button>
        </div>

        {visibleBuckets.length > 0 ? (
          <div
            className="flex gap-2 overflow-x-auto pb-1"
            style={{ scrollbarWidth: "none" }}
          >
            {visibleBuckets.map((b) => (
              <BucketPill
                key={b.bucketId}
                bucket={b}
                selected={selectedBucketIds.includes(b.bucketId)}
                onToggle={handleToggleBucket}
                accentColor={accentColor}
              />
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowManage(true)}
            className="w-full rounded-xl border border-dashed border-white/8 py-5 text-xs text-gray-600 transition hover:border-white/15"
          >
            Pin playlists to see them here
          </button>
        )}
      </div>

      {/* Action bar */}
      <div className="relative z-10 flex flex-none items-center justify-center gap-5 py-2">
        {/* Remove */}
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => handleAction("unlike", { liked: false, bucketIds: [] })}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.03] text-gray-500 transition hover:border-accent-pink/30 hover:bg-accent-pink/10 hover:text-accent-pink disabled:opacity-40"
          title="Remove from liked (D)"
        >
          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>

        {/* Skip */}
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => handleAction("defer", { liked: currentTrack.isLiked })}
          className="flex h-13 w-13 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.03] text-gray-400 transition hover:border-white/20 hover:bg-white/[0.06] disabled:opacity-40"
          style={{ width: 52, height: 52 }}
          title="Skip (S / Left arrow)"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Keep (morphs to save when buckets changed) */}
        <motion.button
          type="button"
          disabled={isSubmitting}
          onClick={() =>
            handleAction(bucketsChanged ? "update_buckets" : "confirm", { liked: true })
          }
          animate={bucketsChanged ? { scale: [1, 1.06, 1] } : {}}
          transition={bucketsChanged ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : {}}
          className="flex items-center justify-center rounded-full text-black transition disabled:opacity-40"
          style={{
            width: 60,
            height: 60,
            backgroundColor: accentColor,
            boxShadow: bucketsChanged
              ? `0 0 24px rgba(${rgb.r},${rgb.g},${rgb.b},0.4)`
              : `0 0 12px rgba(${rgb.r},${rgb.g},${rgb.b},0.2)`,
          }}
          title={bucketsChanged ? "Save + keep (K / Right arrow)" : "Keep (K / Right arrow)"}
        >
          <AnimatePresence mode="wait">
            {bucketsChanged ? (
              <motion.svg
                key="save"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 90 }}
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v6" />
              </motion.svg>
            ) : (
              <motion.svg
                key="check"
                initial={{ scale: 0, rotate: 90 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: -90 }}
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </motion.svg>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Keyboard hints */}
      <div className="relative z-10 flex flex-none justify-center gap-5 pb-3 text-[9px] uppercase tracking-widest text-gray-700">
        <span>
          <kbd className="mr-1 rounded bg-white/5 px-1 py-0.5 font-mono text-gray-600">←</kbd>
          skip
        </span>
        <span>
          <kbd className="mr-1 rounded bg-white/5 px-1 py-0.5 font-mono text-gray-600">→</kbd>
          keep
        </span>
        <span>
          <kbd className="mr-1 rounded bg-white/5 px-1 py-0.5 font-mono text-gray-600">D</kbd>
          remove
        </span>
        <span>
          <kbd className="mr-1 rounded bg-white/5 px-1 py-0.5 font-mono text-gray-600">Space</kbd>
          play
        </span>
      </div>

      {/* Spotify link */}
      {currentTrack.songUrl && (
        <div className="relative z-10 flex-none pb-2 text-center">
          <a
            href={currentTrack.songUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-gray-700 transition hover:text-gray-500"
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
