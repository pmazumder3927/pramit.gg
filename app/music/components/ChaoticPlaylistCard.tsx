"use client";

import { useState, useMemo } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import Image from "next/image";
import { generateChaoticStyle, seededRandom, hexToRgb } from "../lib/chaotic-styles";
import { useAlbumColor } from "../lib/use-album-color";

interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  playlistUrl: string;
  trackCount: number;
  owner: string;
}

interface ChaoticPlaylistCardProps {
  playlist: SpotifyPlaylist;
  index: number;
  mouseX: ReturnType<typeof useMotionValue<number>>;
  mouseY: ReturnType<typeof useMotionValue<number>>;
}

export function ChaoticPlaylistCard({
  playlist,
  index,
  mouseX,
  mouseY,
}: ChaoticPlaylistCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const style = useMemo(() => generateChaoticStyle(index + 50), [index]);
  const albumColor = useAlbumColor(playlist.imageUrl);
  const rgb = hexToRgb(albumColor);

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
          className="relative h-full overflow-hidden transition-all duration-300 rounded-2xl md:rounded-3xl bg-gradient-to-br from-charcoal-black/95 via-charcoal-black/80 to-void-black/95 border border-white/5 hover:border-white/20"
          style={{
            minHeight: sizeVariant === "large" ? "320px" : "160px",
            boxShadow: isHovered
              ? `0 25px 50px -12px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`
              : "0 10px 40px -10px rgba(0, 0, 0, 0.3)",
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
              background: `radial-gradient(circle at 50% 50%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5), transparent 70%)`,
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
                sizeVariant === "large"
                  ? "text-2xl md:text-3xl"
                  : "text-lg md:text-xl"
              }`}
              style={{ color: isHovered ? albumColor : undefined }}
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
                  className="w-4 h-4"
                  style={{ color: albumColor }}
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
              boxShadow: `inset 0 0 0 2px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`,
              borderRadius: "inherit",
            }}
          />
        </div>
      </a>
    </motion.div>
  );
}
