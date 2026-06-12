"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import Image from "next/image";
import { hexToRgb, adjustBrightness } from "../lib/chaotic-styles";
import { Doodle } from "@/app/components/sketchbook";

interface NowPlayingTrack {
  isPlaying: boolean;
  title: string;
  artist: string;
  album: string;
  albumImageUrl: string | null;
  songUrl: string | null;
  progress?: number;
  duration?: number;
  /** epoch ms the track was last played — anchor of the echo replay loop */
  playedAtMs?: number | null;
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

// a 12-point pop-art starburst
const BURST = Array.from({ length: 24 }, (_, i) => {
  const a = (Math.PI / 12) * i - Math.PI / 2;
  const r = i % 2 === 0 ? 48 : 31;
  return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
}).join(" ");

export function ChaoticNowPlaying({
  nowPlaying,
  accentColor,
  mouseX,
  mouseY,
}: ChaoticNowPlayingProps) {
  const x = useTransform(mouseX, [0, 1], [-12, 12]);
  const y = useTransform(mouseY, [0, 1], [-8, 8]);
  const springX = useSpring(x, { stiffness: 100, damping: 20 });
  const springY = useSpring(y, { stiffness: 100, damping: 20 });

  const rgb = hexToRgb(accentColor);
  const lighterColor = adjustBrightness(accentColor, 22);
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  const onAlbum = brightness > 145 ? "#1a1410" : "#fffaf2";

  // nothing spinning, but the song is still ECHOING — replaying on a loop in
  // the scape, anchored to when it was last played. Keep time with it here.
  const dur = nowPlaying.duration ?? 0;
  const echoing = !nowPlaying.isPlaying && !!nowPlaying.playedAtMs && dur > 0;
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!echoing) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [echoing]);
  const echoProgress =
    echoing && now ? (((now - (nowPlaying.playedAtMs ?? 0)) % dur) + dur) % dur : 0;

  const pct = nowPlaying.isPlaying
    ? nowPlaying.progress && dur
      ? (nowPlaying.progress / dur) * 100
      : 0
    : echoing && dur
      ? (echoProgress / dur) * 100
      : 0;

  return (
    <motion.div
      data-avoid-lyrics
      initial={{ opacity: 0, y: 26, rotate: -1.2 }}
      animate={{ opacity: 1, y: 0, rotate: -0.5 }}
      transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
      style={{ x: springX, y: springY }}
      className="relative mx-auto mb-16 max-w-3xl md:mb-24"
    >
      {/* pop-art starburst badge — the single status label */}
      <div className="absolute right-1 -top-7 z-30 h-[4.5rem] w-[4.5rem] rotate-6 md:-right-8 md:-top-10 md:h-28 md:w-28">
        <svg viewBox="-50 -50 100 100" className="h-full w-full" style={{ filter: "drop-shadow(2px 3px 0 rgb(var(--fg) / 0.5))" }}>
          <polygon points={BURST} fill={accentColor} stroke="rgb(var(--fg))" strokeWidth="2.5" strokeLinejoin="round" />
        </svg>
        {/* label is held to the burst's inner circle so it never hits a spike */}
        <span className="absolute inset-0 grid place-items-center">
          <span
            className="block w-[56%] -rotate-3 text-center font-mono text-[0.58rem] font-extrabold uppercase leading-[1.05] tracking-tight md:text-[0.72rem]"
            style={{ color: onAlbum }}
          >
            {nowPlaying.isPlaying ? "now playing" : echoing ? "echoing" : "last played"}
          </span>
        </span>
      </div>

      {/* the comic panel — hard offset shadow in the album's color */}
      <div
        className="relative overflow-hidden rounded-[4px] border-[3px] border-ink bg-card px-6 py-7 md:px-10 md:py-9"
        style={{ boxShadow: `9px 9px 0 0 rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.95)` }}
      >
        {/* ben-day halftone dots, tinted to the album */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage: `radial-gradient(rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1) 1.5px, transparent 1.7px)`,
            backgroundSize: "9px 9px",
          }}
        />
        {/* album-tinted corner wash */}
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-2xl"
          style={{ background: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)` }}
        />

        <div className="relative z-10 flex flex-col items-center gap-7 md:flex-row md:items-center md:gap-10">
          {/* Album art — popped, thick frame, hard album-color shadow */}
          <div className="relative shrink-0 -rotate-2">
            {nowPlaying.albumImageUrl && (
              <motion.div
                className="relative border-[3px] border-ink bg-paper"
                style={{ boxShadow: `6px 6px 0 0 rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.9)` }}
                whileHover={{ scale: 1.04, rotate: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="relative h-40 w-40 overflow-hidden md:h-48 md:w-48">
                  <Image
                    src={nowPlaying.albumImageUrl}
                    alt={nowPlaying.album}
                    fill
                    className="object-cover"
                    style={{ filter: "saturate(1.35) contrast(1.08)" }}
                    sizes="(max-width: 768px) 160px, 192px"
                  />
                  {/* halftone over the art for that printed-comic feel */}
                  <div
                    className="pointer-events-none absolute inset-0 mix-blend-multiply opacity-30"
                    style={{
                      backgroundImage: "radial-gradient(rgba(0,0,0,0.5) 1px, transparent 1.2px)",
                      backgroundSize: "5px 5px",
                    }}
                  />
                </div>
              </motion.div>
            )}
          </div>

          {/* Track info */}
          <div className="flex flex-1 flex-col text-center md:text-left">
            {nowPlaying.isPlaying && (
              <div className="mb-3 flex justify-center md:justify-start">
                <span className="eq-bars" aria-label="now playing">
                  <span style={{ animationDelay: "0s", background: accentColor }} />
                  <span style={{ animationDelay: "0.2s", background: accentColor }} />
                  <span style={{ animationDelay: "0.4s", background: accentColor }} />
                  <span style={{ animationDelay: "0.15s", background: accentColor }} />
                </span>
              </div>
            )}

            <motion.h2
              className="font-serif text-3xl font-semibold leading-[0.98] tracking-tight text-ink md:text-[2.7rem]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {nowPlaying.title}
            </motion.h2>

            <motion.p
              className="mt-1.5 font-serif text-lg italic text-ink-soft md:text-xl"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {nowPlaying.artist}
            </motion.p>

            <motion.p
              className="mt-0.5 font-mono text-xs uppercase tracking-[0.14em] text-ink-faint"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              {nowPlaying.album}
            </motion.p>

            {/* Progress — live playback, or the echo keeping time on its loop */}
            {(nowPlaying.isPlaying && nowPlaying.progress != null && dur > 0) || echoing ? (
              <div className="mt-5 space-y-1.5">
                <div className="relative h-2.5 overflow-hidden rounded-full border-2 border-ink bg-paper-2">
                  <motion.div
                    className="absolute left-0 top-0 h-full"
                    style={{
                      background: `linear-gradient(90deg, ${accentColor}, ${lighterColor})`,
                      opacity: echoing ? 0.55 : 1,
                    }}
                    initial={{ width: "0%" }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <div className="flex justify-between font-mono text-xs text-ink-faint">
                  <span>{formatTime(echoing ? echoProgress : nowPlaying.progress ?? 0)}</span>
                  {echoing && (
                    <span className="font-serif normal-case italic tracking-normal">
                      still echoing through the page
                    </span>
                  )}
                  <span>{formatTime(dur)}</span>
                </div>
              </div>
            ) : null}

            {/* Open in Spotify — pop button in the album color */}
            {nowPlaying.songUrl && (
              <div className="mt-6 flex justify-center md:justify-start">
                <a
                  href={nowPlaying.songUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/btn inline-flex items-center gap-2 rounded-full border-[2.5px] border-ink px-5 py-2 font-mono text-xs font-bold uppercase tracking-widest transition-transform hover:-translate-y-0.5"
                  style={{ background: accentColor, color: onAlbum, boxShadow: "3px 3px 0 0 rgb(var(--fg))" }}
                >
                  <svg className="h-4 w-4 transition-transform group-hover/btn:rotate-12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
                  </svg>
                  open in spotify
                </a>
              </div>
            )}
          </div>
        </div>

        <Doodle name="squiggle" tone="rust" className="absolute -bottom-3 right-8 h-4 w-24 opacity-70" strokeWidth={2.5} />
      </div>
    </motion.div>
  );
}
