"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence, useMotionValue } from "motion/react";
import useSWR from "swr";
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

export default function MusicPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const [selectedTab, setSelectedTab] = useState<"recent" | "top" | "playlists">("recent");

  // Fetch data
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
      preloadColors(recentlyPlayed.tracks.slice(0, 10).map((t) => t.albumImageUrl));
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
    { id: "recent" as const, label: "Recently Played", count: recentlyPlayed?.tracks.length || 0 },
    { id: "top" as const, label: "Top Tracks", count: topTracks?.tracks.length || 0 },
    { id: "playlists" as const, label: "Playlists", count: playlists?.playlists.length || 0 },
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
              <motion.h1
                className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-4"
                animate={{
                  backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                style={{
                  backgroundImage: `linear-gradient(90deg, #fff, ${nowPlayingColor}, #7c77c6, #fff)`,
                  backgroundSize: "200% auto",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                music
              </motion.h1>
              <motion.p
                className="text-lg md:text-xl text-gray-400 font-light"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                a window into my sonic world
              </motion.p>
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
              onSelect={(id) => setSelectedTab(id as "recent" | "top" | "playlists")}
              accentColor={nowPlayingColor}
            />
          </div>
        </motion.section>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 md:px-8 pb-24">
          <AnimatePresence mode="wait">
            {selectedTab === "recent" && (
              <motion.div
                key="recent"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="space-y-3 md:space-y-4"
              >
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
                  <EmptyState emoji="🎵" message="No recently played tracks found." />
                )}
              </motion.div>
            )}

            {selectedTab === "top" && (
              <motion.div
                key="top"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="space-y-3 md:space-y-4"
              >
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
              </motion.div>
            )}

            {selectedTab === "playlists" && (
              <motion.div
                key="playlists"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 auto-rows-[minmax(140px,auto)] md:auto-rows-[minmax(160px,auto)]"
              >
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
              </motion.div>
            )}
          </AnimatePresence>
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
