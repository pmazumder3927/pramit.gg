"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useMotionValue } from "motion/react";
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
} from "./components";

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
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Preload all Spotify data as soon as this module is imported (i.e. when Next.js
// prefetches the music page on link hover). This means the SWR cache is already
// warm by the time the component mounts.
preload("/api/spotify/now-playing", fetcher);
preload("/api/spotify/recently-played", fetcher);
preload("/api/spotify/top-tracks", fetcher);
preload("/api/spotify/playlists", fetcher);

export default function MusicClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const [selectedTab, setSelectedTab] = useState<
    "recent" | "top" | "playlists"
  >("recent");
  // Track which tabs have been opened so we mount them once and keep them alive
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(["recent"]));

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
    fetcher,
    { refreshInterval: 30000 }
  );
  const { data: recentlyPlayed } = useSWR<{ tracks: SpotifyTrack[] }>(
    "/api/spotify/recently-played",
    fetcher,
    { refreshInterval: 60000 }
  );
  const { data: topTracks } = useSWR<{ tracks: SpotifyTrack[] }>(
    "/api/spotify/top-tracks",
    fetcher,
    { refreshInterval: 300000 }
  );
  const { data: playlists } = useSWR<{ playlists: SpotifyPlaylist[] }>(
    "/api/spotify/playlists",
    fetcher,
    { refreshInterval: 600000 }
  );

  // Extract color from now playing album art - this drives the page's accent color
  const nowPlayingColor = useAlbumColor(nowPlaying?.albumImageUrl || null);

  // Preload colors for visible tracks
  useEffect(() => {
    if (recentlyPlayed?.tracks) {
      preloadColors(
        recentlyPlayed.tracks.slice(0, 10).map((t) => t.albumImageUrl)
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

  const tabs = [
    {
      id: "recent" as const,
      label: "recently played",
      count: recentlyPlayed?.tracks.length || 0,
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
      className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black page-reveal overflow-hidden"
    >
      {/* Dynamic background elements - colors change based on now playing */}
      <div className="fixed inset-0 pointer-events-none">
        <FloatingShapes primaryColor={nowPlayingColor} />
        <ScatteredElements primaryColor={nowPlayingColor} />
      </div>
      <GradientOrbs primaryColor={nowPlayingColor} />

      <main className="relative z-10 min-h-screen">
        {/* Hero Section */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="pt-20 pb-8 md:pt-32 md:pb-12"
        >
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            {/* Title with dynamic gradient */}
            <motion.div
              className="text-center mb-8 md:mb-12"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <h1
                className="text-5xl md:text-7xl lg:text-8xl font-extralight tracking-tight mb-4"
                style={{
                  backgroundImage: `linear-gradient(90deg, #fff, ${nowPlayingColor}, #7c77c6)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                music
              </h1>
              <motion.p
                className="text-lg md:text-xl text-gray-400 font-light mb-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                a window into my (sonic) world
              </motion.p>
              <motion.a
                href="https://open.spotify.com/user/jtjyzh7ke7twmvg5t3bwm4skf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 border"
                style={{
                  backgroundColor: `${nowPlayingColor}15`,
                  borderColor: `${nowPlayingColor}30`,
                  color: nowPlayingColor,
                }}
                whileHover={{
                  scale: 1.05,
                  backgroundColor: `${nowPlayingColor}25`,
                  borderColor: `${nowPlayingColor}50`,
                }}
                whileTap={{ scale: 0.97 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
                Follow on Spotify
              </motion.a>
            </motion.div>

            {/* Now Playing */}
            {nowPlaying && (
              <ChaoticNowPlaying
                nowPlaying={nowPlaying}
                accentColor={nowPlayingColor}
                mouseX={mouseX}
                mouseY={mouseY}
              />
            )}

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
        <div className="max-w-7xl mx-auto px-4 md:px-8 pb-24">
          {visitedTabs.has("recent") && (
            <div className={selectedTab === "recent" ? "" : "hidden"}>
              <div className="space-y-3 md:space-y-4">
                {recentlyPlayed?.tracks.map((track, index) => (
                  <ChaoticTrackCard
                    key={track.id + index}
                    track={track}
                    index={index}
                    mouseX={mouseX}
                    mouseY={mouseY}
                  />
                ))}
                {(!recentlyPlayed || recentlyPlayed.tracks.length === 0) && (
                  <EmptyState
                    emoji="🎵"
                    message="No recently played tracks found."
                  />
                )}
              </div>
            </div>
          )}

          {visitedTabs.has("top") && (
            <div className={selectedTab === "top" ? "" : "hidden"}>
              <div className="space-y-3 md:space-y-4">
                {topTracks?.tracks.map((track, index) => (
                  <ChaoticTrackCard
                    key={track.id}
                    track={track}
                    index={index}
                    isTopTrack
                    mouseX={mouseX}
                    mouseY={mouseY}
                  />
                ))}
                {(!topTracks || topTracks.tracks.length === 0) && (
                  <EmptyState emoji="🏆" message="No top tracks found." />
                )}
              </div>
            </div>
          )}

          {visitedTabs.has("playlists") && (
            <div className={selectedTab === "playlists" ? "" : "hidden"}>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 auto-rows-[minmax(140px,auto)] md:auto-rows-[minmax(160px,auto)]">
                {playlists?.playlists.map((playlist, index) => (
                  <ChaoticPlaylistCard
                    key={playlist.id}
                    playlist={playlist}
                    index={index}
                    mouseX={mouseX}
                    mouseY={mouseY}
                  />
                ))}
                {(!playlists || playlists.playlists.length === 0) && (
                  <div className="col-span-full">
                    <EmptyState emoji="📀" message="No playlists found." />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
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
      <p className="text-gray-500">{message}</p>
    </motion.div>
  );
}
