"use client";

// Songscape · Sumi-no-Mizu ("ink in the water") — an alternate now-playing
// backdrop. The album's colours float in a still tank as a few sumi-e brush
// gestures (a bold one + lighter accents), not as a widget.
//   · shape  : each "drop" is a gestural brush stroke — a tapered ribbon
//              (thin → swell → thin lift) over a gestural arc, with a denser
//              inner core for ink value. Each word of "title artist" warps the
//              centreline, so the song's hand is in the gesture.
//   · colour : palette → vibrant warms the hero stroke, secondary cools the next;
//              orange/purple are the warm/cool poles every song is nudged toward.
//   · time   : the live playhead (progress/duration) DIFFUSES the ink — fresh at
//              song-start (tight), softly spreading by the end (a natural lull).
//   · change : the old strokes spread & thin and drift out while the new ones
//              bloom in (fast-open, long-settle). Screen is never empty.
//   · theme  : light = multiply ink on paper; dark = ink glowing in black water.
// Compositor-only transforms/opacity/blend + one cached blur for the bleed.

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { useNowPlayingContext } from "./NowPlayingContext";
import { useAlbumPalette, AlbumPalette } from "@/app/lib/use-album-palette";

const W = 1600;
const H = 900;

/* ----------------------------- determinism ----------------------------- */
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

/* ------------------------------- colour -------------------------------- */
type RGB = { r: number; g: number; b: number };
const toRgb = (h: string): RGB => {
  const n = parseInt(h.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};
const mix = (a: RGB, b: RGB, t: number): RGB => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
});
const cssRgb = (c: RGB, a = 1) =>
  `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${a})`;
const ORANGE = toRgb("#ff6b3d"); // grandpa's sunset — the warm pole
const PURPLE = toRgb("#7c77c6"); // first crush's flower — the cool pole
const INK: RGB = { r: 35, g: 32, b: 27 }; // warm black for paper-mode veins

/* ------------------------------ geometry ------------------------------- */
// Each "drop" is a sumi-e brush GESTURE: a gestural arc centreline given a
// tapered width profile (thin → swell → thin lift) and rendered as a filled
// ribbon, with a denser inner core for ink value. Reads as confident calligraphy
// rather than topographic contour rings.
type Stroke = {
  base: string; // full-width ribbon path
  core: string; // narrower, denser inner ribbon path
  warmth: number; // 1 = warm, -1 = cool, mixes between
  dx: string; // drift target (user units, as a css length)
  dy: string;
  dr: string; // drift rotation (deg)
  dur: string; // drift duration
  delay: string;
  bdur: string; // breathe duration
  bdelay: string;
  px: number; // disperse vector (where it flees on song change)
  py: number;
};

const r1 = (v: number) => Math.round(v * 10) / 10;
const poly = (p: [number, number][]) => "M" + p.map((q) => `${r1(q[0])} ${r1(q[1])}`).join("L");

// brush pressure: enters thin, swells, lifts thin — with a faint living ripple
function widthAt(t: number, wMax: number): number {
  const up = Math.min(1, t / 0.16);
  const down = Math.min(1, (1 - t) / 0.24);
  return wMax * Math.pow(Math.min(up, down), 0.65) * (0.82 + 0.18 * Math.sin(t * 6 + 1));
}

// a gestural arc, word-warped, sampled densely
function centerline(
  cx: number, cy: number, R: number, a0: number, sweep: number,
  harm: number[], amps: number[], phs: number[], squash: number
): [number, number][] {
  const N = 96;
  const C: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const a = a0 + sweep * (i / N);
    let warp = 1;
    for (let h = 0; h < harm.length; h++) warp += amps[h] * Math.sin(harm[h] * a + phs[h]);
    const r = R * warp;
    C.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * squash]);
  }
  return C;
}

// offset the centreline by ±width/2 along its normals → a closed brush ribbon
function ribbon(C: [number, number][], wMax: number, wScale: number): string {
  const L: [number, number][] = [];
  const Rt: [number, number][] = [];
  for (let i = 0; i < C.length; i++) {
    const p = C[i];
    const pa = C[Math.max(0, i - 1)];
    const pb = C[Math.min(C.length - 1, i + 1)];
    const tx = pb[0] - pa[0];
    const ty = pb[1] - pa[1];
    const ln = Math.hypot(tx, ty) || 1;
    const nx = -ty / ln;
    const ny = tx / ln;
    const w = (widthAt(i / (C.length - 1), wMax) * wScale) / 2;
    L.push([p[0] + nx * w, p[1] + ny * w]);
    Rt.push([p[0] - nx * w, p[1] - ny * w]);
  }
  return poly(L) + "L" + poly(Rt.reverse()).slice(1) + "Z";
}

function makeInk(words: string[], seedStr: string, idle: boolean) {
  const seed = fnv(seedStr);
  const rand = mkRand(seed);

  // word signatures → centreline warp frequencies (the song's hand in the gesture)
  const sigs = (words.length ? words : ["nothing"]).slice(0, 6).map((w) => {
    let s = 0;
    for (let k = 0; k < w.length; k++) s += w.charCodeAt(k);
    return s;
  });
  const freqs = sigs.map((s) => 2 + (s % 4));
  while (freqs.length < 2) freqs.push(3);

  const n = idle ? 2 : 2 + Math.floor(rand() * 2); // 2 idle, else 2..3 — calm
  const drops: Stroke[] = [];
  const base = rand() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    // sit each gesture on a soft annulus so the reading centre stays calm
    const ang = base + (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.5;
    const rad = (0.18 + rand() * 0.16) * Math.min(W, H);
    const cx = W / 2 + Math.cos(ang) * rad;
    const cy = H / 2 + Math.sin(ang) * rad * 0.8;

    const hero = i === 0; // first gesture is the bold one, rest are accents
    const R = (hero ? 240 : 150) + rand() * (hero ? 110 : 120);
    const a0 = rand() * Math.PI * 2;
    const sweep = (0.6 + rand() * 1.15) * Math.PI * (rand() < 0.5 ? 1 : -1); // arc or near-ensō
    const harm = freqs.slice(0, 2);
    const amps = harm.map(() => 0.03 + rand() * 0.05);
    const phs = harm.map(() => rand() * Math.PI * 2);
    const squash = 0.82 + rand() * 0.22;
    const wMax = R * ((hero ? 0.12 : 0.08) + rand() * 0.06);
    const C = centerline(cx, cy, R, a0, sweep, harm, amps, phs, squash);

    // warmth: first gesture warm, second cool, rest drift between the poles
    const warmth = i === 0 ? 1 : i === 1 ? -1 : (rand() - 0.5) * 1.6;
    const vx = (cx - W / 2) / W;
    const vy = (cy - H / 2) / H;
    const vlen = Math.hypot(vx, vy) || 1;
    drops.push({
      base: ribbon(C, wMax, 1),
      core: ribbon(C, wMax, 0.5),
      warmth,
      dx: `${((rand() * 2 - 1) * 26).toFixed(1)}px`,
      dy: `${((rand() * 2 - 1) * 20).toFixed(1)}px`,
      dr: `${((rand() * 2 - 1) * 4).toFixed(2)}deg`,
      dur: `${(46 + rand() * 30).toFixed(0)}s`,
      delay: `-${(rand() * 40).toFixed(0)}s`,
      bdur: `${(12 + rand() * 9).toFixed(0)}s`,
      bdelay: `-${(rand() * 12).toFixed(0)}s`,
      px: (vx / vlen) * 150,
      py: (vy / vlen) * 150,
    });
  }
  return { drops, uid: seed.toString(36) };
}

// the drop's hue, biased toward the warm (orange) / cool (purple) poles
function dropHue(p: AlbumPalette, warmth: number): RGB {
  const warm = mix(toRgb(p.vibrant), ORANGE, 0.22);
  const cool = mix(toRgb(p.secondary), PURPLE, 0.3);
  return mix(cool, warm, (warmth + 1) / 2);
}

// Theme-aware brush fills → the soft outer ribbon + the denser inner core, which
// together give the stroke real ink VALUE (darker spine, lighter edges) plus a
// blurred bleed. The blend modes invert what reads: multiply (light) shows the
// DARK ink, so we bias toward ink; screen (dark) shows only LIGHT, so we lift the
// hue toward the album's light so the gesture glows in black water.
function strokeFills(p: AlbumPalette, dark: boolean, hue: RGB): { base: string; core: string } {
  if (dark) {
    return {
      base: cssRgb(mix(hue, toRgb(p.light), 0.12), 0.32),
      core: cssRgb(mix(hue, toRgb(p.light), 0.5), 0.5), // brighter, denser spine
    };
  }
  return {
    base: cssRgb(mix(INK, hue, 0.6), 0.3),
    core: cssRgb(mix(INK, hue, 0.32), 0.5), // darker, inkier spine
  };
}

/* ----------------------------- playhead -------------------------------- */
// Drive a single --t (0..1 song progress) onto the SVG root via one rAF loop,
// interpolated client-side between the ~5s polls. No per-frame React renders.
function useDiffuse(
  root: React.RefObject<SVGSVGElement | null>,
  track: ReturnType<typeof useNowPlayingContext>["track"],
  reduced: boolean | null
) {
  const playing = !!track?.isPlaying;
  const duration = track?.duration ?? 0;
  const progress = track?.progress ?? 0;
  const serverNow = track?.serverNow ?? 0;
  const fetchedAt = track?.fetchedAt ?? 0;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
    // reduced motion, nothing playing, or no playhead → set --t once, no rAF spin
    if (reduced) {
      el.style.setProperty("--t", "0.32");
      return;
    }
    if (duration <= 0) {
      el.style.setProperty("--t", "0");
      return;
    }
    const cacheAge = serverNow && fetchedAt ? serverNow - fetchedAt : 0;
    const baseMs = progress + cacheAge;
    if (!playing) {
      el.style.setProperty("--t", clamp01(baseMs / duration).toFixed(4));
      return;
    }
    const recv = performance.now();
    let raf = 0;
    let last = -1;
    const tick = () => {
      const t = clamp01((baseMs + (performance.now() - recv)) / duration);
      if (Math.abs(t - last) > 0.0008) {
        el.style.setProperty("--t", t.toFixed(4));
        last = t;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [root, reduced, playing, duration, progress, serverNow, fetchedAt]);
}

/* ------------------------------ variants ------------------------------- */
const container: Variants = {
  enter: {},
  show: { transition: { staggerChildren: 0.22 } },
  leave: { transition: { staggerChildren: 0.12 } },
};
// Strokes are drawn at absolute coords, so each scales around its OWN centre
// (fill-box) — no x/y for placement. The brush blooms in (ink swelling, settling
// long); on leave it spreads, thins, and drifts outward (disperse).
const dropV: Variants = {
  enter: { scale: 0.55, opacity: 0 },
  show: { scale: 1, opacity: 1, transition: { duration: 1.7, ease: [0.16, 1, 0.3, 1] } },
  leave: (d: Stroke) => ({
    scale: 1.55,
    opacity: 0,
    x: d.px,
    y: d.py,
    transition: { duration: 1.25, ease: [0.4, 0, 0.6, 1] },
  }),
};
const dropReduced: Variants = {
  enter: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.7 } },
  leave: { opacity: 0, transition: { duration: 0.7 } },
};

/* ------------------------------ component ------------------------------ */
export default function SongScapeInk() {
  const { track } = useNowPlayingContext();
  const palette = useAlbumPalette(track?.albumImageUrl || null);
  const reduced = useReducedMotion();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const idle = !track;
  const songKey = track ? track.trackId || `${track.title}${track.artist}${track.album}` : "—";
  const words = useMemo(
    () =>
      track
        ? `${track.title} ${track.artist}`
            .toLowerCase()
            .split(/[^a-z0-9]+/i)
            .filter(Boolean)
        : ["nothing"],
    [track]
  );
  const ink = useMemo(() => makeInk(words, songKey, idle), [songKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useDiffuse(svgRef, track, reduced ?? null);

  if (!mounted) return null;

  const variants = reduced ? dropReduced : dropV;
  // light: ink stains the paper (multiply); dark: ink glows in black water (screen)
  const blend = dark ? "screen" : "multiply";

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <svg
        ref={svgRef}
        className="h-full w-full"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        {/* surface light catching the water — a slow caustic sweep, dark mode only */}
        {dark && (
          <g className="ink-caustic" style={{ mixBlendMode: "screen" }}>
            <defs>
              <radialGradient id={`ink-caustic-${ink.uid}`}>
                <stop offset="0%" stopColor={cssRgb(mix(toRgb(palette.light), { r: 255, g: 255, b: 255 }, 0.3), 0.1)} />
                <stop offset="100%" stopColor={cssRgb(toRgb(palette.light), 0)} />
              </radialGradient>
            </defs>
            <ellipse cx={W * 0.5} cy={H * 0.42} rx={W * 0.7} ry={H * 0.6} fill={`url(#ink-caustic-${ink.uid})`} />
          </g>
        )}

        {/* the ink. one persistent diffuse layer (playhead-scaled), drops inside */}
        <g
          className="ink-diffuse"
          style={{ mixBlendMode: blend as React.CSSProperties["mixBlendMode"] }}
        >
          <AnimatePresence>
            <motion.g
              key={songKey}
              variants={container}
              initial="enter"
              animate="show"
              exit="leave"
            >
              {ink.drops.map((d, i) => (
                <motion.g
                  key={i}
                  custom={d}
                  variants={variants}
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                >
                  {/* strokes are at absolute coords; the motion.g scales each one
                      around its own centre (fill-box) for the bloom/disperse */}
                  <g
                    className="ink-drift"
                    style={
                      {
                        "--dx": d.dx,
                        "--dy": d.dy,
                        "--dr": d.dr,
                        "--dur": d.dur,
                        "--delay": d.delay,
                        transformBox: "fill-box",
                        transformOrigin: "center",
                      } as React.CSSProperties
                    }
                  >
                    <g
                      className="ink-breathe"
                      style={
                        {
                          "--bdur": d.bdur,
                          "--bdelay": d.bdelay,
                          transformBox: "fill-box",
                          transformOrigin: "center",
                        } as React.CSSProperties
                      }
                    >
                      {/* static, blur-softened layer → cached as one composited
                          raster; the drift/breathe/diffuse transforms above just
                          move it, so the soft ink bleed stays cheap. */}
                      <g className="ink-soft">
                        {(() => {
                          const hue = dropHue(palette, d.warmth);
                          const f = strokeFills(palette, dark, hue);
                          return (
                            <g className="ink-stroke">
                              {/* full-width ink ribbon */}
                              <path d={d.base} fill={f.base} stroke="none" />
                              {/* denser inner core → brush value (dark spine) */}
                              <path d={d.core} fill={f.core} stroke="none" />
                            </g>
                          );
                        })()}
                      </g>
                    </g>
                  </g>
                </motion.g>
              ))}
            </motion.g>
          </AnimatePresence>
        </g>
      </svg>
    </div>
  );
}
