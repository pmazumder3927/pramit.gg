"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNowPlayingContext } from "./NowPlayingContext";
import { useListenAlong } from "./useListenAlong";

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
  const listenAlong = useListenAlong(track);

  // Advance the playhead locally between polls so the elapsed time ticks up
  // every second instead of freezing until the next fetch. Each poll re-seeds
  // the baseline, keeping it honest.
  const [tick, setTick] = useState(0);
  const baseRef = useRef({ progress: 0, at: 0 });
  const seed = track?.progress ?? null;
  const trackKey = track?.title ?? null;
  useEffect(() => {
    baseRef.current = { progress: seed ?? 0, at: Date.now() };
    setTick(Date.now());
  }, [seed, trackKey]);
  // the echo: nothing is playing, but the last song is replaying on a loop in
  // the scape (anchored to playedAtMs) — the pill keeps time with it.
  const echoing =
    !!track && !track.isPlaying && !!track.playedAtMs && !!track.duration;
  useEffect(() => {
    if (!track?.isPlaying && !echoing) return;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [track?.isPlaying, echoing]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setExpanded(false);
    }
    if (expanded) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [expanded]);

  // homepage and /music both show their own now-playing UI, so the floating
  // pill would just duplicate it there; nothing to show without a track either.
  // the writing room keeps its desk clear too.
  if (
    pathname === "/" ||
    pathname.startsWith("/music") ||
    pathname.startsWith("/write") ||
    !track
  )
    return null;

  const onAlbum = onColor(albumColor);
  const elapsed = track.isPlaying ? tick - baseRef.current.at : 0;
  const dur = track.duration ?? 0;
  // echo progress loops on the client clock — second-granularity is plenty
  // here; only the lyric pen needs the carefully skew-corrected playhead.
  const liveProgress = track.isPlaying
    ? dur
      ? Math.min(dur, baseRef.current.progress + Math.max(0, elapsed))
      : track.progress ?? 0
    : echoing
      ? (((tick - (track.playedAtMs ?? 0)) % dur) + dur) % dur
      : track.progress ?? 0;
  const pct = dur ? (liveProgress / dur) * 100 : 0;
  // When listen-along is the primary CTA, the spotify link steps back to a
  // quiet secondary so two filled accent pills don't fight each other.
  const showListenAlong = track.isPlaying && !!track.uri;

  return (
    <motion.div
      ref={ref}
      data-avoid-lyrics
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
                  {track.isPlaying ? "now spinning" : echoing ? "last spun — still echoing" : "last spun"}
                </div>
                <div className="truncate font-serif text-base font-medium leading-tight text-ink">{track.title}</div>
                <div className="truncate text-sm text-ink-soft">{track.artist}</div>
                <div className="truncate font-serif text-xs italic text-ink-faint">{track.album}</div>
              </div>
            </div>

            {(track.isPlaying && track.progress != null && dur > 0) || echoing ? (
              <div className="px-4 pb-2">
                <div className="relative h-1.5 overflow-hidden rounded-full bg-paper-2">
                  {/* the echo's bar runs fainter — it's a memory keeping time */}
                  <div
                    className="absolute left-0 top-0 h-full rounded-full transition-[width] duration-1000 ease-linear"
                    style={{ width: `${pct}%`, background: albumColor, opacity: echoing ? 0.5 : 1 }}
                  />
                </div>
                <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-faint">
                  <span>{formatTime(liveProgress)}</span>
                  <span>{formatTime(dur)}</span>
                </div>
              </div>
            ) : null}

            {/* listen along — true sync for Premium listeners, with a
                deep-link fallback ("open in spotify") below for everyone else */}
            {showListenAlong && (
              <div className="px-4 pb-1">
                {listenAlong.status === "live" ? (
                  <div className="flex items-center gap-2">
                    <span
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest"
                      style={{ background: albumColor, color: onAlbum }}
                    >
                      <span className="relative flex h-1.5 w-1.5">
                        <span
                          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                          style={{ background: onAlbum }}
                        />
                        <span
                          className="relative inline-flex h-1.5 w-1.5 rounded-full"
                          style={{ background: onAlbum }}
                        />
                      </span>
                      listening along
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        listenAlong.stop();
                      }}
                      className="rounded-full border-2 border-line px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-ink-soft transition-colors hover:border-ink hover:text-ink"
                    >
                      leave
                    </button>
                  </div>
                ) : listenAlong.status === "premium_required" ? (
                  <p className="text-center font-mono text-[10px] uppercase tracking-widest text-ink-faint">
                    spotify premium needed to sync — open below instead
                  </p>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      listenAlong.start();
                    }}
                    disabled={listenAlong.status === "connecting"}
                    className="flex w-full items-center justify-center gap-1.5 rounded-full border-2 border-ink px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
                    style={{ background: albumColor, color: onAlbum }}
                  >
                    {listenAlong.status === "connecting"
                      ? "syncing…"
                      : listenAlong.connected
                        ? "listen along"
                        : "listen along with me"}
                  </button>
                )}
                {listenAlong.error && (
                  <p className="mt-1 text-center font-mono text-[10px] text-ink-faint">
                    {listenAlong.error}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2 p-4 pt-2">
              {track.songUrl && (
                <a
                  href={track.songUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border-2 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest transition-transform hover:-translate-y-0.5 ${
                    showListenAlong
                      ? "border-line text-ink-soft hover:border-ink hover:text-ink"
                      : "border-ink"
                  }`}
                  style={showListenAlong ? undefined : { background: albumColor, color: onAlbum }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 flex-none" aria-hidden>
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.84-.18-.96-.6-.122-.418.18-.84.6-.96 4.561-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.481.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.56.3z" />
                  </svg>
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
            ) : echoing ? (
              // a soft ripple instead of the eq bars — the song still sounding,
              // faintly, from the next room
              <span className="relative flex h-1.5 w-1.5">
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50"
                  style={{ background: albumColor }}
                />
                <span
                  className="relative inline-flex h-1.5 w-1.5 rounded-full opacity-70"
                  style={{ background: albumColor }}
                />
              </span>
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-ink-faint" />
            )}
            <span className="font-hand text-sm leading-none" style={{ color: albumColor }}>
              {track.isPlaying ? "now spinning" : echoing ? "last spun · echoing" : "last spun"}
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
