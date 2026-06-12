"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Doodle, Tape, TornEdge } from "./sketchbook";
import { useNowPlayingContext } from "./NowPlayingContext";

type Tone = "rust" | "purple" | "orange";

const toneVar: Record<Tone, string> = {
  rust: "--accent-rust",
  purple: "--accent-purple",
  orange: "--accent-orange",
};

// Each tab carries a hand-drawn glyph (single path, stroked like the doodles,
// "inked in" with a wash of its accent when active) plus a Caveat label.
type Item = {
  href: string;
  label: string;
  tone: Tone;
  d: string;
  rotate: number;
};

const ITEMS: Item[] = [
  // pencil resting on a writing line
  { href: "/", label: "writing", tone: "rust", rotate: 0,
    d: "M6 26c0-1 1-4 2-5L20 8l4 4L11 24c-1 1-4 2-5 2z M18 10l4 4 M6.5 28.5h7" },
  // beamed pair of eighth notes
  { href: "/music", label: "sound", tone: "purple", rotate: 0,
    d: "M11 24a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M24 20a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M11 24V9l13-4v15" },
  // two overlapping snapshot frames
  { href: "/collage", label: "collage", tone: "orange", rotate: -4,
    d: "M6 9h12v12H6z M13 13h13v13H13z" },
  // paper aeroplane mid-flight
  { href: "/connect", label: "connect", tone: "rust", rotate: 0,
    d: "M28 5L4 14l8 4 3 9 4-6 9 5z M12 18l9-9" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Glyph({
  d,
  rotate,
  color,
  active,
}: {
  d: string;
  rotate: number;
  color: string;
  active: boolean;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 32 32"
      className="h-[26px] w-[26px] overflow-visible"
      fill="none"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <path
        d={d}
        stroke={color}
        strokeWidth={active ? 2.4 : 2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
        fillRule="evenodd"
        fill={active ? color : "none"}
        fillOpacity={active ? 0.18 : 0}
        style={{ transition: "stroke 0.25s, fill-opacity 0.25s" }}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// A little equalizer drawn as three ink bars — only dances while playing.
// ---------------------------------------------------------------------------
function Equalizer({ color, playing }: { color: string; playing: boolean }) {
  const reduce = useReducedMotion();
  const bars = [0, 1, 2];
  return (
    <span className="flex h-3 items-end gap-[2px]" aria-hidden>
      {bars.map((i) => (
        <motion.span
          key={i}
          className="w-[2px] rounded-full"
          style={{ background: color }}
          initial={{ height: 4 }}
          animate={
            playing && !reduce
              ? { height: [4, 11, 6, 12, 4] }
              : { height: 4 }
          }
          transition={
            playing && !reduce
              ? { duration: 1, repeat: Infinity, ease: "easeInOut", delay: i * 0.18 }
              : { duration: 0.2 }
          }
        />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Mobile now-playing banner — a paper ticket that rides on top of the tab bar.
// Hidden on / and /music (they show their own now-playing UI) and when idle.
// ---------------------------------------------------------------------------
function NowPlayingBanner() {
  const pathname = usePathname();
  const { track, albumColor } = useNowPlayingContext();
  // nothing playing, but the last song is still ECHOING — replaying on a loop
  // through the scape — so the ticket keeps its time too.
  const echoing =
    !!track && !track.isPlaying && !!track.playedAtMs && !!track.duration;

  // Advance the playhead locally between polls so the bar ticks each second.
  const [tick, setTick] = useState(0);
  const baseRef = useRef({ progress: 0, at: 0 });
  const seed = track?.progress ?? null;
  const trackKey = track?.title ?? null;
  useEffect(() => {
    baseRef.current = { progress: seed ?? 0, at: Date.now() };
    setTick(Date.now());
  }, [seed, trackKey]);
  useEffect(() => {
    if (!track?.isPlaying && !echoing) return;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [track?.isPlaying, echoing]);

  if (pathname === "/" || pathname.startsWith("/music") || !track) return null;

  const elapsed = track.isPlaying ? tick - baseRef.current.at : 0;
  const dur = track.duration ?? 0;
  // echo progress loops on the client clock — see app/lib/scape-playhead for
  // the carefully anchored version the lyric pen uses.
  const live = track.isPlaying
    ? dur
      ? Math.min(dur, baseRef.current.progress + Math.max(0, elapsed))
      : track.progress ?? 0
    : echoing
      ? (((tick - (track.playedAtMs ?? 0)) % dur) + dur) % dur
      : track.progress ?? 0;
  const pct = dur ? (live / dur) * 100 : 0;

  const Body = (
    <div className="relative flex items-center gap-3 px-4 pb-2 pt-2">
      {/* album cover, pinned down with a strip of washi tape */}
      <span className="relative flex-none">
        <Tape tone="purple" rotate={-8} width={30} className="-top-1.5 left-1 z-30" />
        <span
          className="block h-11 w-11 overflow-hidden rounded-[5px] border border-ink/15"
          style={{ boxShadow: `2px 2px 0 0 ${albumColor}` }}
        >
          {track.albumImageUrl ? (
            <Image
              src={track.albumImageUrl}
              alt={track.album}
              width={44}
              height={44}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-paper-2">
              <Doodle name="squiggle" tone="purple" className="h-5 w-7" strokeWidth={2.5} />
            </span>
          )}
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <Equalizer color={albumColor} playing={track.isPlaying} />
          <span className="font-hand text-[15px] leading-none" style={{ color: albumColor }}>
            {track.isPlaying ? "now spinning" : echoing ? "last spun · echoing" : "last spun"}
          </span>
        </span>
        <span className="mt-0.5 block truncate font-serif text-sm font-medium leading-tight text-ink">
          {track.title}
        </span>
        <span className="block truncate text-xs leading-tight text-ink-soft">{track.artist}</span>
      </span>

      {/* tap affordance — a hand-drawn play caret nudged in its album color */}
      <Doodle name="arrow" tone="purple" className="h-4 w-7 flex-none opacity-50" strokeWidth={3} />

      {/* inked progress line riding the bottom hairline — fainter for the echo */}
      {(track.isPlaying || echoing) && dur > 0 && (
        <span
          aria-hidden
          className="absolute bottom-0 left-0 h-[2px] rounded-full transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct}%`, background: albumColor, opacity: echoing ? 0.5 : 1 }}
        />
      )}
    </div>
  );

  return (
    <div className="border-b border-line/70">
      {track.songUrl ? (
        <Link
          href={track.songUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`${track.isPlaying ? "Now playing" : "Last played"}: ${track.title} by ${track.artist}. Open in Spotify.`}
          className="block transition-colors active:bg-paper-2/60"
        >
          {Body}
        </Link>
      ) : (
        Body
      )}
    </div>
  );
}

export default function SketchbookTabBar() {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  // the writing room has its own bottom bar — the site's steps aside
  if (pathname.startsWith("/write")) return null;

  return (
    <nav aria-label="Primary" data-avoid-lyrics className="fixed inset-x-0 bottom-0 z-50 md:hidden">
      <div
        className="relative border-t border-line bg-paper"
        // clip horizontally so the active tab's scribble ring can't spill past
        // the screen edge (which would add phantom horizontal scroll); the top
        // axis stays visible so the torn paper edge still shows above the bar.
        style={{
          overflowX: "clip",
          overflowY: "visible",
          paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))",
          boxShadow: "0 -7px 20px -14px rgb(var(--fg) / 0.4)",
        }}
      >
        {/* the bar reads as a torn strip of paper taped over the screen edge */}
        <TornEdge position="top" color="rgb(var(--bg))" />

        <NowPlayingBanner />

        <ul className="mx-auto flex max-w-md items-stretch justify-around px-1 pt-1.5">
          {ITEMS.map((it) => {
            const active = isActive(pathname, it.href);
            const accent = `rgb(var(${toneVar[it.tone]}))`;
            const color = active ? accent : "rgb(var(--fg-soft))";
            return (
              <li key={it.href} className="flex-1">
                <Link
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  className="group relative flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 transition-transform active:scale-90"
                >
                  <span className="relative flex h-9 w-9 items-center justify-center">
                    {/* a pen-scribbled ring loops around the current tab */}
                    <AnimatePresence>
                      {active && (
                        <motion.span
                          key="ring"
                          className="pointer-events-none absolute inset-0 flex items-center justify-center"
                          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.7, rotate: -8 }}
                          animate={{ opacity: 1, scale: 1, rotate: 0 }}
                          exit={{ opacity: 0, scale: 0.7 }}
                          transition={{ type: "spring", stiffness: 380, damping: 24 }}
                        >
                          <Doodle
                            name="circle"
                            tone={it.tone}
                            className="h-11 w-12"
                            strokeWidth={3}
                            draw={!reduce}
                          />
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <motion.span
                      animate={active && !reduce ? { y: -1 } : { y: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 22 }}
                    >
                      <Glyph d={it.d} rotate={it.rotate} color={color} active={active} />
                    </motion.span>
                  </span>
                  <span
                    className="font-hand text-[15px] leading-none transition-colors"
                    style={{ color }}
                  >
                    {it.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
