"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useSWR from "swr";
import Image from "next/image";
import Link from "next/link";

interface SpotifyTrack {
  isPlaying: boolean;
  title: string;
  artist: string;
  album: string;
  albumImageUrl: string | null;
  songUrl: string | null;
  progress?: number;
  duration?: number;
  playedAt?: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function NowPlaying() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { data: track, error } = useSWR<SpotifyTrack>(
    "/api/spotify/now-playing",
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: false,
    }
  );

  if (error || !track) {
    return (
      <motion.div
        className="relative group cursor-pointer"
        whileHover={{ scale: 1.02 }}
      >
        <div className="relative bg-gradient-to-br from-charcoal-black/90 via-charcoal-black/70 to-void-black/90 backdrop-blur-xl border border-white/5 rounded-2xl p-4 overflow-hidden transition-all duration-700 hover:border-white/10 hover:shadow-xl hover:shadow-black/30">
          {/* Ambient Light Effect */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
            <div className="absolute inset-0 bg-gradient-to-br from-accent-orange/10 via-transparent to-accent-purple/10 blur-3xl" />
          </div>

          <div className="relative z-10 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-gray-600" />
            <span className="text-sm text-gray-500 font-light">
              now playing:
            </span>
            <span className="text-sm text-accent-orange font-light">
              nothing
            </span>
          </div>

          {/* Accent Line */}
          <motion.div
            className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-accent-orange via-accent-purple to-accent-orange opacity-0 group-hover:opacity-60"
            initial={{ width: "0%" }}
            whileHover={{ width: "100%" }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          />
        </div>
      </motion.div>
    );
  }

  const progressPercentage =
    track.progress && track.duration
      ? (track.progress / track.duration) * 100
      : 0;

  return (
    <div className="relative">
      <motion.div
        className="relative group cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ scale: 1.02 }}
      >
        <div className="relative bg-gradient-to-br from-charcoal-black/90 via-charcoal-black/70 to-void-black/90 backdrop-blur-xl border border-white/5 rounded-2xl p-4 overflow-hidden transition-all duration-700 hover:border-white/10 hover:shadow-xl hover:shadow-black/30">
          {/* Ambient Light Effect */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
            <div className="absolute inset-0 bg-gradient-to-br from-accent-orange/10 via-transparent to-accent-purple/10 blur-3xl" />
          </div>

          {/* Subtle Grid Pattern */}
          <div className="absolute inset-0 opacity-[0.02] group-hover:opacity-[0.04] transition-opacity duration-700">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
                backgroundSize: "20px 20px",
              }}
            />
          </div>

          <div className="relative z-10 flex items-center gap-3">
            {/* Status indicator */}
            <motion.div
              className={`w-2 h-2 rounded-full ${
                track.isPlaying ? "bg-green-500" : "bg-gray-500"
              }`}
              animate={track.isPlaying ? { opacity: [1, 0.3, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            />

            <span className="text-sm text-gray-500 font-light">
              {track.isPlaying ? "now playing:" : "last played:"}
            </span>

            {/* Track info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {track.albumImageUrl && (
                <div className="relative w-6 h-6 rounded-md overflow-hidden flex-shrink-0">
                  <Image
                    src={track.albumImageUrl}
                    alt={track.album}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="24px"
                  />
                  {track.isPlaying && (
                    <div className="absolute inset-0 bg-gradient-to-tr from-accent-orange/20 to-transparent" />
                  )}
                </div>
              )}

              <motion.div
                className="text-sm text-accent-orange truncate font-light group-hover:text-white transition-colors duration-300"
                animate={{ opacity: track.isPlaying ? [1, 0.7, 1] : 1 }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                {track.title}
              </motion.div>
            </div>

            {/* View More Link */}
            <Link
              href="/music"
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-xs text-gray-500 hover:text-accent-purple font-light"
              onClick={(e) => e.stopPropagation()}
            >
              view more
            </Link>

            {/* Expand icon */}
            <motion.svg
              className="w-3 h-3 text-gray-500 group-hover:text-white transition-colors duration-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </motion.svg>
          </div>

          {/* Accent Line */}
          <motion.div
            className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-accent-orange via-accent-purple to-accent-orange opacity-0 group-hover:opacity-60"
            initial={{ width: "0%" }}
            animate={{ width: isHovered ? "100%" : "0%" }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          />

          {/* Corner Accent */}
          <div className="absolute top-0 right-0 w-16 h-16 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
            <div className="absolute inset-0 bg-gradient-to-bl from-accent-orange/10 to-transparent rounded-bl-full" />
          </div>
        </div>
      </motion.div>

      {/* Expanded view */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute bottom-full right-0 mb-4 z-50"
          >
            <div className="relative bg-gradient-to-br from-charcoal-black/95 via-charcoal-black/90 to-void-black/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 min-w-96 overflow-hidden shadow-2xl shadow-black/50">
              {/* Ambient glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-accent-orange/5 via-transparent to-accent-purple/5" />

              <div className="relative z-10 flex items-start gap-4">
                {/* Album art */}
                {track.albumImageUrl && (
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                    <Image
                      src={track.albumImageUrl}
                      alt={track.album}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                    {track.isPlaying && (
                      <div className="absolute inset-0 bg-gradient-to-tr from-accent-orange/20 to-transparent" />
                    )}
                  </div>
                )}

                {/* Track details */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white text-lg truncate mb-1">
                    {track.title}
                  </h3>
                  <p className="text-gray-400 text-sm truncate mb-1">
                    by {track.artist}
                  </p>
                  <p className="text-gray-500 text-sm truncate mb-4">
                    {track.album}
                  </p>

                  {/* Progress bar for currently playing */}
                  {track.isPlaying && track.progress && track.duration && (
                    <div className="space-y-2 mb-4">
                      <div className="relative h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <motion.div
                          className="absolute left-0 top-0 h-full bg-gradient-to-r from-accent-orange to-accent-purple rounded-full"
                          initial={{ width: "0%" }}
                          animate={{ width: `${progressPercentage}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{formatTime(track.progress)}</span>
                        <span>{formatTime(track.duration)}</span>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-3">
                    {/* Spotify link */}
                    {track.songUrl && (
                      <motion.a
                        href={track.songUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 text-xs bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 hover:border-green-500/30 rounded-lg transition-all duration-300"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <svg
                          className="w-3 h-3"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
                        </svg>
                        open in spotify
                      </motion.a>
                    )}

                    {/* View More link */}
                    <Link
                      href="/music"
                      className="inline-flex items-center gap-2 px-3 py-2 text-xs bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/20 border border-accent-purple/20 hover:border-accent-purple/30 rounded-lg transition-all duration-300"
                    >
                      explore music
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Accent border */}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-accent-orange via-accent-purple to-accent-orange opacity-60" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
