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

// one closed, finger-edged ring centred on the origin, radius R. `fingers`
// scales the comb amplitude (outer rings comb more); `freqs` come from the
// song's words so the silhouette is the song's, deterministically.
function ringPath(R: number, rand: () => number, fingers: number, freqs: number[]): string {
  const steps = 72;
  const amps = freqs.map(() => (0.035 + rand() * 0.05) * fingers);
  const phs = freqs.map(() => rand() * Math.PI * 2);
  let out = "";
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    let rr = 1;
    for (let h = 0; h < freqs.length; h++) rr += amps[h] * Math.sin(freqs[h] * a + phs[h]);
    rr += (rand() - 0.5) * 0.012; // hand-wavered micro jitter
    const r = R * rr;
    out += `${i ? "L" : "M"}${Math.round(Math.cos(a) * r * 10) / 10} ${Math.round(Math.sin(a) * r * 10) / 10}`;
    if (i < steps) out += " ";
  }
  return out + "Z";
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
    const baseR = 150 + rand() * 150;
    const ringCount = 4 + Math.floor(rand() * 3); // 4..6
    const rings: Ring[] = [];
    for (let k = 0; k < ringCount; k++) {
      const pos = ringCount === 1 ? 1 : k / (ringCount - 1);
      const R = baseR * (0.3 + 0.7 * pos);
      const fingers = 0.5 + pos * 1.4; // outer rings comb harder
      rings.push({ d: ringPath(R, rand, fingers, freqs), pos });
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

// Theme-aware ring style. The blend modes invert what "reads": under multiply
// (light) the DARK ink shows, so we bias every vein toward ink and make the
// outer bloom the heaviest line; under screen (dark) only LIGHT shows, so we
// lift every ring's luminance (inner→outer) so the concentric rings stay
// distinct instead of collapsing into one glow. No near-white halo in light
// mode (multiply by white is a no-op).
type RingStyle = { stroke: string; fill: string; width: number };
function ringStyle(p: AlbumPalette, dark: boolean, warmth: number, pos: number): RingStyle {
  const warm = mix(toRgb(p.vibrant), ORANGE, 0.22);
  const cool = mix(toRgb(p.secondary), PURPLE, 0.3);
  const hue = mix(cool, warm, (warmth + 1) / 2);
  const light = toRgb(p.light);
  const deep = toRgb(p.deep);

  if (dark) {
    const inner = mix(hue, light, 0.2); // lift cores so screen still shows them
    const c = mix(inner, light, pos * 0.6); // outer rings brightest
    return {
      stroke: cssRgb(c, 0.34 + 0.34 * pos),
      width: 1.3 + pos * 1.1,
      fill: pos === 0 ? cssRgb(mix(hue, light, 0.1), 0.06) : "none",
    };
  }
  // light / paper — ink veins, outer edge heaviest
  const tinted = mix(INK, hue, 0.5); // ink carrying the drop's hue
  const edge = mix(deep, INK, 0.35); // darker bloom edge so it reads under multiply
  const c = mix(tinted, edge, pos * 0.6);
  return { stroke: cssRgb(c, 0.34 + 0.26 * pos), width: 1.7 + pos * 1.5, fill: "none" };
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
                      {d.rings.map((r, k) => {
                        const s = ringStyle(palette, dark, d.warmth, r.pos);
                        return (
                          <path
                            key={k}
                            d={r.d}
                            className="ink-vein"
                            fill={s.fill}
                            stroke={s.stroke}
                            strokeWidth={s.width}
                            strokeLinejoin="round"
                          />
                        );
                      })}
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
