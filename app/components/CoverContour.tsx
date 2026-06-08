"use client";

// The now-playing reflection, drawn in the site's OWN medium — INK LINE. The album
// cover is turned into a contour drawing: iso-luminance lines (marching squares over
// the cover's brightness) trace its forms as flowing nested curves, so the record
// reads as one more ink drawing among the visitors' doodles — same hand, same paper.
// No dots, no gradient, no photo. Crisp vector strokes, tinted by the album, that
// cross-develop on song change. Computed once per song (cover sampled on a tiny
// canvas → marching squares → one SVG path). Flicker-safe.

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNowPlayingContext } from "./NowPlayingContext";
import { useAlbumPalette } from "@/app/lib/use-album-palette";

const W = 1600;
const H = 900;
const COLS = 112;
const ROWS = Math.round((COLS * H) / W); // ~63
const LEVELS = [0.32, 0.5, 0.68, 0.84];

type RGB = { r: number; g: number; b: number };
const toRgb = (h: string): RGB => {
  const n = parseInt(h.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};
const mix = (a: RGB, b: RGB, t: number): RGB => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });
const cssRgb = (c: RGB, a: number) => `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${a})`;
const INK: RGB = { r: 20, g: 17, b: 14 };
const r1 = (v: number) => Math.round(v * 10) / 10;

// luminance grid from the cover, lightly smoothed (so contours flow, not jitter)
function coverGrid(img: HTMLImageElement): Float32Array | null {
  const c = document.createElement("canvas");
  c.width = COLS;
  c.height = ROWS;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, COLS, ROWS);
  let px: Uint8ClampedArray;
  try {
    px = ctx.getImageData(0, 0, COLS, ROWS).data;
  } catch {
    return null; // tainted (CORS)
  }
  const g = new Float32Array(COLS * ROWS);
  for (let i = 0; i < COLS * ROWS; i++) g[i] = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255;
  // two cheap box-blur passes → smooth, readable contours
  const blurred = new Float32Array(COLS * ROWS);
  let src = g;
  let dst = blurred;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        let s = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= COLS || yy >= ROWS) continue;
            s += src[yy * COLS + xx];
            n++;
          }
        }
        dst[y * COLS + x] = s / n;
      }
    }
    const t = src;
    src = dst;
    dst = t;
  }
  return src;
}

// marching squares → one SVG path of iso-luminance contours
function contourPath(grid: Float32Array): string {
  const sx = W / (COLS - 1);
  const sy = H / (ROWS - 1);
  const at = (x: number, y: number) => grid[y * COLS + x];
  let d = "";
  const seg = (ax: number, ay: number, bx: number, by: number) => {
    d += `M${r1(ax * sx)} ${r1(ay * sy)}L${r1(bx * sx)} ${r1(by * sy)}`;
  };
  for (const L of LEVELS) {
    for (let y = 0; y < ROWS - 1; y++) {
      for (let x = 0; x < COLS - 1; x++) {
        const tl = at(x, y);
        const tr = at(x + 1, y);
        const br = at(x + 1, y + 1);
        const bl = at(x, y + 1);
        let idx = 0;
        if (tl > L) idx |= 8;
        if (tr > L) idx |= 4;
        if (br > L) idx |= 2;
        if (bl > L) idx |= 1;
        if (idx === 0 || idx === 15) continue;
        const topX = x + (L - tl) / ((tr - tl) || 1e-6);
        const rightY = y + (L - tr) / ((br - tr) || 1e-6);
        const botX = x + (L - bl) / ((br - bl) || 1e-6);
        const leftY = y + (L - tl) / ((bl - tl) || 1e-6);
        switch (idx) {
          case 1: case 14: seg(x, leftY, botX, y + 1); break;
          case 2: case 13: seg(botX, y + 1, x + 1, rightY); break;
          case 3: case 12: seg(x, leftY, x + 1, rightY); break;
          case 4: case 11: seg(topX, y, x + 1, rightY); break;
          case 5: seg(x, leftY, topX, y); seg(botX, y + 1, x + 1, rightY); break;
          case 6: case 9: seg(topX, y, botX, y + 1); break;
          case 7: case 8: seg(x, leftY, topX, y); break;
          case 10: seg(x, leftY, botX, y + 1); seg(topX, y, x + 1, rightY); break;
        }
      }
    }
  }
  return d;
}

export default function CoverContour() {
  const { track } = useNowPlayingContext();
  const palette = useAlbumPalette(track?.albumImageUrl || null);
  const cover = track?.albumImageUrl || null;
  const [dark, setDark] = useState(false);
  const [path, setPath] = useState<{ key: string; d: string } | null>(null);

  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!cover) {
      setPath(null);
      return;
    }
    let alive = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!alive) return;
      const grid = coverGrid(img);
      if (grid) setPath({ key: cover, d: contourPath(grid) });
    };
    img.src = cover;
    return () => {
      alive = false;
    };
  }, [cover]);

  // contour ink: inky+album-tinted on paper; lifted album glow on night
  const vib = toRgb(palette.vibrant);
  const stroke = dark ? cssRgb(mix(vib, toRgb(palette.light), 0.5), 0.3) : cssRgb(mix(INK, vib, 0.45), 0.34);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <svg className="h-full w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" fill="none">
        <AnimatePresence>
          {path && (
            <motion.path
              key={path.key + (dark ? "-d" : "-l")}
              d={path.d}
              stroke={stroke}
              strokeWidth={1.5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4, ease: "easeInOut" }}
            />
          )}
        </AnimatePresence>
      </svg>
    </div>
  );
}
