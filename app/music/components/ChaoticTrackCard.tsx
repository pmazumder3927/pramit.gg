"use client";

import { memo, useState, useMemo } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { hexToRgb } from "../lib/chaotic-styles";
import { useAlbumColor } from "../lib/use-album-color";
import { chaosFor, paperTextureStyle, range, chance, pick } from "@/app/lib/chaos";
import { Tape } from "@/app/components/sketchbook";

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
  repeatCount?: number;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

// theme tokens (flip light/dark for free)
const INK = "rgb(var(--fg))";
const PAPER = "rgb(var(--bg))";
const CARD = "rgb(var(--surface))";
const LINE = "rgb(var(--line))";
const SUB = "rgb(var(--fg-soft))";
const FAINT = "rgb(var(--fg-faint))";
const SOFT_REST = "2px 4px 12px -7px rgb(var(--fg) / 0.28)";
const SOFT_HOVER = "5px 11px 26px -10px rgb(var(--fg) / 0.34)";

// legible ink/cream for text sitting directly on an album-colored surface
function onColor(hex: string): "#1b1610" | "#fbf6ea" {
  const { r, g, b } = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#1b1610" : "#fbf6ea";
}

type Skin = {
  kind: "wash" | "invert" | "brutalist" | "tint" | "notebook" | "plain";
  bg: string;
  bgImage?: string;
  borderClass: string;
  borderColor: string;
  text: string;
  sub: string;
  faint: string;
  shadowRest: string;
  shadowHover: string;
  spine: boolean; // show the album-color left bar
  hoverAccent: string;
  artBorder: string;
  texture: boolean;
};

// Each SONG gets a stable, distinct "row skin" — this is where the variety
// lives. Seeded by the track id so a given song always wears the same look.
function getTrackSkin(seed: string, albumColor: string): Skin {
  const roll = range(seed, 0, 1, 11);
  const rgb = hexToRgb(albumColor);
  const on = onColor(albumColor);
  const isDarkOn = on === "#1b1610";
  const onSub = isDarkOn ? "rgba(27,22,16,0.74)" : "rgba(251,246,234,0.80)";
  const onFaint = isDarkOn ? "rgba(27,22,16,0.55)" : "rgba(251,246,234,0.6)";

  // album-color wash — the whole row wears the song's color (the boldest skin)
  if (roll < 0.17) {
    return {
      kind: "wash", bg: albumColor, borderClass: "border-2",
      borderColor: "rgba(0,0,0,0.22)", text: on, sub: onSub, faint: onFaint,
      shadowRest: "4px 4px 0 0 rgb(var(--fg) / 0.8)",
      shadowHover: "7px 7px 0 0 rgb(var(--fg))",
      spine: false, hoverAccent: on, artBorder: "rgba(0,0,0,0.3)", texture: false,
    };
  }
  // invert slab — dark-on-light / light-on-dark contrast pop in either theme
  if (roll < 0.31) {
    return {
      kind: "invert", bg: INK, borderClass: "border", borderColor: INK,
      text: PAPER, sub: "rgb(var(--bg) / 0.78)", faint: "rgb(var(--bg) / 0.55)",
      shadowRest: "3px 6px 18px -8px rgb(var(--fg) / 0.5)",
      shadowHover: "5px 11px 26px -10px rgb(var(--fg) / 0.6)",
      spine: true, hoverAccent: albumColor, artBorder: "rgba(255,255,255,0.2)",
      texture: false,
    };
  }
  // brutalist — card surface with a hard offset shadow in the album color
  if (roll < 0.47) {
    return {
      kind: "brutalist", bg: CARD, borderClass: "border-2", borderColor: INK,
      text: INK, sub: SUB, faint: FAINT,
      shadowRest: `4px 4px 0 0 ${albumColor}`,
      shadowHover: `7px 7px 0 0 ${albumColor}`,
      spine: false, hoverAccent: albumColor, artBorder: LINE, texture: true,
    };
  }
  // tint — warm card with a strong diagonal album-color wash
  if (roll < 0.65) {
    return {
      kind: "tint", bg: CARD,
      bgImage: `linear-gradient(115deg, rgba(${rgb.r},${rgb.g},${rgb.b},0.24), transparent 60%, rgb(var(--accent-purple) / 0.10))`,
      borderClass: "border", borderColor: LINE, text: INK, sub: SUB, faint: FAINT,
      shadowRest: SOFT_REST, shadowHover: SOFT_HOVER,
      // no paper texture here — its backgroundImage would clobber the gradient
      spine: true, hoverAccent: albumColor, artBorder: LINE, texture: false,
    };
  }
  // notebook — dashed, untextured-paper feel, no shadow
  if (roll < 0.79) {
    return {
      kind: "notebook", bg: "rgb(var(--surface-2) / 0.55)",
      borderClass: "border-2 border-dashed", borderColor: LINE,
      text: INK, sub: SUB, faint: FAINT, shadowRest: "", shadowHover: SOFT_HOVER,
      spine: true, hoverAccent: albumColor, artBorder: LINE, texture: true,
    };
  }
  // plain — the warm baseline card
  return {
    kind: "plain", bg: CARD, borderClass: "border", borderColor: LINE,
    text: INK, sub: SUB, faint: FAINT, shadowRest: SOFT_REST, shadowHover: SOFT_HOVER,
    spine: true, hoverAccent: albumColor, artBorder: LINE, texture: true,
  };
}

function ChaoticTrackCardImpl({
  track,
  index,
  isTopTrack = false,
  repeatCount = 1,
}: ChaoticTrackCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const albumColor = useAlbumColor(track.albumImageUrl);
  const rgb = hexToRgb(albumColor);

  // seed all variety off the song id so each track is consistent across reloads
  const seed = track.id || track.title;
  const skin = useMemo(() => getTrackSkin(seed, albumColor), [seed, albumColor]);

  // per-song structural variety: rotation, size, tape, number tilt
  const { rotate, big, tape, tapeTone, numTilt } = useMemo(() => {
    const ch = chaosFor(seed);
    return {
      rotate: range(seed, -1.4, 1.4, 20),
      big: chance(seed, 0.22, 21),
      tape: chance(seed, 0.26, 22),
      tapeTone: ch.tapeTone,
      numTilt: pick(seed, [-5, -3, 3, 4, -4], 23),
    };
  }, [seed]);

  const num = (index + 1).toString().padStart(2, "0");
  const artCls = big
    ? "h-16 w-16 md:h-[4.5rem] md:w-[4.5rem]"
    : "h-12 w-12 md:h-14 md:w-14";
  const titleCls = big ? "text-lg md:text-xl" : "text-base md:text-lg";
  const numColor =
    isHovered || (isTopTrack && index < 3) ? skin.hoverAccent : skin.faint;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotate }}
      animate={{ opacity: 1, y: 0, rotate }}
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
          className={`relative overflow-hidden rounded-[3px] px-3 py-3 pl-4 transition-all duration-300 md:px-5 md:py-4 md:pl-6 ${skin.borderClass}`}
          style={{
            backgroundColor: skin.bg,
            // exactly one of these sets backgroundImage (gradient OR texture),
            // never both — mixing them with `background` triggers React's
            // shorthand/longhand conflict warning.
            ...(skin.bgImage ? { backgroundImage: skin.bgImage } : {}),
            ...(skin.texture ? paperTextureStyle(chaosFor(seed).paper) : {}),
            borderColor: skin.borderColor,
            boxShadow: isHovered ? skin.shadowHover : skin.shadowRest,
          }}
        >
          {/* washi tape strip on a lucky few rows */}
          {tape && (
            <Tape
              tone={tapeTone}
              rotate={index % 2 === 0 ? -7 : 6}
              width={56}
              className="-top-2 right-8"
            />
          )}

          {/* album-color spine — each song wears its own art */}
          {skin.spine && (
            <span
              aria-hidden
              className="absolute left-0 top-0 z-10 h-full w-[3px]"
              style={{ background: albumColor }}
            />
          )}

          {/* hover wash in album tint (skip on wash/invert where it'd muddy) */}
          {skin.kind !== "wash" && skin.kind !== "invert" && (
            <motion.div
              className="pointer-events-none absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: isHovered ? 0.12 : 0 }}
              style={{
                background: `radial-gradient(circle at 0% 50%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5), transparent 60%)`,
              }}
            />
          )}

          <div className="relative z-10 flex items-center gap-3 md:gap-4">
            {/* track number — handwritten liner-note index */}
            <div
              className={`w-7 flex-shrink-0 text-center font-hand leading-none md:w-9 ${
                isTopTrack ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl"
              }`}
              style={{ color: numColor, transform: `rotate(${numTilt}deg)` }}
            >
              {isTopTrack ? index + 1 : num}
            </div>

            {/* Album art — small taped stub */}
            {track.albumImageUrl && (
              <motion.div
                className={`relative flex-shrink-0 overflow-hidden rounded-[2px] border ${artCls}`}
                style={{ borderColor: skin.artBorder }}
                whileHover={{ scale: 1.08, rotate: 4 }}
              >
                <Image
                  src={track.albumImageUrl}
                  alt={track.album}
                  fill
                  className="object-cover"
                  sizes="72px"
                />
                <motion.div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3), transparent)`,
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isHovered ? 1 : 0 }}
                />

                {/* ×N "on loop" sticker for collapsed repeats */}
                {repeatCount > 1 && (
                  <span
                    className="absolute -right-2 -top-2 z-30 inline-flex items-center rounded-full border-[1.5px] px-1.5 py-0.5 font-mono text-[0.6rem] font-bold leading-none"
                    style={{
                      transform: "rotate(-8deg)",
                      background: "rgb(var(--accent-orange))",
                      color: "#fbf6ea",
                      borderColor: "rgb(var(--fg))",
                      boxShadow: "1.5px 1.5px 0 0 rgb(var(--fg) / 0.55)",
                    }}
                    title={`played ${repeatCount}× in a row`}
                  >
                    ×{repeatCount}
                  </span>
                )}
              </motion.div>
            )}

            {/* Track info */}
            <div className="min-w-0 flex-1">
              <h3
                className={`mb-0.5 truncate font-serif font-medium transition-colors duration-300 ${titleCls}`}
                style={{ color: isHovered ? skin.hoverAccent : skin.text }}
              >
                {track.title}
              </h3>
              <p
                className="truncate font-serif text-sm italic"
                style={{ color: skin.sub }}
              >
                {track.artist}
              </p>
            </div>

            {/* dotted leader to metadata, like a tracklist */}
            <span
              aria-hidden
              className="hidden flex-1 self-end border-b border-dotted pb-1 lg:block"
              style={{ borderColor: skin.faint }}
            />

            {/* Metadata */}
            <div
              className="flex flex-shrink-0 flex-col items-end gap-0.5 text-xs"
              style={{ color: skin.faint }}
            >
              {track.duration ? (
                <span className="font-mono">{formatTime(track.duration)}</span>
              ) : null}
              {track.playedAt && (
                <span className="hidden font-hand text-sm md:block">
                  {repeatCount > 1 ? `looped ${repeatCount}×` : formatDistanceToNow(new Date(track.playedAt), { addSuffix: true })}
                </span>
              )}
              {track.popularity && !track.playedAt && (
                <div className="flex items-center gap-1">
                  <svg
                    className="h-3 w-3"
                    style={{ color: skin.hoverAccent }}
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
              className="flex-shrink-0 rounded-full p-1.5 opacity-70 transition-opacity md:opacity-0 md:group-hover:opacity-100"
              style={{ background: "rgb(var(--fg) / 0.05)" }}
              whileHover={{ scale: 1.2, rotate: 10 }}
            >
              <svg
                className="h-4 w-4"
                style={{ color: skin.hoverAccent }}
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
