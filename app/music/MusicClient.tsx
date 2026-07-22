"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import useSWR, { preload } from "swr";
import { useAlbumColor, preloadColors } from "@/app/lib/use-album-color";
import {
  FloatingShapes,
  ScatteredElements,
  GradientOrbs,
  ChaoticTabs,
  ChaoticNowPlaying,
  ChaoticTrackCard,
  ChaoticPlaylistCard,
  SideB,
} from "./components";
import { Doodle, HandNote, Stamp } from "@/app/components/sketchbook";

interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumImageUrl: string | null;
  songUrl: string | null;
  playedAt?: string;
  duration?: number;
  popularity?: number;
  repeatCount?: number;
}

// Spotify's recently-played is reverse-chronological, so a song left on loop
// shows up as a run of identical consecutive entries. Collapse each run into a
// single row carrying how many times it spun — the card stamps it with an ×N.
function collapseConsecutive(tracks: SpotifyTrack[]): SpotifyTrack[] {
  const out: SpotifyTrack[] = [];
  for (const t of tracks) {
    const last = out[out.length - 1];
    if (last && last.id === t.id) {
      last.repeatCount = (last.repeatCount || 1) + 1;
    } else {
      out.push({ ...t, repeatCount: 1 });
    }
  }
  return out;
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  playlistUrl: string;
  trackCount: number;
  owner: string;
}

interface NowPlayingTrack {
  isPlaying: boolean;
  title: string;
  artist: string;
  album: string;
  albumImageUrl: string | null;
  songUrl: string | null;
  progress?: number;
  duration?: number;
  /** epoch ms the track was last played — anchor of the echo replay loop */
  playedAtMs?: number | null;
}

// Throws on non-OK so SWR surfaces API failures as `error` (with retry)
// instead of rendering a false "no tracks found" empty state.
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`spotify request failed: ${res.status}`);
  return res.json();
};

// now-playing is different: even its error responses carry a settled
// "nothing playing" JSON payload. Parse instead of throwing so a persistent
// upstream failure resolves the panel rather than leaving the ghost interior
// looking like it's loading forever.
const nowPlayingFetcher = (url: string) => fetch(url).then((res) => res.json());

// Preload all Spotify data as soon as this module is imported on the client
// (i.e. when Next.js prefetches the music page on link hover) so the SWR cache
// is already warm by the time the component mounts. Guarded to the browser —
// on the server these relative URLs can't be parsed and would throw. The
// catches only silence "unhandled rejection" noise when a preload fails before
// the page mounts — SWR still consumes the original promise (and its error).
if (typeof window !== "undefined") {
  preload("/api/spotify/now-playing", nowPlayingFetcher).catch(() => {});
  preload("/api/spotify/recently-played", fetcher).catch(() => {});
  preload("/api/spotify/top-tracks", fetcher).catch(() => {});
  preload("/api/spotify/playlists", fetcher).catch(() => {});
}

interface MusicClientProps {
  /** Server-fetched payloads (ISR) — seed SWR so first paint has real data */
  initialRecentlyPlayed?: { tracks: SpotifyTrack[] };
  initialTopTracks?: { tracks: SpotifyTrack[] };
  initialPlaylists?: { playlists: SpotifyPlaylist[] };
}

export default function MusicClient({
  initialRecentlyPlayed,
  initialTopTracks,
  initialPlaylists,
}: MusicClientProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  // Parallax is applied once per list (not per card): every card in a list used
  // the same strength, so a single container transform reproduces the exact
  // drift while running one spring instead of dozens. Hidden tabs don't paint.
  const trackPX = useSpring(useTransform(mouseX, [0, 1], [-6, 6]), {
    stiffness: 150,
    damping: 20,
  });
  const trackPY = useSpring(useTransform(mouseY, [0, 1], [-6, 6]), {
    stiffness: 150,
    damping: 20,
  });
  const listPX = useSpring(useTransform(mouseX, [0, 1], [-10, 10]), {
    stiffness: 100,
    damping: 20,
  });
  const listPY = useSpring(useTransform(mouseY, [0, 1], [-10, 10]), {
    stiffness: 100,
    damping: 20,
  });
  const [selectedTab, setSelectedTab] = useState<
    "recent" | "top" | "playlists"
  >("recent");
  // Track which tabs have been opened so we mount them once and keep them alive
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(
    new Set(["recent"]),
  );

  // The "suggest me a song" panel collapses inline in the hero so it's a CTA,
  // not a buried section. Open it → scroll it into view.
  const [showSuggest, setShowSuggest] = useState(false);
  const suggestRef = useRef<HTMLDivElement | null>(null);

  const handleTabSelect = (id: string) => {
    setSelectedTab(id as "recent" | "top" | "playlists");
    setVisitedTabs((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const { data: nowPlaying } = useSWR<NowPlayingTrack>(
    "/api/spotify/now-playing",
    nowPlayingFetcher,
    { refreshInterval: 30000 },
  );
  const {
    data: recentlyPlayed,
    error: recentError,
    isLoading: recentLoading,
    mutate: mutateRecent,
  } = useSWR<{ tracks: SpotifyTrack[] }>(
    "/api/spotify/recently-played",
    fetcher,
    { refreshInterval: 60000, fallbackData: initialRecentlyPlayed },
  );
  const {
    data: topTracks,
    error: topError,
    isLoading: topLoading,
    mutate: mutateTop,
  } = useSWR<{ tracks: SpotifyTrack[] }>(
    "/api/spotify/top-tracks",
    fetcher,
    { refreshInterval: 300000, fallbackData: initialTopTracks },
  );
  const {
    data: playlists,
    error: playlistsError,
    isLoading: playlistsLoading,
    mutate: mutatePlaylists,
  } = useSWR<{ playlists: SpotifyPlaylist[] }>(
    "/api/spotify/playlists",
    fetcher,
    { refreshInterval: 600000, fallbackData: initialPlaylists },
  );

  // Collapse on-loop runs so a song played 10× in a row is one row, not ten.
  const recentTracks = useMemo(
    () => collapseConsecutive(recentlyPlayed?.tracks ?? []),
    [recentlyPlayed],
  );

  // Extract color from now playing album art - this drives the page's accent color
  const nowPlayingColor = useAlbumColor(nowPlaying?.albumImageUrl || null);

  // Preload colors for visible tracks
  useEffect(() => {
    if (recentlyPlayed?.tracks) {
      preloadColors(
        recentlyPlayed.tracks.slice(0, 10).map((t) => t.albumImageUrl),
      );
    }
    if (topTracks?.tracks) {
      preloadColors(topTracks.tracks.slice(0, 10).map((t) => t.albumImageUrl));
    }
    if (playlists?.playlists) {
      preloadColors(playlists.playlists.slice(0, 8).map((p) => p.imageUrl));
    }
  }, [recentlyPlayed, topTracks, playlists]);

  // Mouse tracking
  useEffect(() => {
    let rafId: number;
    let lastX = 0.5;
    let lastY = 0.5;

    const handleMouseMove = (e: MouseEvent) => {
      if (rafId) return;

      rafId = requestAnimationFrame(() => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const newX = (e.clientX - rect.left) / rect.width;
          const newY = (e.clientY - rect.top) / rect.height;

          if (Math.abs(newX - lastX) > 0.01 || Math.abs(newY - lastY) > 0.01) {
            lastX = newX;
            lastY = newY;
            mouseX.set(newX);
            mouseY.set(newY);
          }
        }
        rafId = 0;
      });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [mouseX, mouseY]);

  useEffect(() => {
    if (showSuggest) {
      // wait for the 0.45s height animation to finish so we center the panel
      // at its full size, not mid-expand
      const id = setTimeout(
        () =>
          suggestRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          }),
        480,
      );
      return () => clearTimeout(id);
    }
  }, [showSuggest]);

  const tabs = [
    {
      id: "recent" as const,
      label: "recently played",
      count: recentTracks.length || 0,
    },
    {
      id: "top" as const,
      label: "top tracks",
      count: topTracks?.tracks.length || 0,
    },
    {
      id: "playlists" as const,
      label: "playlists",
      count: playlists?.playlists.length || 0,
    },
  ];

  return (
    <div
      ref={containerRef}
      className="min-h-screen page-reveal overflow-hidden"
    >
      {/* Dynamic background elements - colors change based on now playing */}
      <div className="fixed inset-0 pointer-events-none">
        <FloatingShapes primaryColor={nowPlayingColor} />
        <ScatteredElements primaryColor={nowPlayingColor} />
      </div>
      <GradientOrbs primaryColor={nowPlayingColor} />

      <main className="relative z-10 min-h-screen">
        {/* Hero Section — the mixtape cover */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="pt-20 pb-6 md:pt-28 md:pb-10"
        >
          <div className="max-w-5xl mx-auto px-4 md:px-8">
            {/* Liner-note masthead */}
            <motion.div
              className="relative mb-10 text-center md:mb-14"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <span className="block -rotate-2 font-hand text-2xl text-accent-purple md:text-3xl">
                what i&apos;m listening to
              </span>

              <div className="relative mx-auto mt-2 inline-block">
                <h1 className="font-serif text-6xl font-medium tracking-tight text-ink md:text-8xl">
                  music
                </h1>
                <Doodle
                  name="underline"
                  tone="orange"
                  draw
                  className="absolute -bottom-3 left-0 h-4 w-full"
                  strokeWidth={3}
                />
                <Doodle
                  name="star"
                  tone="purple"
                  className="absolute -right-7 -top-2 h-5 w-5 rotate-12"
                  strokeWidth={2}
                />
              </div>

              <p className="mt-5 font-serif text-lg italic text-ink-soft md:text-xl">
                a window into my (sonic) world
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <a
                  href="https://open.spotify.com/user/jtjyzh7ke7twmvg5t3bwm4skf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-sketch group/follow"
                >
                  <svg
                    className="h-4 w-4 transition-transform group-hover/follow:rotate-12"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
                  </svg>
                  follow on spotify
                </a>

                <button
                  type="button"
                  onClick={() => setShowSuggest((v) => !v)}
                  aria-expanded={showSuggest}
                  className="btn-sketch btn-sketch-solid group/suggest"
                >
                  <svg
                    className="h-4 w-4 transition-transform group-hover/suggest:rotate-12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
                  </svg>
                  {showSuggest ? "maybe later" : "suggest me a song"}
                </button>
              </div>

              {/* invisible (not removed) while the panel is open so nothing
                  shifts — the button reads "maybe later" then, and the arrow
                  pointing at it would lie */}
              <p
                className={`mt-3 -rotate-1 font-hand text-lg text-ink-faint ${
                  showSuggest ? "invisible" : ""
                }`}
              >
                ↑ suggest me a song
              </p>
            </motion.div>

            {/* Suggest-a-song — collapses inline so it reads as a CTA */}
            <AnimatePresence initial={false}>
              {showSuggest && (
                <motion.div
                  key="suggest-panel"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div
                    ref={suggestRef}
                    className="mx-auto max-w-2xl px-1 pb-2 pt-8 text-left"
                  >
                    <SideB onClose={() => setShowSuggest(false)} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Now Playing — the frame is always mounted so the tabs and
                tracklist below never jump when the fetch lands; the panel's
                interior inks itself in once the song arrives. */}
            <ChaoticNowPlaying
              nowPlaying={nowPlaying ?? null}
              accentColor={nowPlayingColor}
              mouseX={mouseX}
              mouseY={mouseY}
            />

            {/* Tabs */}
            <ChaoticTabs
              tabs={tabs}
              selectedTab={selectedTab}
              onSelect={handleTabSelect}
              accentColor={nowPlayingColor}
            />
          </div>
        </motion.section>

        {/* Content — mount on first visit, keep alive after, toggle with CSS */}
        <div className="max-w-4xl mx-auto px-4 md:px-8 pb-28 md:pb-16 mt-6 md:mt-10">
          {visitedTabs.has("recent") && (
            <div className={selectedTab === "recent" ? "" : "hidden"}>
              <SheetHeading label="the rotation" sub="recently played" />
              <motion.div
                className="space-y-2.5 md:space-y-3"
                style={{ x: trackPX, y: trackPY }}
              >
                {recentLoading && !recentlyPlayed ? (
                  <PlaceholderTrackRows />
                ) : recentError && !recentlyPlayed ? (
                  <CrateNote onRetry={() => mutateRecent()} />
                ) : (
                  <>
                    {recentTracks.map((track, index) => (
                      <ChaoticTrackCard
                        key={track.id + index}
                        track={track}
                        index={index}
                        repeatCount={track.repeatCount}
                      />
                    ))}
                    {recentTracks.length === 0 && (
                      <EmptyState
                        emoji="🎵"
                        message="no recently played tracks found"
                      />
                    )}
                  </>
                )}
              </motion.div>
            </div>
          )}

          {visitedTabs.has("top") && (
            <div className={selectedTab === "top" ? "" : "hidden"}>
              <SheetHeading label="heavy hitters" sub="top of the moment" />
              <motion.div
                className="space-y-2.5 md:space-y-3"
                style={{ x: trackPX, y: trackPY }}
              >
                {topLoading && !topTracks ? (
                  <PlaceholderTrackRows />
                ) : topError && !topTracks ? (
                  <CrateNote onRetry={() => mutateTop()} />
                ) : (
                  <>
                    {topTracks?.tracks.map((track, index) => (
                      <ChaoticTrackCard
                        key={track.id}
                        track={track}
                        index={index}
                        isTopTrack
                      />
                    ))}
                    {(!topTracks || topTracks.tracks.length === 0) && (
                      <EmptyState emoji="🏆" message="no top tracks found" />
                    )}
                  </>
                )}
              </motion.div>
            </div>
          )}

          {visitedTabs.has("playlists") && (
            <div className={selectedTab === "playlists" ? "" : "hidden"}>
              <SheetHeading
                label="my playlists"
                sub="curated by me"
              />
              <motion.div
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-[minmax(140px,auto)] md:auto-rows-[minmax(160px,auto)]"
                style={{ x: listPX, y: listPY }}
              >
                {playlistsLoading && !playlists ? (
                  <PlaceholderPlaylistCells />
                ) : playlistsError && !playlists ? (
                  <div className="col-span-full">
                    <CrateNote onRetry={() => mutatePlaylists()} />
                  </div>
                ) : (
                  <>
                    {playlists?.playlists.map((playlist, index) => (
                      <ChaoticPlaylistCard
                        key={playlist.id}
                        playlist={playlist}
                        index={index}
                      />
                    ))}
                    {(!playlists || playlists.playlists.length === 0) && (
                      <div className="col-span-full">
                        <EmptyState emoji="📀" message="no playlists found" />
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function SheetHeading({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3 border-b border-dashed border-line pb-2 md:mb-7">
      <div className="flex items-baseline gap-3">
        <Stamp tone="purple" rotate={-3}>
          tracklist
        </Stamp>
        <h2 className="font-serif text-2xl font-medium text-ink md:text-3xl">
          {label}
        </h2>
      </div>
      <HandNote
        tone="rust"
        rotate={-2}
        className="hidden text-lg sm:block md:text-xl"
      >
        {sub}
      </HandNote>
    </div>
  );
}

// Blank tracklist lines — the exact box of a loaded track card (same paddings,
// art-stub square, dotted leader) drawn faint and dashed, like numbered rows
// waiting to be inked in. No pulse, no shimmer — it's just paper. Only shows
// when the server-seeded fallbackData is missing (the safety net).
function PlaceholderTrackRows({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className="rounded-[3px] border-2 border-dashed border-line/70 bg-paper-2/40 px-3 py-3 pl-4 opacity-70 md:px-5 md:py-4 md:pl-6"
          style={{ transform: `rotate(${i % 2 === 0 ? -0.6 : 0.5}deg)` }}
        >
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-7 flex-shrink-0 text-center font-hand text-2xl leading-none text-ink-faint md:w-9 md:text-3xl">
              {(i + 1).toString().padStart(2, "0")}
            </div>
            <div className="h-12 w-12 flex-shrink-0 rounded-[2px] border border-dashed border-line bg-paper-2/60 md:h-14 md:w-14" />
            <div className="min-w-0 flex-1 self-center border-b border-dotted border-line pb-1" />
          </div>
        </div>
      ))}
    </>
  );
}

// Empty mixtape sleeves for the playlist wall — same card box (border, p-2,
// min-height, artwork window) as a loaded small ChaoticPlaylistCard, faint.
function PlaceholderPlaylistCells({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className="relative flex flex-col rounded-[3px] border border-dashed border-line/80 bg-paper-2/40 p-2 opacity-70"
          style={{
            minHeight: "160px",
            transform: `rotate(${i % 2 === 0 ? -0.8 : 0.7}deg)`,
          }}
        >
          <div className="flex-1 rounded-[2px] border border-dashed border-line/70 bg-paper-2/60" />
          <div className="px-1 pt-2">
            <div className="h-5 w-2/3 border-b border-dashed border-line" />
          </div>
        </div>
      ))}
    </>
  );
}

// In-idiom failure note with a retry — same jotted voice and dashed-underline
// affordance as the suggest box's "the mailbox jammed" note.
function CrateNote({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="py-14 text-center">
      <p className="-rotate-1 font-hand text-2xl text-accent-rust">
        the record crate is jammed
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 font-hand text-lg text-ink-faint underline decoration-dashed decoration-line underline-offset-4 transition-colors hover:text-accent-orange"
      >
        try again
      </button>
    </div>
  );
}

function EmptyState({ emoji, message }: { emoji: string; message: string }) {
  return (
    <motion.div
      className="text-center py-16"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <motion.div
        animate={{ rotate: [0, 10, -10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="text-6xl mb-4"
      >
        {emoji}
      </motion.div>
      <p className="font-hand text-2xl text-ink-faint">{message}</p>
    </motion.div>
  );
}
