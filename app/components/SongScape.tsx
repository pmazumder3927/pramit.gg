"use client";

// Songscape — a backdrop generated from whatever's playing.
//   · shape  : each word of "title artist" becomes a mountain peak whose height
//              comes from its letters, so the skyline traces the song's name.
//   · colour : a palette pulled from the album art tints the ridges, a sky wash,
//              and a celestial body (moon by night / sun by day).
//   · mood   : brighter / more saturated covers glow stronger.
//   · theme  : night = dark silhouettes + pale moonlit strokes;
//              day   = translucent washes + inked ridge lines on paper.
// When the song changes the old landscape cross-fades out and the new one draws
// itself in. Deterministic per song; pure SVG + CSS + Motion.

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNowPlayingContext } from "./NowPlayingContext";
import { useAlbumPalette, AlbumPalette } from "@/app/lib/use-album-palette";

const W = 1600;
const H = 900;
// Geometry overshoots the viewport so the parallax sway never reveals an edge.
const OS = 170; // horizontal overscan
const BY = 260; // how far the silhouette extends below the bottom

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

type Ridge = { top: string; area: string; len: number };

function finalize(pts: [number, number][]): Ridge {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  const r = (n: number) => Math.round(n * 10) / 10;
  const x0 = r(pts[0][0]);
  const x1 = r(pts[pts.length - 1][0]);
  return {
    top: pts.map((p) => `${r(p[0])},${r(p[1])}`).join(" "),
    area: `M${x0} ${H + BY} ` + pts.map((p) => `L${r(p[0])} ${r(p[1])}`).join(" ") + ` L${x1} ${H + BY} Z`,
    len: Math.round(len),
  };
}

// near ridge: one alpine peak per word, height from the word's letters. A little
// seeded jitter on every point gives the line a hand-drawn waver (replaces the
// SVG roughen filter, so the swaying layers stay cheap to composite).
function wordRidge(words: string[], rand: () => number, baseY: number, amp: number): Ridge {
  const j = (s: number) => (rand() - 0.5) * s;
  const toks = (words.length ? words : ["nothing"]).slice(0, 9);
  const n = toks.length;
  const pts: [number, number][] = [[-OS, baseY + j(8)]];
  for (let i = 0; i < n; i++) {
    const cx = (W * (i + 0.5)) / n;
    let cs = 0;
    for (let k = 0; k < toks[i].length; k++) cs += toks[i].charCodeAt(k);
    const norm = (cs % 97) / 97;
    pts.push([cx + j(10), baseY - (0.4 + 0.6 * norm) * amp + j(10)]);
    if (i < n - 1) pts.push([(W * (i + 1)) / n + j(12), baseY - (0.06 + rand() * 0.12) * amp + j(10)]);
  }
  pts.push([W + OS, baseY + j(8)]);
  return finalize(pts);
}

// far / mid ridges: rolling skyline from a sum of seeded sine waves, jittered
function sineRidge(rand: () => number, baseY: number, amp: number, peak: number): Ridge {
  const p1 = rand() * 6.28;
  const p2 = rand() * 6.28;
  const p3 = rand() * 6.28;
  const steps = 70;
  const span = W + 2 * OS;
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const x = -OS + (span / steps) * i;
    const t = i / steps;
    pts.push([
      x + (rand() - 0.5) * 5,
      baseY -
        Math.sin(t * 3.1 + p1) * amp * 0.5 -
        Math.sin(t * 7.4 + p2) * amp * (0.26 + peak * 0.2) -
        Math.sin(t * 14.3 + p3) * amp * (0.13 + peak * 0.22) +
        (rand() - 0.5) * 6,
    ]);
  }
  return finalize(pts);
}

function makeScape(words: string[], seedStr: string) {
  const seed = fnv(seedStr);
  const near = wordRidge(words, mkRand(seed), 716, 150);
  const mid = sineRidge(mkRand(seed ^ 0x9e3779b9), 604, 86, 0.5);
  const far = sineRidge(mkRand(seed ^ 0x85ebca6b), 508, 54, 0.2);
  const br = mkRand(seed ^ 0xc2b2ae35);
  return {
    near,
    mid,
    far,
    uid: seed.toString(36),
    bodyX: (0.6 + br() * 0.26) * W,
    bodyY: (0.12 + br() * 0.12) * H,
    bodyR: 38 + br() * 26,
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
const cssRgb = (c: RGB, a = 1) => `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${a})`;
const WHITE: RGB = { r: 255, g: 255, b: 255 };
const BLACK: RGB = { r: 0, g: 0, b: 0 };
const INK: RGB = { r: 35, g: 32, b: 27 };

type Look = {
  sky: [string, string, string];
  body: string;
  ring: string;
  glow: string;
  glowA: number;
  layers: { fill: string; fillOp: number; stroke: string; strokeOp: number; sw: number }[];
};

function look(p: AlbumPalette, dark: boolean): Look {
  const v = toRgb(p.vibrant);
  const s = toRgb(p.secondary);
  const d = toRgb(p.deep);
  const glowA = (dark ? 0.16 : 0.14) + p.brightness * (dark ? 0.22 : 0.16);

  if (dark) {
    return {
      sky: [cssRgb(v, 0), cssRgb(mix(v, s, 0.5), 0.05), cssRgb(v, 0.1)],
      body: cssRgb(mix(v, WHITE, 0.5)),
      ring: cssRgb(mix(v, WHITE, 0.72), 0.45),
      glow: cssRgb(mix(v, WHITE, 0.3)),
      glowA,
      layers: [
        { fill: cssRgb(mix(d, BLACK, 0.1)), fillOp: 0.4, stroke: cssRgb(mix(v, WHITE, 0.6)), strokeOp: 0.14, sw: 1 },
        { fill: cssRgb(mix(d, BLACK, 0.28)), fillOp: 0.66, stroke: cssRgb(mix(v, WHITE, 0.5)), strokeOp: 0.2, sw: 1.1 },
        { fill: cssRgb(mix(d, BLACK, 0.48)), fillOp: 0.95, stroke: cssRgb(mix(v, WHITE, 0.74)), strokeOp: 0.3, sw: 1.3 },
      ],
    };
  }
  // light — watercolour washes + inked ridges on paper
  return {
    sky: [cssRgb(v, 0), cssRgb(mix(v, s, 0.5), 0.06), cssRgb(v, 0.11)],
    body: cssRgb(mix(v, WHITE, 0.18)),
    ring: cssRgb(mix(d, INK, 0.3), 0.4),
    glow: cssRgb(v),
    glowA,
    layers: [
      { fill: cssRgb(mix(v, WHITE, 0.58)), fillOp: 0.16, stroke: cssRgb(mix(d, INK, 0.4)), strokeOp: 0.18, sw: 1 },
      { fill: cssRgb(mix(mix(v, s, 0.5), WHITE, 0.25)), fillOp: 0.18, stroke: cssRgb(mix(d, INK, 0.55)), strokeOp: 0.3, sw: 1.2 },
      { fill: cssRgb(mix(d, WHITE, 0.18)), fillOp: 0.2, stroke: cssRgb(mix(d, INK, 0.7)), strokeOp: 0.46, sw: 1.4 },
    ],
  };
}

/* ------------------------------ component ------------------------------ */
export default function SongScape() {
  const { track } = useNowPlayingContext();
  const palette = useAlbumPalette(track?.albumImageUrl || null);

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

  const fingerprint = track ? `${track.title}${track.artist}${track.album}` : "—";
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
  const scape = useMemo(() => makeScape(words, fingerprint), [fingerprint]); // eslint-disable-line react-hooks/exhaustive-deps
  const c = useMemo(() => look(palette, dark), [palette, dark]);

  if (!mounted) return null;

  const ridges = [scape.far, scape.mid, scape.near];

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <svg className="h-full w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" fill="none">
        <AnimatePresence>
          <motion.g
            key={fingerprint}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: "easeInOut" }}
          >
            <defs>
              <linearGradient id={`ss-sky-${scape.uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.sky[0]} />
                <stop offset="62%" stopColor={c.sky[1]} />
                <stop offset="100%" stopColor={c.sky[2]} />
              </linearGradient>
              <radialGradient id={`ss-glow-${scape.uid}`}>
                <stop offset="0%" stopColor={c.glow} stopOpacity={c.glowA} />
                <stop offset="100%" stopColor={c.glow} stopOpacity={0} />
              </radialGradient>
            </defs>

            {/* sky wash near the horizon */}
            <rect x={-OS} y="280" width={W + 2 * OS} height={H - 280} fill={`url(#ss-sky-${scape.uid})`} />

            {/* celestial body — sun by day, moon by night; its glow softly breathes */}
            <circle className="ss-glow-breathe" cx={scape.bodyX} cy={scape.bodyY} r={scape.bodyR * 3.4} fill={`url(#ss-glow-${scape.uid})`} />
            <circle className="ss-body" cx={scape.bodyX} cy={scape.bodyY} r={scape.bodyR} style={{ fill: c.body, fillOpacity: dark ? 0.85 : 0.8 }} />
            <circle cx={scape.bodyX} cy={scape.bodyY} r={scape.bodyR} fill="none" style={{ stroke: c.ring, strokeWidth: 1.2 }} />

            {/* ridges: far → near. Each layer drifts on its own slow timer so the
                range parallaxes with real depth — smooth, never flickering. */}
            {ridges.map((rg, i) => {
              const l = c.layers[i];
              return (
                <g key={i} className={`ss-sway-${i}`}>
                  <path className="ss-fill" d={rg.area} style={{ fill: l.fill, fillOpacity: l.fillOp }} />
                  <polyline
                    className="ss-stroke"
                    points={rg.top}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ stroke: l.stroke, strokeOpacity: l.strokeOp, strokeWidth: l.sw }}
                  />
                </g>
              );
            })}
          </motion.g>
        </AnimatePresence>
      </svg>
    </div>
  );
}
