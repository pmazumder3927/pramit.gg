"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import useSWR from "swr";
import Image from "next/image";
import Navigation from "@/app/components/Navigation";
import { formatDistanceToNow } from "date-fns";

interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumImageUrl: string | null;
  songUrl: string | null;
  playedAt?: string;
  duration?: number;
  preview_url?: string | null;
  popularity?: number;
  explicit?: boolean;
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  playlistUrl: string;
  trackCount: number;
  owner: string;
  public: boolean;
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
  playedAt?: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Seeded random for consistent chaos
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return Math.round((x - Math.floor(x)) * 100) / 100;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

// Card variants for chaotic styling
type CardVariant =
  | "default"
  | "glassy"
  | "neon"
  | "brutalist"
  | "inverted"
  | "outlined"
  | "accent";

interface ChaoticStyle {
  rotation: number;
  offsetX: number;
  offsetY: number;
  variant: CardVariant;
  scale: number;
}

function generateChaoticStyle(index: number): ChaoticStyle {
  const seed = index * 7919;

  const rotation = (seededRandom(seed + 1) * 8 - 4) * 0.6;
  const offsetX = (seededRandom(seed + 2) * 30 - 15) * 0.4;
  const offsetY = (seededRandom(seed + 3) * 20 - 10) * 0.4;
  const scale = 0.98 + seededRandom(seed + 4) * 0.04;

  const variantRoll = seededRandom(seed + 5);
  let variant: CardVariant;
  if (variantRoll > 0.88) {
    variant = "neon";
  } else if (variantRoll > 0.76) {
    variant = "brutalist";
  } else if (variantRoll > 0.62) {
    variant = "inverted";
  } else if (variantRoll > 0.48) {
    variant = "glassy";
  } else if (variantRoll > 0.32) {
    variant = "outlined";
  } else if (variantRoll > 0.18) {
    variant = "accent";
  } else {
    variant = "default";
  }

  return { rotation, offsetX, offsetY, variant, scale };
}

// Floating shapes background
function FloatingShapes() {
  const shapes = useMemo(() => {
    return [...Array(6)].map((_, i) => ({
      x: 10 + seededRandom(i * 1100) * 80,
      y: 10 + seededRandom(i * 1200) * 80,
      size: 60 + seededRandom(i * 1300) * 120,
      rotation: seededRandom(i * 1400) * 45,
      type: seededRandom(i * 1500) > 0.5 ? "ring" : "square",
      color: seededRandom(i * 1600) > 0.5 ? "#ff6b3d" : "#7c77c6",
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {shapes.map((shape, i) => (
        <motion.div
          key={`shape-${i}`}
          className="absolute opacity-[0.04]"
          style={{
            left: `${shape.x}%`,
            top: `${shape.y}%`,
          }}
          animate={{
            y: [0, -10, 0],
            rotate: [shape.rotation, shape.rotation + 5, shape.rotation],
          }}
          transition={{
            duration: 8 + i * 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {shape.type === "ring" ? (
            <div
              className="rounded-full border-2"
              style={{
                width: shape.size,
                height: shape.size,
                borderColor: shape.color,
              }}
            />
          ) : (
            <div
              className="border-2"
              style={{
                width: shape.size,
                height: shape.size,
                borderColor: shape.color,
                transform: `rotate(${shape.rotation}deg)`,
              }}
            />
          )}
        </motion.div>
      ))}
    </div>
  );
}

// Scattered music notes and lines
function ScatteredElements() {
  const elements = useMemo(() => {
    return [...Array(8)].map((_, i) => ({
      type: seededRandom(i * 100) > 0.6 ? "note" : "line",
      x: seededRandom(i * 300) * 100,
      y: seededRandom(i * 400) * 100,
      rotation: seededRandom(i * 500) * 360,
      size: 20 + seededRandom(i * 600) * 40,
      color: seededRandom(i * 800) > 0.5 ? "#ff6b3d" : "#7c77c6",
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {elements.map((el, i) => (
        <motion.div
          key={i}
          className="absolute opacity-[0.08]"
          style={{
            left: `${el.x}%`,
            top: `${el.y}%`,
          }}
          animate={{
            opacity: [0.08, 0.15, 0.08],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 4 + i,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {el.type === "note" ? (
            <svg
              className="w-6 h-6"
              fill={el.color}
              viewBox="0 0 24 24"
              style={{ transform: `rotate(${el.rotation}deg)` }}
            >
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          ) : (
            <div
              className="h-px origin-center"
              style={{
                width: el.size,
                backgroundColor: el.color,
                transform: `rotate(${el.rotation}deg)`,
              }}
            />
          )}
        </motion.div>
      ))}
    </div>
  );
}

// Chaotic Tab Selector
function ChaoticTabs({
  tabs,
  selectedTab,
  onSelect,
}: {
  tabs: { id: string; label: string; count: number }[];
  selectedTab: string;
  onSelect: (id: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="flex flex-wrap gap-3 justify-center mb-8 md:mb-12"
    >
      {tabs.map((tab, index) => {
        const isSelected = selectedTab === tab.id;
        const style = generateChaoticStyle(index + 100);

        return (
          <motion.button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`
              relative px-4 md:px-6 py-2.5 md:py-3 rounded-full transition-all duration-300 overflow-hidden
              ${
                isSelected
                  ? "bg-white/15 text-white shadow-lg shadow-accent-orange/10"
                  : "bg-white/[0.06] text-gray-400 hover:bg-white/10 hover:text-white"
              }
            `}
            style={{
              rotate: isSelected ? 0 : style.rotation * 0.3,
            }}
            whileHover={{
              scale: 1.05,
              rotate: 0,
            }}
            whileTap={{ scale: 0.95 }}
          >
            {/* Glow effect */}
            {isSelected && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-accent-orange/20 via-transparent to-accent-purple/20"
                animate={{ opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}

            <span className="relative z-10 font-light text-sm md:text-base">
              {tab.label}
            </span>

            {tab.count > 0 && (
              <motion.span
                className={`
                  relative z-10 ml-2 text-xs px-2 py-0.5 rounded-full
                  ${
                    isSelected
                      ? "bg-accent-orange/30 text-accent-orange"
                      : "bg-white/10 text-gray-500"
                  }
                `}
                animate={isSelected ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {tab.count}
              </motion.span>
            )}

            {/* Bottom accent line */}
            <motion.div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-gradient-to-r from-transparent via-accent-orange to-transparent"
              initial={{ width: 0, opacity: 0 }}
              animate={{
                width: isSelected ? "80%" : "0%",
                opacity: isSelected ? 1 : 0,
              }}
              transition={{ duration: 0.3 }}
            />
          </motion.button>
        );
      })}
    </motion.div>
  );
}

// Chaotic Now Playing Card
function ChaoticNowPlaying({
  nowPlaying,
  mouseX,
  mouseY,
}: {
  nowPlaying: NowPlayingTrack;
  mouseX: ReturnType<typeof useMotionValue<number>>;
  mouseY: ReturnType<typeof useMotionValue<number>>;
}) {
  const x = useTransform(mouseX, [0, 1], [-15, 15]);
  const y = useTransform(mouseY, [0, 1], [-10, 10]);
  const springX = useSpring(x, { stiffness: 100, damping: 20 });
  const springY = useSpring(y, { stiffness: 100, damping: 20 });

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
              "radial-gradient(circle at 20% 50%, rgba(255, 107, 61, 0.15), transparent 50%)",
              "radial-gradient(circle at 80% 50%, rgba(255, 107, 61, 0.15), transparent 50%)",
              "radial-gradient(circle at 20% 50%, rgba(255, 107, 61, 0.15), transparent 50%)",
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
                  className="absolute inset-0 bg-gradient-to-br from-accent-orange/20 via-transparent to-accent-purple/20"
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
                className="absolute -inset-3 rounded-3xl border-2 border-accent-orange/30"
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
                className={`w-3 h-3 rounded-full ${
                  nowPlaying.isPlaying ? "bg-accent-orange" : "bg-gray-500"
                }`}
                animate={
                  nowPlaying.isPlaying
                    ? {
                        scale: [1, 1.3, 1],
                        boxShadow: [
                          "0 0 0 0 rgba(255, 107, 61, 0.4)",
                          "0 0 0 10px rgba(255, 107, 61, 0)",
                          "0 0 0 0 rgba(255, 107, 61, 0.4)",
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
                      className="absolute left-0 top-0 h-full bg-gradient-to-r from-accent-orange to-accent-yellow rounded-full"
                      initial={{ width: "0%" }}
                      animate={{
                        width: `${
                          (nowPlaying.progress / nowPlaying.duration) * 100
                        }%`,
                      }}
                      transition={{ duration: 0.5 }}
                    />
                    {/* Glow effect on progress */}
                    <motion.div
                      className="absolute top-0 h-full w-4 bg-accent-orange blur-md rounded-full"
                      style={{
                        left: `calc(${
                          (nowPlaying.progress / nowPlaying.duration) * 100
                        }% - 8px)`,
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
              className="p-4 rounded-full bg-accent-orange/10 hover:bg-accent-orange/20 border border-accent-orange/20 hover:border-accent-orange/40 transition-all duration-300 group/btn"
              whileHover={{ scale: 1.1, rotate: 10 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg
                className="w-8 h-8 text-accent-orange group-hover/btn:text-accent-yellow transition-colors"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
            </motion.a>
          )}
        </div>

        {/* Corner accents */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-accent-orange/10 to-transparent rounded-bl-full" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-accent-purple/10 to-transparent rounded-tr-full" />
      </div>
    </motion.div>
  );
}

// Chaotic Track Card
function ChaoticTrackCard({
  track,
  index,
  isTopTrack = false,
  mouseX,
  mouseY,
}: {
  track: SpotifyTrack;
  index: number;
  isTopTrack?: boolean;
  mouseX: ReturnType<typeof useMotionValue<number>>;
  mouseY: ReturnType<typeof useMotionValue<number>>;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const style = useMemo(() => generateChaoticStyle(index), [index]);

  const parallaxStrength = 8;
  const x = useTransform(mouseX, [0, 1], [-parallaxStrength, parallaxStrength]);
  const y = useTransform(mouseY, [0, 1], [-parallaxStrength, parallaxStrength]);
  const springX = useSpring(x, { stiffness: 150, damping: 20 });
  const springY = useSpring(y, { stiffness: 150, damping: 20 });

  const getVariantStyles = () => {
    switch (style.variant) {
      case "neon":
        return {
          bg: "bg-void-black",
          border: "border-2 border-accent-orange/40",
          shadow: "shadow-[0_0_20px_rgba(255,107,61,0.2)]",
          hoverShadow: "shadow-[0_0_30px_rgba(255,107,61,0.4)]",
        };
      case "brutalist":
        return {
          bg: "bg-accent-orange text-void-black",
          border: "border-4 border-black",
          shadow: "shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]",
          hoverShadow: "shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]",
        };
      case "inverted":
        return {
          bg: "bg-white text-void-black",
          border: "border-2 border-black",
          shadow: "shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]",
          hoverShadow: "shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]",
        };
      case "glassy":
        return {
          bg: "bg-white/10",
          border: "border border-white/20",
          shadow: "shadow-xl shadow-black/20",
          hoverShadow: "shadow-2xl shadow-black/30",
        };
      case "outlined":
        return {
          bg: "bg-transparent",
          border: "border-2 border-dashed border-white/30",
          shadow: "",
          hoverShadow: "shadow-lg",
        };
      case "accent":
        return {
          bg: "bg-gradient-to-br from-accent-orange/20 via-void-black to-accent-purple/20",
          border: "border border-white/10",
          shadow: "shadow-xl",
          hoverShadow: "shadow-2xl shadow-accent-orange/20",
        };
      default:
        return {
          bg: "bg-gradient-to-br from-charcoal-black/95 via-charcoal-black/80 to-void-black/95",
          border: "border border-white/5",
          shadow: "shadow-lg shadow-black/30",
          hoverShadow: "shadow-2xl shadow-black/50",
        };
    }
  };

  const variantStyles = getVariantStyles();
  const isDark = !["brutalist", "inverted"].includes(style.variant);
  const textColor = isDark ? "text-white" : "text-void-black";
  const secondaryColor = isDark ? "text-gray-400" : "text-gray-600";

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotate: style.rotation }}
      animate={{
        opacity: 1,
        y: 0,
        rotate: style.rotation * 0.3,
        x: style.offsetX * 0.2,
      }}
      exit={{
        opacity: 0,
        scale: 0.8,
        rotate: style.rotation * 2,
      }}
      transition={{
        delay: index * 0.05,
        duration: 0.6,
        ease: [0.34, 1.56, 0.64, 1],
      }}
      style={{
        x: springX,
        y: springY,
        zIndex: isHovered ? 50 : 1,
      }}
      whileHover={{
        scale: 1.03,
        rotate: 0,
        zIndex: 50,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group cursor-pointer"
    >
      <a
        href={track.songUrl || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <div
          className={`
            relative overflow-hidden transition-all duration-300 rounded-2xl p-4 md:p-6
            ${variantStyles.bg} ${variantStyles.border}
            ${isHovered ? variantStyles.hoverShadow : variantStyles.shadow}
          `}
        >
          {/* Noise texture */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Hover glow */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 0.15 : 0 }}
            style={{
              background:
                "radial-gradient(circle at 50% 50%, rgba(255, 107, 61, 0.5), transparent 70%)",
            }}
          />

          <div className="relative z-10 flex items-center gap-4">
            {/* Track Number */}
            {isTopTrack && (
              <motion.div
                className={`text-2xl md:text-3xl font-bold w-8 md:w-12 flex-shrink-0 ${
                  index < 3 ? "text-accent-orange" : secondaryColor
                }`}
                animate={isHovered ? { scale: 1.2, rotate: -5 } : {}}
                transition={{ duration: 0.2 }}
              >
                {index + 1}
              </motion.div>
            )}

            {/* Album Art */}
            {track.albumImageUrl && (
              <motion.div
                className="relative w-14 h-14 md:w-16 md:h-16 rounded-xl overflow-hidden flex-shrink-0"
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                <Image
                  src={track.albumImageUrl}
                  alt={track.album}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
                <motion.div
                  className="absolute inset-0 bg-gradient-to-tr from-accent-orange/30 to-transparent"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isHovered ? 1 : 0 }}
                />
              </motion.div>
            )}

            {/* Track Info */}
            <div className="flex-1 min-w-0">
              <h3
                className={`font-semibold text-base md:text-lg truncate mb-1 transition-colors duration-300 ${textColor} ${
                  isHovered && isDark ? "text-accent-orange" : ""
                }`}
              >
                {track.title}
              </h3>
              <p className={`${secondaryColor} text-sm truncate mb-0.5`}>
                {track.artist}
              </p>
              <p
                className={`${secondaryColor} text-xs truncate opacity-60 hidden md:block`}
              >
                {track.album}
              </p>
            </div>

            {/* Metadata */}
            <div
              className={`hidden md:flex flex-col items-end gap-1 text-xs ${secondaryColor}`}
            >
              {track.duration && (
                <span className="font-mono">{formatTime(track.duration)}</span>
              )}
              {track.playedAt && (
                <span>
                  {formatDistanceToNow(new Date(track.playedAt), {
                    addSuffix: true,
                  })}
                </span>
              )}
              {track.popularity && (
                <div className="flex items-center gap-1">
                  <svg
                    className="w-3 h-3 text-accent-orange"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span>{track.popularity}</span>
                </div>
              )}
            </div>

            {/* Spotify icon */}
            <motion.div
              className="p-2 rounded-full bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"
              whileHover={{ scale: 1.2, rotate: 10 }}
            >
              <svg
                className="w-5 h-5 text-accent-orange"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
            </motion.div>
          </div>

          {/* Accent line */}
          <motion.div
            className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-accent-orange via-accent-yellow to-accent-purple"
            initial={{ width: "0%" }}
            animate={{ width: isHovered ? "100%" : "0%" }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </a>
    </motion.div>
  );
}

// Chaotic Playlist Card
function ChaoticPlaylistCard({
  playlist,
  index,
  mouseX,
  mouseY,
}: {
  playlist: SpotifyPlaylist;
  index: number;
  mouseX: ReturnType<typeof useMotionValue<number>>;
  mouseY: ReturnType<typeof useMotionValue<number>>;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const style = useMemo(() => generateChaoticStyle(index + 50), [index]);

  const parallaxStrength = 12;
  const x = useTransform(mouseX, [0, 1], [-parallaxStrength, parallaxStrength]);
  const y = useTransform(mouseY, [0, 1], [-parallaxStrength, parallaxStrength]);
  const springX = useSpring(x, { stiffness: 100, damping: 20 });
  const springY = useSpring(y, { stiffness: 100, damping: 20 });

  // Size variants for playlist cards
  const sizeVariant = useMemo(() => {
    const roll = seededRandom(index * 999);
    if (index === 0 || roll > 0.85) return "large";
    if (roll > 0.5) return "medium";
    return "small";
  }, [index]);

  const sizeClasses = {
    large: "col-span-2 row-span-2",
    medium: "col-span-1 row-span-2",
    small: "col-span-1 row-span-1",
  };

  return (
    <motion.div
      className={`${sizeClasses[sizeVariant]} relative`}
      initial={{ opacity: 0, scale: 0.8, rotate: style.rotation }}
      animate={{
        opacity: 1,
        scale: 1,
        rotate: style.rotation * 0.4,
        x: style.offsetX * 0.3,
        y: style.offsetY * 0.3,
      }}
      exit={{
        opacity: 0,
        scale: 0.5,
        rotate: style.rotation * 2,
      }}
      transition={{
        delay: index * 0.08,
        duration: 0.6,
        ease: [0.34, 1.56, 0.64, 1],
      }}
      style={{
        x: springX,
        y: springY,
        zIndex: isHovered ? 50 : 1,
      }}
      whileHover={{
        scale: 1.05,
        rotate: 0,
        zIndex: 50,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <a
        href={playlist.playlistUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-full"
      >
        <div
          className={`
            relative h-full overflow-hidden transition-all duration-300 rounded-2xl md:rounded-3xl
            bg-gradient-to-br from-charcoal-black/95 via-charcoal-black/80 to-void-black/95
            border border-white/5 hover:border-white/20
            ${
              isHovered
                ? "shadow-2xl shadow-accent-orange/20"
                : "shadow-lg shadow-black/30"
            }
          `}
          style={{
            minHeight: sizeVariant === "large" ? "320px" : "160px",
          }}
        >
          {/* Background image */}
          {playlist.imageUrl && (
            <div className="absolute inset-0">
              <Image
                src={playlist.imageUrl}
                alt={playlist.name}
                fill
                className={`object-cover transition-all duration-500 ${
                  isHovered ? "scale-110 opacity-40" : "opacity-25"
                }`}
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-void-black via-void-black/80 to-transparent" />
            </div>
          )}

          {/* Noise texture */}
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Hover glow */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{ opacity: isHovered ? 0.2 : 0 }}
            style={{
              background:
                "radial-gradient(circle at 50% 50%, rgba(255, 107, 61, 0.5), transparent 70%)",
            }}
          />

          {/* Content */}
          <div className="relative z-10 h-full flex flex-col justify-end p-4 md:p-6">
            {/* Track count badge */}
            <motion.span
              className="absolute top-4 right-4 text-xs px-2 py-1 rounded-full bg-white/10 text-gray-400 border border-white/10"
              animate={isHovered ? { scale: 1.1 } : {}}
            >
              {playlist.trackCount} tracks
            </motion.span>

            <h3
              className={`font-bold text-white mb-2 leading-tight transition-colors duration-300 ${
                isHovered ? "text-accent-orange" : ""
              } ${
                sizeVariant === "large"
                  ? "text-2xl md:text-3xl"
                  : "text-lg md:text-xl"
              }`}
            >
              {playlist.name}
            </h3>

            {playlist.description && sizeVariant !== "small" && (
              <p className="text-gray-400 text-sm line-clamp-2 mb-3">
                {playlist.description}
              </p>
            )}

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>by {playlist.owner}</span>
              <motion.div
                className="p-1.5 rounded-full bg-white/5"
                whileHover={{ scale: 1.2, rotate: 10 }}
              >
                <svg
                  className="w-4 h-4 text-accent-orange"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
              </motion.div>
            </div>
          </div>

          {/* Border glow on hover */}
          <motion.div
            className="absolute inset-0 pointer-events-none rounded-inherit"
            animate={{ opacity: isHovered ? 0.6 : 0 }}
            style={{
              boxShadow: "inset 0 0 0 2px rgba(255, 107, 61, 0.5)",
              borderRadius: "inherit",
            }}
          />
        </div>
      </a>
    </motion.div>
  );
}

export default function MusicPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const [selectedTab, setSelectedTab] = useState<
    "recent" | "top" | "playlists"
  >("recent");

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

  const tabs = [
    {
      id: "recent" as const,
      label: "Recently Played",
      count: recentlyPlayed?.tracks.length || 0,
    },
    {
      id: "top" as const,
      label: "Top Tracks",
      count: topTracks?.tracks.length || 0,
    },
    {
      id: "playlists" as const,
      label: "Playlists",
      count: playlists?.playlists.length || 0,
    },
  ];

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black page-reveal overflow-hidden"
    >
      {/* Background elements */}
      <div className="fixed inset-0 pointer-events-none">
        <FloatingShapes />
        <ScatteredElements />
      </div>

      {/* Gradient orbs */}
      <div className="fixed top-20 left-0 w-64 md:w-96 h-64 md:h-96 bg-accent-orange/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-20 right-0 w-64 md:w-96 h-64 md:h-96 bg-accent-purple/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent-orange/3 rounded-full blur-3xl pointer-events-none" />

      <main className="relative z-10 min-h-screen">
        <Navigation />

        {/* Hero Section */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="pt-20 pb-8 md:pt-32 md:pb-12"
        >
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            {/* Title */}
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
                  backgroundImage:
                    "linear-gradient(90deg, #fff, #ff6b3d, #7c77c6, #fff)",
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
                mouseX={mouseX}
                mouseY={mouseY}
              />
            )}

            {/* Tabs */}
            <ChaoticTabs
              tabs={tabs}
              selectedTab={selectedTab}
              onSelect={(id) =>
                setSelectedTab(id as "recent" | "top" | "playlists")
              }
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
                      🎵
                    </motion.div>
                    <p className="text-gray-500">
                      No recently played tracks found.
                    </p>
                  </motion.div>
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
                    isTopTrack={true}
                    mouseX={mouseX}
                    mouseY={mouseY}
                  />
                ))}
                {(!topTracks || topTracks.tracks.length === 0) && (
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
                      🏆
                    </motion.div>
                    <p className="text-gray-500">No top tracks found.</p>
                  </motion.div>
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
                  <motion.div
                    className="col-span-full text-center py-16"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <motion.div
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-6xl mb-4"
                    >
                      📀
                    </motion.div>
                    <p className="text-gray-500">No playlists found.</p>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
