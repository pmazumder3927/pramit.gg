"use client";

// Songscape · Sumi-no-Mizu ("ink in the water") — an alternate now-playing
// backdrop. The screen is a still tank; the album's colours float in it as a few
// drops of marbled ink.
//   · shape  : each drop is a set of CONCENTRIC, finger-edged rings (suminagashi
//              veins — not glowing blobs). Each word of "title artist" bends the
//              fingering, so the song's name is written into how the ink combs.
//   · colour : palette → vibrant warms one drop, secondary cools another, deep =
//              the inkstone cores, light = the bright bloom ring. Orange/purple
//              are the warm/cool poles every song is nudged toward.
//   · time   : the live playhead (progress/duration) DIFFUSES the ink — fresh at
//              song-start (tight, crisp), dilute by the end (a natural lull).
//   · change : the old pigment disperses & thins while a new drop falls and
//              blooms open (fast-open, long-settle). Screen is never empty.
//   · theme  : light = multiply stains on paper; dark = ink glowing in black water.
// Compositor-only (CSS transforms + opacity + blend-mode). No SVG filters.

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
type Ring = { d: string; pos: number }; // pos 0 = innermost, 1 = bloom ring
type Drop = {
  cx: number;
  cy: number;
  rings: Ring[];
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

// A smooth CLOSED curve through points (Catmull-Rom → cubic béziers). Flowing
// edges read as brushed ink rather than a faceted polygon.
function smoothClosed(pts: [number, number][]): string {
  const n = pts.length;
  const r = (v: number) => Math.round(v * 10) / 10;
  let d = `M${r(pts[0][0])} ${r(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${r(c1x)} ${r(c1y)} ${r(c2x)} ${r(c2y)} ${r(p2[0])} ${r(p2[1])}`;
  }
  return d + "Z";
}

function makeInk(words: string[], seedStr: string, idle: boolean) {
  const seed = fnv(seedStr);
  const rand = mkRand(seed);

  // word signatures → comb frequencies (the song's fingerprint in the veins)
  const sigs = (words.length ? words : ["nothing"]).slice(0, 6).map((w) => {
    let s = 0;
    for (let k = 0; k < w.length; k++) s += w.charCodeAt(k);
    return s;
  });
  const freqs = sigs.map((s) => 2 + (s % 5)); // 2..6 lobes
  while (freqs.length < 2) freqs.push(3 + freqs.length);

  const n = idle ? 2 : 3 + Math.floor(rand() * 3); // 2 idle, else 3..5
  const drops: Drop[] = [];
  const base = rand() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    // arrange around the centre on a soft annulus → keeps the reading centre calm
    const ang = base + (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.7;
    const rad = (0.26 + rand() * 0.2) * Math.min(W, H);
    const cx = W / 2 + Math.cos(ang) * rad;
    const cy = H / 2 + Math.sin(ang) * rad * 0.82;
    const baseR = 175 + rand() * 165;

    // ONE coherent warp field shared by every ring of this drop, so the nested
    // rings flow together (marbling) instead of each wobbling on its own (noise).
    const harm = freqs.slice(0, 3);
    const amps = harm.map(() => 0.03 + rand() * 0.035);
    const phs = harm.map(() => rand() * Math.PI * 2);
    // a single drag direction pulls the outer rings off-centre — the classic
    // suminagashi teardrop after a breath crosses the water.
    const dragAng = rand() * Math.PI * 2;
    const dragMag = (0.1 + rand() * 0.16) * baseR;
    const dragX = Math.cos(dragAng) * dragMag;
    const dragY = Math.sin(dragAng) * dragMag;
    const squash = 0.84 + rand() * 0.18; // slight ovalness

    const ringCount = 5 + Math.floor(rand() * 3); // 5..7 — finer, since smooth
    const SAMPLES = 32;
    const rings: Ring[] = [];
    for (let k = 0; k < ringCount; k++) {
      const pos = ringCount === 1 ? 1 : k / (ringCount - 1);
      const R = baseR * (0.16 + 0.84 * pos);
      const ccx = dragX * pos; // outer rings pulled along the drag
      const ccy = dragY * pos;
      const pts: [number, number][] = [];
      for (let s = 0; s < SAMPLES; s++) {
        const a = (s / SAMPLES) * Math.PI * 2;
        let warp = 1;
        for (let h = 0; h < harm.length; h++) warp += amps[h] * (0.6 + pos) * Math.sin(harm[h] * a + phs[h]);
        const rr = R * warp;
        pts.push([ccx + Math.cos(a) * rr, ccy + Math.sin(a) * rr * squash]);
      }
      rings.push({ d: smoothClosed(pts), pos });
    }
    // warmth: first drop warm, second cool, rest drift between the poles
    const warmth = i === 0 ? 1 : i === 1 ? -1 : (rand() - 0.5) * 1.6;
    const vx = (cx - W / 2) / W;
    const vy = (cy - H / 2) / H;
    const vlen = Math.hypot(vx, vy) || 1;
    drops.push({
      cx,
      cy,
      rings,
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

// Theme-aware vein style → an RGB colour + base alpha + width. Each ring is then
// painted as a soft wet halo + a crisp vein on top (see render), which fakes the
// bleeding edge of ink without an SVG filter. The blend modes invert what
// "reads": multiply (light) shows the DARK ink, so we bias toward ink and make
// the outer edge heaviest; screen (dark) shows only LIGHT, so we lift every
// ring's luminance (inner→outer) so the nested rings stay distinct.
type Vein = { c: RGB; a: number; w: number };
function ringStyle(p: AlbumPalette, dark: boolean, hue: RGB, pos: number): Vein {
  if (dark) {
    const inner = mix(hue, toRgb(p.light), 0.22); // lift cores so screen shows them
    const c = mix(inner, toRgb(p.light), pos * 0.6); // outer rings brightest
    return { c, a: 0.32 + 0.32 * pos, w: 1.1 + pos * 1.0 };
  }
  // light / paper — ink veins, outer edge heaviest
  const tinted = mix(INK, hue, 0.5); // ink carrying the drop's hue
  const edge = mix(toRgb(p.deep), INK, 0.35); // darker bloom edge reads under multiply
  const c = mix(tinted, edge, pos * 0.6);
  return { c, a: 0.32 + 0.24 * pos, w: 1.5 + pos * 1.3 };
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
// Each drop is a direct Motion child carrying its own position via x/y (so
// stagger + exit propagation are reliable and the bloom scales around its own
// centre). The bloom opens fast then settles long; on leave it balloons, thins,
// and drifts outward from the tank centre (disperse).
const dropV: Variants = {
  enter: (d: Drop) => ({ x: d.cx, y: d.cy, scale: 0.12, opacity: 0 }),
  show: (d: Drop) => ({
    x: d.cx,
    y: d.cy,
    scale: 1,
    opacity: 1,
    transition: { duration: 1.7, ease: [0.16, 1, 0.3, 1] },
  }),
  leave: (d: Drop) => ({
    x: d.cx + d.px,
    y: d.cy + d.py,
    scale: 1.7,
    opacity: 0,
    transition: { duration: 1.25, ease: [0.4, 0, 0.6, 1] },
  }),
};
const dropReduced: Variants = {
  enter: (d: Drop) => ({ x: d.cx, y: d.cy, opacity: 0 }),
  show: (d: Drop) => ({ x: d.cx, y: d.cy, opacity: 1, transition: { duration: 0.7 } }),
  leave: (d: Drop) => ({ x: d.cx, y: d.cy, opacity: 0, transition: { duration: 0.7 } }),
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
                  {/* rings are centred on the origin; the motion.g translates the
                      drop into place via x/y and scales it around its own centre */}
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
                          const outer = d.rings[d.rings.length - 1];
                          const body = dark
                            ? cssRgb(mix(hue, toRgb(palette.light), 0.1), 0.05)
                            : cssRgb(mix(INK, hue, 0.55), 0.035);
                          return (
                            <>
                              {/* faint suspended body — the wash the veins float in */}
                              <path d={outer.d} fill={body} stroke="none" />
                              {d.rings.map((r, k) => {
                                const v = ringStyle(palette, dark, hue, r.pos);
                                return (
                                  <g key={k} className="ink-vein">
                                    {/* wet halo (soft bleed) */}
                                    <path
                                      d={r.d}
                                      fill="none"
                                      stroke={cssRgb(v.c, v.a * 0.3)}
                                      strokeWidth={v.w * 3.2}
                                      strokeLinejoin="round"
                                    />
                                    {/* the vein itself */}
                                    <path
                                      d={r.d}
                                      fill="none"
                                      stroke={cssRgb(v.c, v.a)}
                                      strokeWidth={v.w}
                                      strokeLinejoin="round"
                                    />
                                  </g>
                                );
                              })}
                            </>
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
