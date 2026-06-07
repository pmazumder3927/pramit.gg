"use client";

import { memo, useState, useMemo } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import {
  generateChaoticStyle,
  hexToRgb,
} from "../lib/chaotic-styles";
import { useAlbumColor } from "../lib/use-album-color";
import { chaosFor, paperTextureStyle } from "@/app/lib/chaos";

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
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function ChaoticTrackCardImpl({
  track,
  index,
  isTopTrack = false,
}: ChaoticTrackCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const style = useMemo(() => generateChaoticStyle(index), [index]);
  const albumColor = useAlbumColor(track.albumImageUrl);
  const rgb = hexToRgb(albumColor);

  // a liner-note tracklist row — every row is numbered, slightly rotated, on paper
  const num = (index + 1).toString().padStart(2, "0");
  const baseRot = style.rotation * 0.4;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotate: style.rotation }}
      animate={{
        opacity: 1,
        y: 0,
        rotate: baseRot,
        x: style.offsetX * 0.12,
      }}
      transition={{
        delay: Math.min(index * 0.03, 0.3),
        duration: 0.4,
        ease: [0.34, 1.56, 0.64, 1],
      }}
      style={{ zIndex: isHovered ? 50 : 1 }}
      whileHover={{ scale: 1.02, rotate: 0, zIndex: 50 }}
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
          className="relative overflow-hidden rounded-[3px] border border-line bg-card px-3 py-3 pl-4 transition-all duration-300 md:px-5 md:py-4 md:pl-6"
          style={{
            ...paperTextureStyle(chaosFor(track.id).paper),
            boxShadow: isHovered
              ? "5px 11px 26px -10px rgb(var(--fg) / 0.34)"
              : "2px 4px 12px -7px rgb(var(--fg) / 0.28)",
          }}
        >
          {/* at-rest album-color spine — each song wears its own art */}
          <span aria-hidden className="absolute left-0 top-0 z-10 h-full w-[3px]" style={{ background: albumColor }} />
          {/* hover wash in album tint */}
          <motion.div
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 0.12 : 0 }}
            style={{
              background: `radial-gradient(circle at 0% 50%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5), transparent 60%)`,
            }}
          />

          <div className="relative z-10 flex items-center gap-3 md:gap-4">
            {/* track number — handwritten liner-note index */}
            <div
              className={`w-7 flex-shrink-0 text-center font-hand leading-none md:w-9 ${
                isTopTrack ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl"
              }`}
              style={{
                color:
                  isHovered || (isTopTrack && index < 3)
                    ? albumColor
                    : "rgb(var(--fg-faint))",
                transform: `rotate(${index % 2 === 0 ? -4 : 3}deg)`,
              }}
            >
              {isTopTrack ? index + 1 : num}
            </div>

            {/* Album art — small taped stub */}
            {track.albumImageUrl && (
              <motion.div
                className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-[2px] border border-line md:h-14 md:w-14"
                whileHover={{ scale: 1.08, rotate: 4 }}
              >
                <Image
                  src={track.albumImageUrl}
                  alt={track.album}
                  fill
                  className="object-cover"
                  sizes="56px"
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

            {/* Track info */}
            <div className="min-w-0 flex-1">
              <h3
                className="mb-0.5 truncate font-serif text-base font-medium text-ink transition-colors duration-300 md:text-lg"
                style={{ color: isHovered ? albumColor : undefined }}
              >
                {track.title}
              </h3>
              <p className="truncate font-serif text-sm italic text-ink-soft">
                {track.artist}
              </p>
            </div>

            {/* dotted leader to metadata, like a tracklist */}
            <span
              aria-hidden
              className="hidden flex-1 self-end border-b border-dotted border-line/70 pb-1 lg:block"
            />

            {/* Metadata */}
            <div className="flex flex-shrink-0 flex-col items-end gap-0.5 text-xs text-ink-faint">
              {track.duration ? (
                <span className="font-mono">{formatTime(track.duration)}</span>
              ) : null}
              {track.playedAt && (
                <span className="hidden font-hand text-sm md:block">
                  {formatDistanceToNow(new Date(track.playedAt), {
                    addSuffix: true,
                  })}
                </span>
              )}
              {track.popularity && !track.playedAt && (
                <div className="flex items-center gap-1">
                  <svg
                    className="h-3 w-3"
                    style={{ color: albumColor }}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="font-mono">{track.popularity}</span>
                </div>
              )}
            </div>

            {/* Spotify icon */}
            <motion.div
              className="flex-shrink-0 rounded-full bg-ink/[0.05] p-1.5 opacity-0 transition-opacity group-hover:opacity-100"
              whileHover={{ scale: 1.2, rotate: 10 }}
            >
              <svg
                className="h-4 w-4"
                style={{ color: albumColor }}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
            </motion.div>
          </div>

          {/* accent underline on hover */}
          <motion.div
            className="absolute bottom-0 left-0 h-[3px]"
            style={{
              background: `linear-gradient(90deg, ${albumColor}, rgb(var(--accent-purple) / 0.8))`,
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

// Memoized: track/playlist data only changes every 60–600s, so this skips the
// reconcile when the page re-renders on the 5s now-playing tick or a tab switch.
export const ChaoticTrackCard = memo(ChaoticTrackCardImpl);
