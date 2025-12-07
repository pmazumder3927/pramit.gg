"use client";

import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import { useAlbumColor } from "@/app/lib/use-album-color";

export interface SpotifyTrack {
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

// Seeded random for consistent visuals
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return Math.round((x - Math.floor(x)) * 100) / 100;
}

type VisualVariant = "neon" | "glassy" | "minimal" | "accent";

function getVariantFromTrack(title: string): VisualVariant {
  const seed = title.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const roll = seededRandom(seed);
  if (roll > 0.75) return "neon";
  if (roll > 0.5) return "glassy";
  if (roll > 0.25) return "accent";
  return "minimal";
}

export function useNowPlaying() {
  const { data: track, error } = useSWR<SpotifyTrack>(
    "/api/spotify/now-playing",
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: false }
  );

  const albumColor = useAlbumColor(track?.albumImageUrl || null);
  const variant = track ? getVariantFromTrack(track.title) : "minimal";
  const hasTrack = !error && !!track;

  return { track: hasTrack ? track : null, albumColor, variant, hasTrack };
}

export function getVariantStyles(variant: VisualVariant, accentColor: string) {
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
}

interface AlbumArtProps {
  track: SpotifyTrack;
  accentColor: string;
  size?: "sm" | "md";
}

export function AlbumArt({ track, accentColor, size = "md" }: AlbumArtProps) {
  const sizeClasses = size === "sm" ? "w-11 h-11" : "w-11 h-11";
  const badgeSize = size === "sm" ? "w-4 h-4" : "w-4 h-4";

  return (
    <div className="relative flex-shrink-0">
      {track.albumImageUrl ? (
        <motion.div
          className={`relative ${sizeClasses} rounded-xl overflow-hidden`}
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
          className={`${sizeClasses} rounded-xl flex items-center justify-center`}
          style={{ backgroundColor: `${accentColor}15` }}
        >
          <svg className="w-5 h-5" style={{ color: accentColor }} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
        </div>
      )}

      {/* Playing indicator badge */}
      {track.isPlaying && (
        <motion.div
          className={`absolute -bottom-1 -right-1 ${badgeSize} rounded-full bg-green-500 border-2 border-void-black flex items-center justify-center overflow-hidden`}
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
  );
}

interface TrackInfoProps {
  track: SpotifyTrack;
  accentColor: string;
  compact?: boolean;
}

export function TrackInfo({ track, accentColor, compact = false }: TrackInfoProps) {
  return (
    <div className={`flex flex-col min-w-0 ${compact ? "max-w-[160px]" : ""}`}>
      <span
        className="text-[9px] uppercase tracking-widest font-medium"
        style={{ color: `${accentColor}99` }}
      >
        {track.isPlaying ? "Now Playing" : "Last Played"}
      </span>
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
    </div>
  );
}

interface NeonBordersProps {
  accentColor: string;
}

export function NeonBorders({ accentColor }: NeonBordersProps) {
  return (
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
  );
}

interface AccentStripeProps {
  accentColor: string;
}

export function AccentStripe({ accentColor }: AccentStripeProps) {
  return (
    <div
      className="absolute -right-8 -top-8 w-16 h-16 rotate-45 opacity-20"
      style={{ backgroundColor: accentColor }}
    />
  );
}

interface AmbientGlowProps {
  accentColor: string;
  position?: "left" | "center";
}

export function AmbientGlow({ accentColor, position = "center" }: AmbientGlowProps) {
  const positionClass = position === "left" ? "20% 50%" : "center";

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: `radial-gradient(circle at ${positionClass}, ${accentColor}15 0%, transparent 50%)`,
      }}
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

interface ScatteredElementsProps {
  accentColor: string;
}

export function ScatteredDots({ accentColor }: ScatteredElementsProps) {
  const altColor = accentColor === "#ff6b3d" ? "#7c77c6" : "#ff6b3d";

  return (
    <>
      <motion.div
        className="absolute -top-3 -right-2 w-2 h-2 rounded-full pointer-events-none"
        style={{ backgroundColor: accentColor }}
        animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.2, 1] }}
        transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
      />
      <motion.div
        className="absolute -bottom-2 -left-3 w-1.5 h-1.5 rounded-full pointer-events-none"
        style={{ backgroundColor: altColor }}
        animate={{ opacity: [0.15, 0.4, 0.15] }}
        transition={{ duration: 2.5, repeat: Infinity, delay: 1 }}
      />
    </>
  );
}

interface ProgressBarProps {
  track: SpotifyTrack;
  accentColor: string;
}

export function ProgressBar({ track, accentColor }: ProgressBarProps) {
  if (!track.progress || !track.duration) return null;

  const progressPercentage = (track.progress / track.duration) * 100;
  const altColor = accentColor === "#ff6b3d" ? "#7c77c6" : "#ff6b3d";

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5">
      <motion.div
        className="h-full rounded-full"
        style={{
          background: `linear-gradient(90deg, ${accentColor}, ${altColor})`
        }}
        initial={{ width: "0%" }}
        animate={{ width: `${progressPercentage}%` }}
        transition={{ duration: 0.5 }}
      />
    </div>
  );
}
