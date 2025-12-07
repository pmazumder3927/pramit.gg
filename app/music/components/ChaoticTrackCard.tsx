"use client";

import { useState, useMemo } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import {
  generateChaoticStyle,
  getVariantStyles,
  hexToRgb,
  isLightColor,
} from "../lib/chaotic-styles";
import { useAlbumColor } from "../lib/use-album-color";

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

interface ChaoticTrackCardProps {
  track: SpotifyTrack;
  index: number;
  isTopTrack?: boolean;
  mouseX: ReturnType<typeof useMotionValue<number>>;
  mouseY: ReturnType<typeof useMotionValue<number>>;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function ChaoticTrackCard({
  track,
  index,
  isTopTrack = false,
  mouseX,
  mouseY,
}: ChaoticTrackCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const style = useMemo(() => generateChaoticStyle(index), [index]);
  const albumColor = useAlbumColor(track.albumImageUrl);
  const rgb = hexToRgb(albumColor);

  const parallaxStrength = 8;
  const x = useTransform(mouseX, [0, 1], [-parallaxStrength, parallaxStrength]);
  const y = useTransform(mouseY, [0, 1], [-parallaxStrength, parallaxStrength]);
  const springX = useSpring(x, { stiffness: 150, damping: 20 });
  const springY = useSpring(y, { stiffness: 150, damping: 20 });

  const variantStyles = getVariantStyles(style.variant, albumColor);
  const isDark =
    !["brutalist", "inverted"].includes(style.variant) ||
    (style.variant === "brutalist" && !isLightColor(albumColor));
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
          `}
          style={{
            backgroundColor: variantStyles.bgColor,
            backgroundImage: variantStyles.bgGradient,
            borderColor: variantStyles.borderColor,
            boxShadow: isHovered
              ? variantStyles.hoverShadow
              : variantStyles.shadow,
          }}
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
              background: `radial-gradient(circle at 50% 50%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5), transparent 70%)`,
            }}
          />

          <div className="relative z-10 flex items-center gap-4">
            {/* Track Number */}
            {isTopTrack && (
              <motion.div
                className={`text-2xl md:text-3xl font-bold w-8 md:w-12 flex-shrink-0`}
                style={{ color: index < 3 ? albumColor : undefined }}
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
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3), transparent)`,
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isHovered ? 1 : 0 }}
                />
              </motion.div>
            )}

            {/* Track Info */}
            <div className="flex-1 min-w-0">
              <h3
                className={`font-semibold text-base md:text-lg truncate mb-1 transition-colors duration-300 ${textColor}`}
                style={{ color: isHovered && isDark ? albumColor : undefined }}
              >
                {track.title}
              </h3>
              <p
                className={`${secondaryColor} text-sm truncate mb-0.5`}
                style={{ color: variantStyles.textColor }}
              >
                {track.artist}
              </p>
              <p
                className={`text-xs truncate opacity-60 hidden md:block`}
                style={{ color: variantStyles.textColor || (isDark ? "#9ca3af" : "#4b5563") }}
              >
                {track.album}
              </p>
            </div>

            {/* Metadata */}
            <div
              className={`hidden md:flex flex-col items-end gap-1 text-xs ${secondaryColor}`}
              style={{ color: variantStyles.textColor }}
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
                    className="w-3 h-3"
                    style={{ color: albumColor }}
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
                className="w-5 h-5"
                style={{ color: albumColor }}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
            </motion.div>
          </div>

          {/* Accent line */}
          <motion.div
            className="absolute bottom-0 left-0 h-1"
            style={{
              background: `linear-gradient(90deg, ${albumColor}, rgba(124, 119, 198, 0.8))`,
            }}
            initial={{ width: "0%" }}
            animate={{ width: isHovered ? "100%" : "0%" }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </a>
    </motion.div>
  );
}
