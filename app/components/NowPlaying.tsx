"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
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

// Seeded random for consistent visuals
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return Math.round((x - Math.floor(x)) * 100) / 100;
}

// Visual style variants inspired by ChaoticArticleGrid
type VisualVariant = "neon" | "glassy" | "minimal" | "accent";

function getVariantFromTrack(title: string): VisualVariant {
  const seed = title.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const roll = seededRandom(seed);
  if (roll > 0.75) return "neon";
  if (roll > 0.5) return "glassy";
  if (roll > 0.25) return "accent";
  return "minimal";
}

export default function NowPlaying() {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const { data: track, error } = useSWR<SpotifyTrack>(
    "/api/spotify/now-playing",
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: false,
    }
  );

  // Parallax effect
  const springConfig = { stiffness: 150, damping: 20 };
  const x = useTransform(mouseX, [0, 1], [-8, 8]);
  const y = useTransform(mouseY, [0, 1], [-8, 8]);
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  // Mouse tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX / window.innerWidth);
      mouseY.set(e.clientY / window.innerHeight);
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    }
    if (isExpanded) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isExpanded]);

  const progressPercentage = track?.progress && track?.duration
    ? (track.progress / track.duration) * 100
    : 0;

  const hasTrack = !error && track;
  const variant = hasTrack ? getVariantFromTrack(track.title) : "minimal";

  // Dynamic accent color based on variant
  const accentColor = useMemo(() => {
    if (!hasTrack) return "#ff6b3d";
    const seed = track.title.length * 7919;
    return seededRandom(seed) > 0.5 ? "#ff6b3d" : "#7c77c6";
  }, [hasTrack, track?.title]);

  const getVariantStyles = () => {
    switch (variant) {
      case "neon":
        return {
          container: "bg-void-black/95 border-2",
          glow: `shadow-[0_0_30px_${accentColor}30,0_0_60px_${accentColor}15]`,
          borderColor: accentColor,
        };
      case "glassy":
        return {
          container: "bg-white/[0.08] backdrop-blur-xl border border-white/20",
          glow: "shadow-2xl shadow-black/40",
          borderColor: "transparent",
        };
      case "accent":
        return {
          container: "bg-gradient-to-br from-charcoal-black/95 via-void-black to-charcoal-black/95 border border-white/10",
          glow: "shadow-xl shadow-black/30",
          borderColor: "transparent",
        };
      default:
        return {
          container: "bg-void-black/90 border border-white/[0.08]",
          glow: "shadow-lg shadow-black/20",
          borderColor: "transparent",
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <motion.div
      ref={containerRef}
      className="fixed bottom-24 md:bottom-5 left-5 z-50"
      style={{ x: springX, y: springY }}
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1], delay: 0.5 }}
    >
      {/* Ambient glow behind widget */}
      {hasTrack && track.isPlaying && (
        <motion.div
          className="absolute -inset-4 rounded-3xl pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${accentColor}20 0%, transparent 70%)`,
          }}
          animate={{
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Scattered decorative elements */}
      {hasTrack && (
        <>
          <motion.div
            className="absolute -top-3 -right-2 w-2 h-2 rounded-full pointer-events-none"
            style={{ backgroundColor: accentColor }}
            animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
          />
          <motion.div
            className="absolute -bottom-2 -left-3 w-1.5 h-1.5 rounded-full pointer-events-none"
            style={{ backgroundColor: accentColor === "#ff6b3d" ? "#7c77c6" : "#ff6b3d" }}
            animate={{ opacity: [0.15, 0.4, 0.15] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 1 }}
          />
          <motion.div
            className="absolute top-1/2 -right-4 w-8 h-px pointer-events-none"
            style={{ backgroundColor: accentColor }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: track.isPlaying ? 1 : 0, opacity: track.isPlaying ? 0.3 : 0 }}
            transition={{ duration: 0.5 }}
          />
        </>
      )}

      {/* Main widget */}
      <motion.div
        className={`relative cursor-pointer overflow-hidden rounded-2xl ${styles.container} ${styles.glow}`}
        style={{ borderColor: styles.borderColor }}
        onClick={() => setIsExpanded(!isExpanded)}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.98 }}
        layout
      >
        {/* Noise texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Gradient accent stripe */}
        {variant === "accent" && (
          <div
            className="absolute -right-8 -top-8 w-16 h-16 rotate-45 opacity-20"
            style={{ backgroundColor: accentColor }}
          />
        )}

        {/* Neon border glow lines */}
        {variant === "neon" && (
          <>
            <div
              className="absolute top-0 left-0 right-0 h-px opacity-50"
              style={{ backgroundColor: accentColor }}
            />
            <div
              className="absolute bottom-0 left-0 right-0 h-px opacity-50"
              style={{ backgroundColor: accentColor }}
            />
          </>
        )}

        {/* Content */}
        <div className="relative z-10 flex items-center gap-3 p-3 pr-4">
          {/* Album art with effects */}
          <div className="relative flex-shrink-0">
            {hasTrack && track.albumImageUrl ? (
              <motion.div
                className="relative w-11 h-11 rounded-xl overflow-hidden"
                animate={track.isPlaying ? {
                  boxShadow: [
                    `0 0 0 0 ${accentColor}00`,
                    `0 0 12px 2px ${accentColor}40`,
                    `0 0 0 0 ${accentColor}00`
                  ]
                } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Image
                  src={track.albumImageUrl}
                  alt={track.album}
                  fill
                  className="object-cover"
                  sizes="44px"
                />
                {/* Vinyl spin effect when playing */}
                {track.isPlaying && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-white/10"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  />
                )}
              </motion.div>
            ) : (
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${accentColor}15` }}
              >
                <svg className="w-5 h-5" style={{ color: accentColor }} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
              </div>
            )}

            {/* Playing indicator badge */}
            {hasTrack && track.isPlaying && (
              <motion.div
                className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-void-black flex items-center justify-center overflow-hidden"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
              >
                <div className="flex items-end gap-[2px] h-2">
                  {[0, 0.15, 0.3].map((delay, i) => (
                    <motion.div
                      key={i}
                      className="w-[2px] bg-void-black rounded-full"
                      animate={{ height: ["3px", "6px", "3px"] }}
                      transition={{ duration: 0.5, repeat: Infinity, delay }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Track info */}
          <div className="flex flex-col min-w-0 max-w-[160px]">
            <span
              className="text-[9px] uppercase tracking-widest font-medium"
              style={{ color: `${accentColor}99` }}
            >
              {hasTrack ? (track.isPlaying ? "Now Playing" : "Last Played") : "Offline"}
            </span>
            {hasTrack ? (
              <>
                <motion.span
                  className="text-sm font-medium text-white truncate leading-tight"
                  key={track.title}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {track.title}
                </motion.span>
                <span className="text-xs text-gray-400 truncate leading-tight">
                  {track.artist}
                </span>
              </>
            ) : (
              <span className="text-sm text-gray-500">Nothing playing</span>
            )}
          </div>

          {/* Expand chevron */}
          <motion.svg
            className="w-4 h-4 text-gray-500 ml-1 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </motion.svg>
        </div>

        {/* Progress bar */}
        {hasTrack && track.progress && track.duration && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${accentColor}, ${accentColor === "#ff6b3d" ? "#7c77c6" : "#ff6b3d"})`
              }}
              initial={{ width: "0%" }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        )}
      </motion.div>

      {/* Expanded panel */}
      <AnimatePresence>
        {isExpanded && hasTrack && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95, rotateX: -10 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
            className="absolute bottom-full left-0 mb-3 w-72"
            style={{ perspective: "1000px" }}
          >
            <div
              className={`relative overflow-hidden rounded-2xl ${styles.container} ${styles.glow}`}
              style={{ borderColor: styles.borderColor }}
            >
              {/* Album art background blur */}
              <div className="relative h-28 overflow-hidden">
                {track.albumImageUrl && (
                  <>
                    <Image
                      src={track.albumImageUrl}
                      alt={track.album}
                      fill
                      className="object-cover blur-md scale-125 opacity-60"
                      sizes="288px"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-void-black/60 to-void-black" />
                  </>
                )}

                {/* Centered album art */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {track.albumImageUrl && (
                    <motion.div
                      className="relative w-16 h-16 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                    >
                      <Image
                        src={track.albumImageUrl}
                        alt={track.album}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    </motion.div>
                  )}
                </div>

                {/* Decorative corner accent */}
                <div
                  className="absolute top-0 right-0 w-20 h-20 opacity-20"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor}40 0%, transparent 60%)`,
                  }}
                />
              </div>

              {/* Track details */}
              <div className="relative z-10 p-4 pt-2">
                <div className="text-center mb-3">
                  <h3 className="font-semibold text-white text-base truncate mb-0.5">
                    {track.title}
                  </h3>
                  <p className="text-gray-400 text-sm truncate">{track.artist}</p>
                  <p className="text-gray-500 text-xs truncate">{track.album}</p>
                </div>

                {/* Progress */}
                {track.isPlaying && track.progress && track.duration && (
                  <div className="mb-4">
                    <div className="relative h-1 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="absolute left-0 top-0 h-full rounded-full"
                        style={{
                          background: `linear-gradient(90deg, ${accentColor}, ${accentColor === "#ff6b3d" ? "#7c77c6" : "#ff6b3d"})`
                        }}
                        initial={{ width: "0%" }}
                        animate={{ width: `${progressPercentage}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1.5 font-mono">
                      <span>{formatTime(track.progress)}</span>
                      <span>{formatTime(track.duration)}</span>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  {track.songUrl && (
                    <motion.a
                      href={track.songUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 rounded-xl transition-colors"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
                      </svg>
                      Spotify
                    </motion.a>
                  )}
                  <Link
                    href="/music"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium hover:bg-white/10 border border-white/10 rounded-xl transition-colors"
                    style={{ color: accentColor }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Explore
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>

              {/* Bottom accent line */}
              <div
                className="absolute bottom-0 left-0 right-0 h-px opacity-40"
                style={{
                  background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
