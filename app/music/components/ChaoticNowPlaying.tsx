"use client";

import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import Image from "next/image";
import { hexToRgb, adjustBrightness } from "../lib/chaotic-styles";

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

interface ChaoticNowPlayingProps {
  nowPlaying: NowPlayingTrack;
  accentColor: string;
  mouseX: ReturnType<typeof useMotionValue<number>>;
  mouseY: ReturnType<typeof useMotionValue<number>>;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function ChaoticNowPlaying({
  nowPlaying,
  accentColor,
  mouseX,
  mouseY,
}: ChaoticNowPlayingProps) {
  const x = useTransform(mouseX, [0, 1], [-15, 15]);
  const y = useTransform(mouseY, [0, 1], [-10, 10]);
  const springX = useSpring(x, { stiffness: 100, damping: 20 });
  const springY = useSpring(y, { stiffness: 100, damping: 20 });

  const rgb = hexToRgb(accentColor);
  const lighterColor = adjustBrightness(accentColor, 20);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
      style={{ x: springX, y: springY }}
      className="mb-12 md:mb-16"
    >
      <div className="relative bg-gradient-to-br from-charcoal-black/95 via-void-black/90 to-charcoal-black/95 border border-white/10 rounded-3xl p-6 md:p-10 overflow-hidden group">
        {/* Animated background gradient */}
        <motion.div
          className="absolute inset-0 opacity-50"
          animate={{
            background: [
              `radial-gradient(circle at 20% 50%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15), transparent 50%)`,
              `radial-gradient(circle at 80% 50%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15), transparent 50%)`,
              `radial-gradient(circle at 20% 50%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15), transparent 50%)`,
            ],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Noise texture */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-10">
          {/* Album Art with vinyl effect */}
          <div className="relative">
            {nowPlaying.albumImageUrl && (
              <motion.div
                className="relative w-32 h-32 md:w-48 md:h-48 rounded-2xl overflow-hidden shadow-2xl shadow-black/50"
                whileHover={{ scale: 1.05, rotate: 2 }}
                transition={{ duration: 0.3 }}
              >
                <Image
                  src={nowPlaying.albumImageUrl}
                  alt={nowPlaying.album}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 128px, 192px"
                />
                {/* Vinyl overlay */}
                <motion.div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2), transparent, rgba(124, 119, 198, 0.2))`,
                  }}
                  animate={
                    nowPlaying.isPlaying
                      ? { opacity: [0.3, 0.6, 0.3] }
                      : { opacity: 0.2 }
                  }
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </motion.div>
            )}

            {/* Animated ring around album */}
            {nowPlaying.isPlaying && (
              <motion.div
                className="absolute -inset-3 rounded-3xl border-2"
                style={{ borderColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)` }}
                animate={{
                  scale: [1, 1.05, 1],
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </div>

          {/* Track Info */}
          <div className="flex-1 text-center md:text-left">
            <motion.div
              className="flex items-center justify-center md:justify-start gap-3 mb-4"
              animate={nowPlaying.isPlaying ? { x: [0, 2, 0] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <motion.div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: nowPlaying.isPlaying ? accentColor : "#6b7280" }}
                animate={
                  nowPlaying.isPlaying
                    ? {
                        scale: [1, 1.3, 1],
                        boxShadow: [
                          `0 0 0 0 rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`,
                          `0 0 0 10px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`,
                          `0 0 0 0 rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`,
                        ],
                      }
                    : {}
                }
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className="text-sm text-gray-400 font-light uppercase tracking-wider">
                {nowPlaying.isPlaying ? "now playing" : "last played"}
              </span>
            </motion.div>

            <motion.h2
              className="text-2xl md:text-4xl font-bold text-white mb-2 leading-tight"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {nowPlaying.title}
            </motion.h2>

            <motion.p
              className="text-lg md:text-xl text-gray-300 mb-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {nowPlaying.artist}
            </motion.p>

            <motion.p
              className="text-gray-500 mb-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              {nowPlaying.album}
            </motion.p>

            {/* Progress bar */}
            {nowPlaying.isPlaying &&
              nowPlaying.progress &&
              nowPlaying.duration && (
                <div className="space-y-2">
                  <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="absolute left-0 top-0 h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${accentColor}, ${lighterColor})`,
                      }}
                      initial={{ width: "0%" }}
                      animate={{
                        width: `${(nowPlaying.progress / nowPlaying.duration) * 100}%`,
                      }}
                      transition={{ duration: 0.5 }}
                    />
                    {/* Glow effect on progress */}
                    <motion.div
                      className="absolute top-0 h-full w-4 blur-md rounded-full"
                      style={{
                        backgroundColor: accentColor,
                        left: `calc(${(nowPlaying.progress / nowPlaying.duration) * 100}% - 8px)`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-gray-500 font-mono">
                    <span>{formatTime(nowPlaying.progress)}</span>
                    <span>{formatTime(nowPlaying.duration)}</span>
                  </div>
                </div>
              )}
          </div>

          {/* Spotify Link */}
          {nowPlaying.songUrl && (
            <motion.a
              href={nowPlaying.songUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 rounded-full transition-all duration-300 group/btn"
              style={{
                backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`,
                borderWidth: 1,
                borderColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`,
              }}
              whileHover={{
                scale: 1.1,
                rotate: 10,
                backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`,
                borderColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`,
              }}
              whileTap={{ scale: 0.95 }}
            >
              <svg
                className="w-8 h-8 transition-colors"
                style={{ color: accentColor }}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
            </motion.a>
          )}
        </div>

        {/* Corner accents */}
        <motion.div
          className="absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-10"
          style={{ backgroundColor: accentColor }}
          animate={{ backgroundColor: accentColor }}
          transition={{ duration: 1 }}
        />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent-purple/10 rounded-tr-full" />
      </div>
    </motion.div>
  );
}
