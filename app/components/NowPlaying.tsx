"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNowPlayingContext } from "./NowPlayingContext";

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function onColor(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || "");
  if (!m) return "#fffaf2";
  const n = parseInt(m[1], 16);
  const b = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
  return b > 145 ? "#1a1410" : "#fffaf2";
}

export default function NowPlaying() {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { track, albumColor } = useNowPlayingContext();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setExpanded(false);
    }
    if (expanded) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [expanded]);

  // homepage shows its own "now spinning" card; nothing to show without a track
  if (pathname === "/" || !track) return null;

  const onAlbum = onColor(albumColor);
  const pct =
    track.progress && track.duration ? (track.progress / track.duration) * 100 : 0;

  return (
    <motion.div
      ref={ref}
      className="fixed bottom-5 left-5 z-50 hidden md:block"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      {/* glow when playing, tinted to album */}
      {track.isPlaying && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-3 rounded-3xl"
          style={{ background: `radial-gradient(circle at 30% 50%, ${albumColor}22, transparent 70%)` }}
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.34, 1.4, 0.64, 1] }}
            className="absolute bottom-full left-0 mb-3 w-72 overflow-hidden rounded-2xl border border-line bg-card shadow-paper-lg"
            style={{ borderTop: `3px solid ${albumColor}` }}
          >
            <div className="flex gap-3 p-4">
              {track.albumImageUrl && (
                <div className="relative h-20 w-20 flex-none overflow-hidden rounded-lg border border-ink/15" style={{ boxShadow: `3px 3px 0 0 ${albumColor}` }}>
                  <Image src={track.albumImageUrl} alt={track.album} fill className="object-cover" sizes="80px" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 font-hand text-base leading-none" style={{ color: albumColor }}>
                  {track.isPlaying ? "now spinning" : "last spun"}
                </div>
                <div className="truncate font-serif text-base font-medium leading-tight text-ink">{track.title}</div>
                <div className="truncate text-sm text-ink-soft">{track.artist}</div>
                <div className="truncate font-serif text-xs italic text-ink-faint">{track.album}</div>
              </div>
            </div>

            {track.isPlaying && track.progress != null && track.duration != null ? (
              <div className="px-4 pb-2">
                <div className="relative h-1.5 overflow-hidden rounded-full bg-paper-2">
                  <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${pct}%`, background: albumColor }} />
                </div>
                <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-faint">
                  <span>{formatTime(track.progress)}</span>
                  <span>{formatTime(track.duration)}</span>
                </div>
              </div>
            ) : null}

            <div className="flex gap-2 p-4 pt-2">
              {track.songUrl && (
                <a
                  href={track.songUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full border-2 border-ink px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest transition-transform hover:-translate-y-0.5"
                  style={{ background: albumColor, color: onAlbum }}
                >
                  spotify
                </a>
              )}
              <Link
                href="/music"
                onClick={() => setExpanded(false)}
                className="flex flex-1 items-center justify-center gap-1 rounded-full border-2 border-line px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-ink-soft transition-colors hover:border-ink hover:text-ink"
              >
                the deck →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* collapsed pill */}
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-label="Now playing"
        className="relative flex w-64 items-center gap-3 overflow-hidden rounded-xl border border-line bg-card/95 py-2.5 pl-3 pr-3 text-left shadow-paper backdrop-blur-md transition-transform hover:-translate-y-0.5"
      >
        {/* album-color spine */}
        <span aria-hidden className="absolute left-0 top-0 h-full w-[3px]" style={{ background: albumColor }} />
        {track.albumImageUrl && (
          <div className="relative h-10 w-10 flex-none overflow-hidden rounded-md border border-ink/15">
            <Image src={track.albumImageUrl} alt="" fill className="object-cover" sizes="40px" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {track.isPlaying ? (
              <span className="eq-bars">
                <span className="h-1.5" style={{ background: albumColor, animationDelay: "0s" }} />
                <span className="h-2.5" style={{ background: albumColor, animationDelay: ".18s" }} />
                <span className="h-2" style={{ background: albumColor, animationDelay: ".36s" }} />
              </span>
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-ink-faint" />
            )}
            <span className="font-hand text-sm leading-none" style={{ color: albumColor }}>
              {track.isPlaying ? "now spinning" : "last spun"}
            </span>
          </div>
          <div className="mt-0.5 truncate font-serif text-sm font-medium leading-tight text-ink">{track.title}</div>
          <div className="truncate text-xs text-ink-faint">{track.artist}</div>
        </div>
        <svg
          className="h-4 w-4 flex-none text-ink-faint transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "none" }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>
    </motion.div>
  );
}
