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

// Handwriting stack: Caveat for Latin, then per-script inked faces (lazy webfonts
// + system fallbacks) — Chinese brush, Korean pen, Hindi/Devanagari hand, a
// Japanese brush face — then serif. Per-glyph fallback means each language gets
// an on-theme handwritten face instead of the browser's default sans.
const LYRIC_FONT =
  // dedicated webfonts FIRST — each is scoped to its own script by unicode-range,
  // and Caveat-first claims Latin, so none can wrongly grab another's glyphs.
  "var(--font-caveat), " +
  "var(--font-cjk-hand), var(--font-kr-hand), var(--font-hi-hand), var(--font-bn-hand), " +
  // system fallbacks AFTER, only reached if a webfont fails to load. NB: pan-Indic
  // faces like 'Nirmala UI' cover Bengali+Devanagari, so they must stay below the
  // dedicated webfonts or they'd intercept those scripts with a flat face.
  "'Kaiti SC', 'STKaiti', 'KaiTi', '楷体', 'Kaiti TC', 'Xingkai SC', " +
  "'Apple SD Gothic Neo', 'Malgun Gothic', " +
  "'Kohinoor Devanagari', 'Kohinoor Bangla', 'Bangla Sangam MN', 'Vrinda', 'Nirmala UI', " +
  "'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif CJK SC', 'Songti SC', " +
  "cursive, serif";

// full-width glyphs (CJK ideographs, kana, hangul) are ~1em; Latin ~0.42em —
// estimate line width so long lines (especially CJK) get squeezed back on-canvas.
const WIDE =
  /[ᄀ-ᇿ⺀-〿぀-ヿ㐀-䶿一-鿿ꥠ-꥿가-퟿豈-﫿＀-￯]/;
const MED = /[ऀ-ॿঀ-৿]/; // Devanagari (Hindi) + Bengali — proportional, ~0.6em
function estWidth(text: string, size: number): number {
  let w = 0;
  for (const ch of text) w += (WIDE.test(ch) ? 1.0 : MED.test(ch) ? 0.6 : 0.42) * size;
  return w;
}

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

/* --------------------- foreground-clash avoidance ----------------------- */
// A rectangle in the SVG's 1600×900 view-box space.
interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// the view-box-space box a line would occupy (ignoring its small rotation)
function boxOf(anchor: Anchor, x: number, y: number, size: number, text: string): Box {
  const w = estWidth(text, size);
  const x0 = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
  // baseline sits at y; allow for ascenders above and a little descent below
  return { x0, y0: y - size * 0.78, x1: x0 + w, y1: y + size * 0.28 };
}

// fraction of a line's own box that overlaps the obstacles (0 = clear)
function overlapFrac(b: Box, obstacles: Box[]): number {
  const area = Math.max(1, (b.x1 - b.x0) * (b.y1 - b.y0));
  let covered = 0;
  for (const o of obstacles) {
    const ix = Math.min(b.x1, o.x1) - Math.max(b.x0, o.x0);
    const iy = Math.min(b.y1, o.y1) - Math.max(b.y0, o.y0);
    if (ix > 0 && iy > 0) covered += ix * iy;
  }
  return covered / area;
}

// Measure the visible FOREGROUND text/controls and map their screen rects into
// view-box space, so placement can steer clear of them. The SongScape SVG is a
// fixed, full-viewport backdrop drawn with preserveAspectRatio="xMidYMid slice"
// (cover), so we invert that mapping. Backdrop elements (aria-hidden) are skipped.
function collectObstacles(): Box[] {
  if (typeof window === "undefined") return [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!vw || !vh) return [];
  const scale = Math.max(vw / W, vh / H); // slice = cover
  const offX = (vw - W * scale) / 2;
  const offY = (vh - H * scale) / 2;
  const toVB = (r: DOMRect): Box => ({
    x0: (r.left - offX) / scale,
    y0: (r.top - offY) / scale,
    x1: (r.right - offX) / scale,
    y1: (r.bottom - offY) / scale,
  });

  const boxes: Box[] = [];
  const els = document.querySelectorAll<HTMLElement>(
    "h1,h2,h3,h4,h5,p,li,blockquote,figure,nav,header,button,a[href],input,textarea,img,[data-avoid-lyrics]"
  );
  els.forEach((el) => {
    if (el.closest('[aria-hidden="true"]')) return; // skip the backdrop itself
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;
    if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) return; // offscreen
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.opacity === "0") return;
    boxes.push(toVB(r));
  });
  return boxes;
}

// one seeded candidate placement (a natural column + scattered y + jitter)
function makeCandidate(rand: () => number, text: string): Inscription {
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
  const y = clamp((0.16 + rand() * 0.66) * H, 0.14 * H, 0.84 * H);
  const rot = (rand() * 2 - 1) * 2.8;
  const size = FONT * (0.84 + rand() * 0.34);
  const dur = clamp(text.length * 0.04, 0.6, 2.2);
  return { key: 0, text, x, y, rot, size, anchor, dur };
}

// a little overlap is fine; beyond this fraction we'd rather reshuffle
const ALLOW_OVERLAP = 0.22;

// Place a line: try several seeded candidates and take the first that mostly
// clears the foreground (and the other current lines); if none do, take the
// least-clashing one. Falls back to plain seeded placement when nothing is
// measured (e.g. an empty page), preserving the natural scatter.
function place(seedStr: string, text: string, obstacles: Box[]): Inscription {
  const rand = mkRand(fnv(seedStr));
  const tries = obstacles.length ? 12 : 1;
  let best: Inscription | null = null;
  let bestFrac = Infinity;
  for (let i = 0; i < tries; i++) {
    const cand = makeCandidate(rand, text);
    const frac = overlapFrac(boxOf(cand.anchor, cand.x, cand.y, cand.size, text), obstacles);
    if (frac < bestFrac) {
      best = cand;
      bestFrac = frac;
    }
    if (frac <= ALLOW_OVERLAP) break; // good enough — keep the natural pick
  }
  return best!;
}

// squeeze a line that would run off-canvas back inside its column
function fit(insc: Inscription) {
  const room =
    insc.anchor === "start"
      ? W - MARGIN - insc.x
      : insc.anchor === "end"
        ? insc.x - MARGIN
        : Math.min(insc.x, W - insc.x) * 2 - MARGIN;
  const est = estWidth(insc.text, insc.size);
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
    // measure the foreground once, here in the effect (not in the state updater)
    const foreground = collectObstacles();
    setInscriptions((list) => {
      // steer clear of the page's text AND the other lines currently on screen
      const obstacles = foreground.concat(
        list.map((p) => boxOf(p.anchor, p.x, p.y, p.size, p.text))
      );
      const insc = { ...place(`${trackId}:${idx}`, text, obstacles), key: counter.current++ };
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
                  fontSize={insc.size}
                  className={reduced ? undefined : "lyric-write"}
                  // font-family via style (CSS), NOT the SVG presentation
                  // attribute — var() is only substituted in real CSS, so the
                  // attribute form silently fell through to the generic fallback.
                  style={{
                    fontFamily: LYRIC_FONT,
                    ...(reduced ? {} : { "--lyric-dur": `${insc.dur.toFixed(2)}s` }),
                  } as React.CSSProperties}
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
