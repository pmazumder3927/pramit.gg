"use client";

// Songscape · a scape made entirely of people's DOODLES from the confessional
// booth. Each visitor who confesses also draws the captcha; those drawings
// (`turtle_drawings`, fetched from /api/turtles) are re-inked here and scattered
// across the page as a quiet constellation of strangers' sketches.
//   · source  : real submitted strokes (480×320 canvas) → scaled into slots
//               across the canvas (some mid, some margin; lighter in the centre).
//   · ink     : each doodle is re-coloured in the now-playing palette (warm/cool
//               poles = orange/purple). light = dark ink on paper; dark = aglow.
//   · written : the scape assembles by "writing" each doodle in, line by line,
//               via stroke-dashoffset (pure CSS — no masks/blend, so no flicker).
//   · scroll  : each doodle swirls (rotate/parallax) as ONE unit by a smoothed
//               scroll progress; the whole piece sways gently; a different set of
//               doodles is chosen per song.

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { useNowPlayingContext } from "./NowPlayingContext";
import { useAlbumPalette, AlbumPalette, GRID } from "@/app/lib/use-album-palette";
import type { DrawingStroke } from "@/app/lib/drawing/types";
import { useLyrics } from "./useLyrics";
import SongScapeLyrics from "./SongScapeLyrics";
import { type Box, collectForeground, boxesOverlap } from "@/app/lib/scape-layout";

const W = 1600;
const H = 900;
const SKETCH_CANVAS_W = 480; // the confessional booth's drawing canvas
const SKETCH_CANVAS_H = 320;

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
const clamp255 = (n: number) => Math.max(0, Math.min(255, n));
const luma = (c: RGB) => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
const ORANGE = toRgb("#ff6b3d"); // grandpa's sunset — the warm pole
const PURPLE = toRgb("#7c77c6"); // first crush's flower — the cool pole
const INK: RGB = { r: 20, g: 17, b: 14 }; // near-black ink for paper mode
const NIGHT_LUMA = 108; // doodles pinned this dark — visible on near-black, never a wash

// the doodle's hue, biased toward the warm (orange) / cool (purple) poles
function dropHue(p: AlbumPalette, warmth: number): RGB {
  const warm = mix(toRgb(p.vibrant), ORANGE, 0.22);
  const cool = mix(toRgb(p.secondary), PURPLE, 0.3);
  return mix(cool, warm, (warmth + 1) / 2);
}
// light = near-black hue-tinted ink on paper.
// dark = "blacklight ink": the same hue SATURATED into a deep electric pigment,
// then pinned to a low luminance. The colour lives in the stroke itself (no glow,
// no light layer), so the line reads vivid on near-black while the page stays
// genuinely dark — many lines can never sum into a bright wash.
function inkColor(p: AlbumPalette, dark: boolean, hue: RGB): RGB {
  if (!dark) return mix(INK, hue, 0.34);
  const l0 = luma(hue) || 1;
  const sat = {
    r: clamp255(l0 + (hue.r - l0) * 1.85),
    g: clamp255(l0 + (hue.g - l0) * 1.85),
    b: clamp255(l0 + (hue.b - l0) * 1.85),
  };
  const k = NIGHT_LUMA / (luma(sat) || 1);
  return { r: clamp255(sat.r * k), g: clamp255(sat.g * k), b: clamp255(sat.b * k) };
}

/* ------------------------------ geometry ------------------------------- */
type Hair = { d: string; op: number; sw: number; t0: number; t1: number }; // t0/t1 = write-in span
type Stroke = {
  hairs: Hair[]; // the doodle's brush lines
  warmth: number; // 1 = warm, -1 = cool
  ox: number; // centroid — scroll-swirl rotates around it
  oy: number;
  sdir: number; // scroll-swirl rotation direction/magnitude
  depth: number; // scroll parallax depth
  wt: number; // write-in duration (s)
  dim: number; // opacity multiplier (doodles near the reading centre are dimmer)
  bbox: { x0: number; y0: number; x1: number; y1: number }; // extent (lyrics avoid it)
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const r1 = (v: number) => Math.round(v * 10) / 10;
const poly = (p: [number, number][]) => "M" + p.map((q) => `${r1(q[0])} ${r1(q[1])}`).join("L");

function norms(C: [number, number][]): [number, number][] {
  const N = C.length;
  const nm: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const pa = C[Math.max(0, i - 1)];
    const pb = C[Math.min(N - 1, i + 1)];
    const tx = pb[0] - pa[0];
    const ty = pb[1] - pa[1];
    const ln = Math.hypot(tx, ty) || 1;
    nm.push([-ty / ln, tx / ln]);
  }
  return nm;
}

// thin at the ends, fuller in the middle → a brushed (calligraphic) weight
const widthProf = (t: number) => 0.3 + 0.7 * Math.pow(Math.sin(Math.PI * clamp01(t)), 0.4);

// one doodle stroke (its mapped points = centreline) → a small dry-brush bundle:
// a dense central spine + a couple of frayed dry edges. Stroked paths, so each
// still writes in via stroke-dashoffset.
function brushHairs(C: [number, number][], wMax: number, rand: () => number): { d: string; op: number; sw: number }[] {
  if (C.length < 2) {
    const a = C[0] || [0, 0];
    return [{ d: `M${r1(a[0])} ${r1(a[1])}L${r1(a[0] + 0.8)} ${r1(a[1] + 0.8)}`, op: 0.55, sw: Math.max(1.5, wMax * 0.6) }];
  }
  const nm = norms(C);
  const K = Math.max(2, Math.min(5, Math.round(wMax / 2)));
  const offs = K === 1 ? [0] : Array.from({ length: K }, (_, i) => (i / (K - 1)) * 2 - 1);
  const out: { d: string; op: number; sw: number }[] = [];
  for (const o of offs) {
    const central = Math.abs(o) < 0.35;
    const sw = central ? Math.max(1.4, wMax * 0.45) : 1.0 + rand() * 0.7;
    const op = central ? 0.62 : 0.4;
    const lift = !central && rand() < 0.5 ? 0.68 + rand() * 0.27 : 1; // dry edge lifts early
    const pts: [number, number][] = [];
    for (let i = 0; i < C.length; i++) {
      const t = i / (C.length - 1);
      if (t > lift) break;
      const w = widthProf(t) * wMax;
      pts.push([C[i][0] + nm[i][0] * o * w / 2, C[i][1] + nm[i][1] * o * w / 2]);
    }
    if (pts.length > 1) out.push({ d: poly(pts), op, sw });
  }
  return out;
}

// re-ink one drawing into a box centred at (cx,cy): brush each stroke, give each
// stroke a write-in span (strokes draw in order), find the centroid for swirl.
function buildSketchAt(
  strokes: DrawingStroke[], cx: number, cy: number, box: number,
  warmth: number, sdir: number, depth: number, dim: number, seedStr: string
): Stroke | null {
  const lines = (strokes || []).filter((s) => Array.isArray(s?.points) && s.points.length >= 1);
  if (!lines.length) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of lines) {
    for (const p of s.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (!Number.isFinite(minX)) return null;
  const bw = maxX - minX || SKETCH_CANVAS_W;
  const bh = maxY - minY || SKETCH_CANVAS_H;
  const scale = Math.min(box / bw, box / bh);
  const map = (p: { x: number; y: number }): [number, number] => [
    (p.x - minX - bw / 2) * scale + cx,
    (p.y - minY - bh / 2) * scale + cy,
  ];

  const rand = mkRand(fnv(seedStr));
  const M = lines.length;
  const hairs: Hair[] = [];
  lines.forEach((s, j) => {
    const pts = s.points;
    const step = pts.length > 48 ? 2 : 1; // decimate dense strokes
    const C: [number, number][] = [];
    for (let i = 0; i < pts.length; i += step) C.push(map(pts[i]));
    if (C.length && (pts.length - 1) % step !== 0) C.push(map(pts[pts.length - 1]));
    const wMax = Math.max(2, Math.min(8, (s.width ?? 4) * scale * 1.4));
    const sa = (j / M) * 0.88;
    const sb = Math.min(1, sa + 0.18);
    for (const h of brushHairs(C, wMax, rand)) hairs.push({ ...h, t0: sa, t1: sb });
  });
  if (!hairs.length) return null;

  // the inked drawing spans bw*scale × bh*scale centred at (cx,cy); expose it
  // (padded for brush width) so the lyrics layer can avoid drawing over it.
  const halfW = (bw * scale) / 2 + 8;
  const halfH = (bh * scale) / 2 + 8;
  const bbox = { x0: cx - halfW, y0: cy - halfH, x1: cx + halfW, y1: cy + halfH };
  return { hairs, warmth, ox: cx, oy: cy, sdir, depth, wt: 1.3, dim, bbox };
}

// compose the scape: scatter doodles NATURALLY (uneven, hand-placed) via rejection
// sampling with a size-scaled min distance — varied local density, not a grid.
// Doodles near the reading centre shrink + dim, and any that would land on the
// page's content (foreground boxes, view-box space) are rejected so the sketches
// sit in the gaps around the text rather than under it.
function makeScape(sketches: DrawingStroke[][], seedStr: string, foreground: Box[]) {
  const seed = fnv(seedStr);
  if (!sketches.length) return { drops: [] as Stroke[], uid: seed.toString(36) };
  const rand = mkRand(seed);
  const order = sketches.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const n = 6 + Math.floor(rand() * 4); // 6..9 doodles
  const placed: { x: number; y: number; r: number }[] = [];
  const drops: Stroke[] = [];
  let tries = 0;
  while (drops.length < n && tries < n * 60) {
    tries++;
    const x = 0.07 + rand() * 0.86;
    const y = 0.1 + rand() * 0.8;
    const centralness = clamp01(1 - Math.hypot(x - 0.5, (y - 0.5) * 1.1) / 0.5); // 0 edge → 1 dead-centre
    const sBase = (0.12 + rand() * 0.23) * (1 - 0.45 * centralness); // wide variance; smaller in the middle
    const rr = sBase * 0.58; // collision radius (allows some closeness → natural)
    let ok = true;
    for (const p of placed) {
      if (Math.hypot(x - p.x, y - p.y) < (rr + p.r) * 0.85) { ok = false; break; }
    }
    if (!ok) continue;
    // skip spots that sit on the page's content
    if (foreground.length) {
      const half = (sBase * H) / 2;
      const dbox = { x0: x * W - half, y0: y * H - half, x1: x * W + half, y1: y * H + half };
      if (foreground.some((f) => boxesOverlap(dbox, f))) continue;
    }
    placed.push({ x, y, r: rr });
    const i = drops.length;
    const st = buildSketchAt(
      sketches[order[i % order.length]],
      x * W, y * H, sBase * H,
      i % 2 ? -0.6 : 0.6,
      (i % 2 ? 1 : -1) * (0.7 + rand() * 0.5),
      0.3 + rand() * 0.7,
      1 - 0.4 * centralness, // dim toward the centre
      seedStr + ":" + i
    );
    if (st) drops.push(st);
  }
  return { drops, uid: seed.toString(36) };
}

/* ----------------------------- playhead -------------------------------- */
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

/* ------------------------------ scroll --------------------------------- */
function useScrollSwirl(root: React.RefObject<SVGSVGElement | null>, reduced: boolean | null) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (reduced) {
      el.style.setProperty("--scroll", "0");
      return;
    }
    let target = 0;
    let cur = 0;
    let raf = 0;
    let running = false;
    const measure = () => {
      const denom = Math.max(1, window.innerHeight * 1.3);
      target = Math.min(1, Math.max(0, window.scrollY / denom));
    };
    const loop = () => {
      cur += (target - cur) * 0.1;
      el.style.setProperty("--scroll", cur.toFixed(4));
      if (Math.abs(target - cur) > 0.0005) raf = requestAnimationFrame(loop);
      else running = false;
    };
    const onScroll = () => {
      measure();
      if (!running) {
        running = true;
        raf = requestAnimationFrame(loop);
      }
    };
    measure();
    cur = target;
    el.style.setProperty("--scroll", target.toFixed(4));
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [root, reduced]);
}

/* ------------------------------ sketches ------------------------------- */
// Fetch recent confessional-booth drawings once on mount.
function useSketches(): DrawingStroke[][] {
  const [sketches, setSketches] = useState<DrawingStroke[][]>([]);
  useEffect(() => {
    let alive = true;
    fetch("/api/turtles?limit=40")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data?.turtles) return;
        const out = (data.turtles as { strokes?: DrawingStroke[] }[])
          .map((t) => t.strokes)
          .filter((s): s is DrawingStroke[] => Array.isArray(s) && s.length > 0);
        setSketches(out);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return sketches;
}

/* ------------------------------ motion --------------------------------- */
// Container staggers its doodles. Enter is carried by the per-hair write-in (CSS);
// on song change each OLD doodle lifts away one-by-one (staggered fade + rise)
// while the new ones write themselves in — a graceful hand-off, never a hard cut.
const container: Variants = {
  enter: {},
  show: { transition: { staggerChildren: 0.05 } },
  leave: { transition: { staggerChildren: 0.07, staggerDirection: -1 } },
};
const doodleV: Variants = {
  enter: { opacity: 1, y: 0 },
  show: { opacity: 1, y: 0 },
  leave: { opacity: 0, y: -16, transition: { duration: 0.6, ease: "easeOut" } },
};
const DOODLE_GAP = 0.22; // s between doodles (assembly order); per-doodle write time is `wt`

/* ------------------------------ component ------------------------------ */
export default function SongScapeInk() {
  const { track } = useNowPlayingContext();
  const palette = useAlbumPalette(track?.albumImageUrl || null);
  const reduced = useReducedMotion();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);
  const [foreground, setForeground] = useState<Box[]>([]);

  useEffect(() => {
    setMounted(true);
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // measure the page's content so doodles can be placed in the gaps around it.
  // mount + resize only — NOT scroll: the backdrop is fixed, and re-placing the
  // doodles on every scroll would make them jump. (Sketches load over the network
  // after this runs, so the first doodles already see the foreground — no jump.)
  useEffect(() => {
    const measure = () => setForeground(collectForeground());
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const songKey = track ? track.trackId || `${track.title}${track.artist}${track.album}` : "—";
  const sketches = useSketches();
  const scape = useMemo(
    () => makeScape(sketches, songKey, foreground),
    [songKey, sketches, foreground]
  );

  // the song's words, inked into the scape (synced lines tracked live)
  const lyrics = useLyrics(track);
  const lyricHue = dropHue(palette, 0.15); // gently warm, on-soul
  // lyrics must stay readable above the dark scape, so they keep a pale ink;
  // only the scattered doodles take the deep electric night-ink. (age dim = group opacity)
  const lyricInk = cssRgb(
    dark ? mix(lyricHue, toRgb(palette.light), 0.5) : inkColor(palette, false, lyricHue),
    1
  );
  // doodle extents so the lyrics layer can write AROUND the sketches, not over them
  const doodleBoxes = useMemo(() => scape.drops.map((d) => d.bbox), [scape]);

  useDiffuse(svgRef, track, reduced ?? null);
  useScrollSwirl(svgRef, reduced ?? null);

  if (!mounted) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <svg
        ref={svgRef}
        className="h-full w-full"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        {/* (no light pool in dark mode — additive glow lifts the black point to
            grey, which is the "wash". the paper stays true black; the doodles are
            charcoal/pigment marks ON it.) */}

        {/* the whole piece breathes as ONE (subtle sway) */}
        <g className="ink-sway">
          {/* playhead very gently spreads the ink as the song ages (--t) */}
          <g className="ink-diffuse">
            <AnimatePresence>
              <motion.g key={songKey} variants={container} initial="enter" animate="show" exit="leave">
                {scape.drops.map((d, i) => {
                  // the doodle wears the colour of the cover REGION it sits on,
                  // kept on-soul by blending with the warm/cool pole hue
                  const cell =
                    palette.grid[
                      Math.min(GRID - 1, Math.floor((d.oy / H) * GRID)) * GRID +
                        Math.min(GRID - 1, Math.floor((d.ox / W) * GRID))
                    ];
                  const hue = cell
                    ? mix(dropHue(palette, d.warmth), { r: cell.r, g: cell.g, b: cell.b }, 0.5)
                    : dropHue(palette, d.warmth);
                  const col = inkColor(palette, dark, hue);
                  const start = i * DOODLE_GAP; // assembly order
                  return (
                    // outer = exit lift (Motion); inner = scroll-swirl (CSS) — kept
                    // on separate elements so the two transforms never conflict.
                    <motion.g key={i} variants={doodleV}>
                      <g
                        className="ink-stroke-wrap"
                        style={{
                          "--sdir": d.sdir.toFixed(2),
                          "--depth": d.depth.toFixed(2),
                          transformBox: "view-box",
                          transformOrigin: `${d.ox.toFixed(1)}px ${d.oy.toFixed(1)}px`,
                        } as React.CSSProperties}
                      >
                        <g className="ink-stroke">
                          {d.hairs.map((hr, k) => {
                            const delay = start + hr.t0 * d.wt;
                            const dur = Math.max(0.2, (hr.t1 - hr.t0) * d.wt);
                            return (
                              <path
                                key={k}
                                d={hr.d}
                                pathLength={1}
                                fill="none"
                                stroke={cssRgb(col, hr.op * d.dim * (dark ? 0.92 : 0.96))}
                                strokeWidth={hr.sw}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={reduced ? undefined : "ink-write"}
                                style={
                                  reduced
                                    ? undefined
                                    : ({ "--wdur": `${dur.toFixed(2)}s`, "--wdelay": `${delay.toFixed(2)}s` } as React.CSSProperties)
                                }
                              />
                            );
                          })}
                        </g>
                      </g>
                    </motion.g>
                  );
                })}
              </motion.g>
            </AnimatePresence>
          </g>
        </g>

        {/* the song's words — inked into the scape, tracking the live playhead */}
        {lyrics.synced && (
          <SongScapeLyrics
            track={track}
            trackId={songKey}
            lines={lyrics.lines}
            ink={lyricInk}
            dark={dark}
            reduced={!!reduced}
            doodleBoxes={doodleBoxes}
          />
        )}
      </svg>
    </div>
  );
}
