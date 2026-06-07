"use client";

import { useState, useMemo } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import { generateChaoticStyle, seededRandom, hexToRgb } from "../lib/chaotic-styles";
import { useAlbumColor } from "../lib/use-album-color";
import { Tape } from "@/app/components/sketchbook";
import { chaosFor, paperTextureStyle } from "@/app/lib/chaos";

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
}

const TAPE_TONES = ["orange", "purple", "rust"] as const;

export function ChaoticPlaylistCard({
  playlist,
  index,
}: ChaoticPlaylistCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const style = useMemo(() => generateChaoticStyle(index + 50), [index]);
  const albumColor = useAlbumColor(playlist.imageUrl);
  const rgb = hexToRgb(albumColor);

  // Size variants for the mixtape wall
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

  const tapeTone = TAPE_TONES[index % TAPE_TONES.length];
  const baseRot = style.rotation * 0.5;

  return (
    <motion.div
      className={`${sizeClasses[sizeVariant]} relative`}
      initial={{ opacity: 0, scale: 0.85, rotate: style.rotation }}
      animate={{
        opacity: 1,
        scale: 1,
        rotate: baseRot,
        x: style.offsetX * 0.2,
        y: style.offsetY * 0.2,
      }}
      transition={{
        delay: Math.min(index * 0.03, 0.3),
        duration: 0.4,
        ease: [0.34, 1.56, 0.64, 1],
      }}
      style={{ zIndex: isHovered ? 50 : 1 }}
      whileHover={{ scale: 1.04, rotate: 0, zIndex: 50 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <a
        href={playlist.playlistUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-full"
      >
        {/* the taped mixtape — photo paper frame */}
        <Tape
          tone={tapeTone}
          rotate={index % 2 === 0 ? -8 : 7}
          className={`left-1/2 -top-2 -translate-x-1/2 ${
            sizeVariant === "small" ? "!w-14" : "!w-20"
          }`}
        />
        <div
          className="relative flex h-full flex-col overflow-hidden rounded-[3px] border border-line bg-card p-2 transition-all duration-300"
          style={{
            ...paperTextureStyle(chaosFor(playlist.id).paper),
            minHeight: sizeVariant === "large" ? "320px" : "160px",
            boxShadow: isHovered
              ? `0 18px 40px -16px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`
              : "2px 5px 16px -7px rgb(var(--fg) / 0.30)",
          }}
        >
          {/* at-rest album-color edge — each mixtape wears its own art */}
          <span aria-hidden className="absolute inset-x-0 top-0 z-10 h-[3px]" style={{ background: albumColor }} />
          {/* artwork window */}
          <div className="relative flex-1 overflow-hidden rounded-[2px] border border-line/70 bg-paper-2">
            {playlist.imageUrl && (
              <Image
                src={playlist.imageUrl}
                alt={playlist.name}
                fill
                className={`object-cover transition-all duration-500 ${
                  isHovered ? "scale-105 opacity-95" : "opacity-90"
                }`}
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            )}
            {/* gradient so the corner label stays legible */}
            <div className="absolute inset-0 bg-gradient-to-t from-card/90 via-transparent to-transparent" />
            {/* track count — handwritten sticker */}
            <span className="absolute right-2 top-2 -rotate-3 rounded-full border border-line bg-paper/85 px-2 py-0.5 font-hand text-sm text-accent-purple backdrop-blur-sm">
              {playlist.trackCount} tracks
            </span>
            {/* hover glow */}
            <motion.div
              className="pointer-events-none absolute inset-0"
              animate={{ opacity: isHovered ? 0.2 : 0 }}
              style={{
                background: `radial-gradient(circle at 50% 50%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5), transparent 70%)`,
              }}
            />
          </div>

          {/* handwritten caption strip — like a cassette spine */}
          <div className="px-1 pt-2">
            <h3
              className={`font-hand leading-tight text-ink transition-colors duration-300 ${
                sizeVariant === "large" ? "text-2xl md:text-3xl" : "text-xl"
              } line-clamp-2`}
              style={{ color: isHovered ? albumColor : undefined }}
            >
              {playlist.name}
            </h3>

            {playlist.description && sizeVariant === "large" && (
              <p className="mt-1 line-clamp-2 font-serif text-sm italic text-ink-soft">
                {playlist.description}
              </p>
            )}

            <div className="mt-1 flex items-center justify-between text-xs text-ink-faint">
              <span className="font-mono uppercase tracking-[0.12em]">
                {playlist.owner}
              </span>
              <svg
                className="h-4 w-4 opacity-70"
                style={{ color: albumColor }}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
            </div>
          </div>
        </div>
      </a>
    </motion.div>
  );
}
