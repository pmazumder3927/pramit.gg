"use client";

// The now-playing song's words, written INTO the scape like marginalia. Each
// line, as the live playhead reaches it, is inked at its own hand-placed spot —
// drifting between the left margin, the centre and the right margin, at a slight
// angle and a jittered size, never a centred stack. It writes in left→right (a
// moving ink front, like the doodles' brush), then lingers as faint ink and
// drifts up as later lines arrive, finally lifting away — the same hand-off the
// doodles use on a song change. The current line burns brightest; its ghosts
// fade behind it, so the page reads as a few recent words scattered in ink.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { LyricLine } from "./useLyrics";
import type { SpotifyTrack } from "./NowPlayingContext";

const W = 1600;
const H = 900;
const FONT = 60;
const MARGIN = 70; // keep ink off the very edge
const MAX = 3; // current line + 2 lingering ghosts
// nudge lines in slightly early so they read as in-time with the vocal rather
// than chasing it — covers render + perceptual lag on top of measured latency.
const LYRIC_LEAD_MS = 220;

/* --------------------------- seeded placement --------------------------- */
function fnv(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mkRand(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Anchor = "start" | "middle" | "end";
interface Inscription {
  key: number;
  text: string;
  x: number;
  y: number;
  rot: number;
  size: number;
  anchor: Anchor;
  dur: number; // write-in seconds (longer lines take longer, like real writing)
}

// place a line in one of three natural columns, scattered in y and nudged away
// from the previous line so consecutive words don't collide.
function place(seedStr: string, text: string, prev?: Inscription): Inscription {
  const rand = mkRand(fnv(seedStr));
  const roll = rand();
  let anchor: Anchor;
  let x: number;
  if (roll < 0.36) {
    anchor = "start";
    x = (0.06 + rand() * 0.1) * W;
  } else if (roll < 0.64) {
    anchor = "middle";
    x = (0.4 + rand() * 0.2) * W;
  } else {
    anchor = "end";
    x = (0.84 + rand() * 0.1) * W;
  }

  let y = (0.16 + rand() * 0.66) * H;
  if (prev && Math.abs(y - prev.y) < H * 0.16) {
    // shove it into the opposite vertical half from the previous line
    y = prev.y < H * 0.5 ? prev.y + H * 0.22 : prev.y - H * 0.22;
  }
  y = clamp(y, 0.14 * H, 0.84 * H);

  const rot = (rand() * 2 - 1) * 2.8;
  const size = FONT * (0.84 + rand() * 0.34);
  const dur = clamp(text.length * 0.04, 0.6, 2.2);
  return { key: 0, text, x, y, rot, size, anchor, dur };
}

// squeeze a line that would run off-canvas back inside its column
function fit(insc: Inscription) {
  const room =
    insc.anchor === "start"
      ? W - MARGIN - insc.x
      : insc.anchor === "end"
        ? insc.x - MARGIN
        : Math.min(insc.x, W - insc.x) * 2 - MARGIN;
  const est = insc.text.length * insc.size * 0.4;
  return est > room
    ? { textLength: Math.max(120, room), lengthAdjust: "spacingAndGlyphs" as const }
    : {};
}

/* ----------------------------- live playhead ---------------------------- */
function useActiveLine(track: SpotifyTrack | null, lines: LyricLine[]): number {
  const [idx, setIdx] = useState(-1);
  const playing = !!track?.isPlaying;
  const duration = track?.duration ?? 0;
  const progress = track?.progress ?? 0;
  const serverNow = track?.serverNow ?? 0;
  const fetchedAt = track?.fetchedAt ?? 0;
  const latency = track?.clientLatency ?? 0;

  useEffect(() => {
    if (!lines.length) {
      setIdx(-1);
      return;
    }
    // full latency budget so lines land in realtime:
    //   cacheAge  — server-side staleness (cache TTL / upstream fetch time)
    //   latency   — network transit server→client (this response)
    //   elapsed   — client time since we received it (added per frame below)
    const cacheAge = serverNow && fetchedAt ? serverNow - fetchedAt : 0;
    const baseMs = progress + cacheAge;
    const findIdx = (ms: number) => {
      if (lines[0].t > ms) return -1;
      let lo = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].t <= ms) lo = i;
        else break;
      }
      return lo;
    };

    if (!playing) {
      // paused: show the true current line; don't lead/compensate forward
      setIdx(findIdx(baseMs));
      return;
    }
    const lead = latency + LYRIC_LEAD_MS;
    const recv = performance.now();
    let raf = 0;
    const tick = () => {
      const ms = baseMs + lead + (performance.now() - recv);
      const next = findIdx(duration > 0 ? Math.min(ms, duration) : ms);
      setIdx((cur) => (cur === next ? cur : next));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lines, playing, duration, progress, serverNow, fetchedAt, latency]);

  return idx;
}

/* ------------------------------ component ------------------------------- */
export default function SongScapeLyrics({
  track,
  trackId,
  lines,
  ink,
  dark,
  reduced,
}: {
  track: SpotifyTrack | null;
  trackId: string;
  lines: LyricLine[];
  ink: string; // solid ink rgb; age dimming handled via group opacity
  dark: boolean;
  reduced: boolean;
}) {
  const idx = useActiveLine(track, lines);
  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const counter = useRef(0);
  const lastIdx = useRef(-1);

  // new song → clear the page
  useEffect(() => {
    setInscriptions([]);
    lastIdx.current = -1;
  }, [trackId]);

  // playhead crossed into a new (non-empty) line → ink it in somewhere fresh
  useEffect(() => {
    if (idx < 0) return;
    const text = lines[idx]?.text?.trim();
    if (!text) return;
    if (idx === lastIdx.current) return;
    lastIdx.current = idx;
    setInscriptions((list) => {
      const prev = list[list.length - 1];
      const insc = { ...place(`${trackId}:${idx}`, text, prev), key: counter.current++ };
      return [...list, insc].slice(-MAX);
    });
  }, [idx, lines, trackId]);

  if (!inscriptions.length) return null;

  // age 0 = freshest; older ghosts dim and float a touch higher
  const ageOpacity = dark ? [0.58, 0.32, 0.16] : [0.48, 0.26, 0.13];

  return (
    <g className="songscape-lyrics ink-sway" style={{ pointerEvents: "none" }}>
      <AnimatePresence>
        {inscriptions.map((insc, i) => {
          const age = inscriptions.length - 1 - i;
          return (
            <motion.g
              key={insc.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: ageOpacity[age] ?? 0.12, y: -age * 12 }}
              exit={{ opacity: 0, y: -44 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            >
              <g
                style={{
                  transform: `rotate(${insc.rot.toFixed(2)}deg)`,
                  transformBox: "view-box",
                  transformOrigin: `${insc.x.toFixed(1)}px ${insc.y.toFixed(1)}px`,
                }}
              >
                <text
                  x={insc.x}
                  y={insc.y}
                  textAnchor={insc.anchor}
                  fill={ink}
                  fontFamily="var(--font-caveat), cursive"
                  fontSize={insc.size}
                  className={reduced ? undefined : "lyric-write"}
                  style={
                    reduced
                      ? undefined
                      : ({ "--lyric-dur": `${insc.dur.toFixed(2)}s` } as React.CSSProperties)
                  }
                  {...fit(insc)}
                >
                  {insc.text}
                </text>
              </g>
            </motion.g>
          );
        })}
      </AnimatePresence>
    </g>
  );
}
