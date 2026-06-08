"use client";

// The cohesion engine — "Northlight": the whole backdrop is lit by whatever's
// playing. The album cover's actual colour COMPOSITION (a regional grid sampled
// from the art) becomes a soft wash-field at the cover's own positions, blended
// onto the site's orange/purple poles (more cover when the art is vivid, more
// poles when it's muted), with a brighter glow where the cover's light sits.
// Every other layer obeys the same light: it publishes --lx/--ly (light origin)
// so the paper vignette deepens on the shadow side, and the doodles are inked in
// the colour of the cover region they sit on. Pure CSS gradients off cached
// swatches + an opacity cross-develop on song change — no image, no blur, no
// masks/blend → flicker-safe. Sits behind the paper + doodles.

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNowPlayingContext } from "./NowPlayingContext";
import { useAlbumPalette, type AlbumPalette } from "@/app/lib/use-album-palette";

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
const rgba = (c: RGB, a: number) => `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${a.toFixed(3)})`;
const WHITE: RGB = { r: 255, g: 255, b: 255 };
const ORANGE = toRgb("#ff6b3d");
const PURPLE = toRgb("#7c77c6");

// warmth 0 (cool) .. 1 (warm) from hue
function warmth(c: RGB): number {
  const mx = Math.max(c.r, c.g, c.b);
  const mn = Math.min(c.r, c.g, c.b);
  const dl = mx - mn;
  if (dl < 1) return 0.5;
  let h: number;
  if (mx === c.r) h = ((c.g - c.b) / dl) % 6;
  else if (mx === c.g) h = (c.b - c.r) / dl + 2;
  else h = (c.r - c.g) / dl + 4;
  h = h * 60;
  if (h < 0) h += 360;
  return Math.min(1, Math.max(0, 0.5 + 0.5 * Math.cos(((h - 40) * Math.PI) / 180)));
}

// the colour field = each cover cell as a soft radial at its real position, lifted
// to a wash and blended onto the warm/cool poles (poleBias↑ when art is muted)
function buildField(p: AlbumPalette, dark: boolean): string {
  const poleBias = 0.5 - 0.34 * p.saturation; // vivid cover → less pole, more cover
  const base = dark ? 0.17 : 0.14;
  const mood = 0.8 + 0.45 * p.brightness;
  const light = toRgb(p.light);
  const layers: string[] = [];

  // the light source first (under the cells): a brighter pool at the cover's light
  const lit = grade(brightest(p), dark, light, poleBias);
  layers.push(
    `radial-gradient(58% 54% at ${(p.lightX * 100).toFixed(1)}% ${(p.lightY * 100).toFixed(1)}%, ${rgba(lit, base * 1.7 * mood)} 0%, transparent 60%)`
  );

  for (const cell of p.grid) {
    const c = grade(cell, dark, light, poleBias);
    const a = base * (0.22 + 0.78 * cell.sat) * mood; // muted/grey regions contribute little
    if (a < 0.012) continue;
    layers.push(`radial-gradient(46% 44% at ${(cell.x * 100).toFixed(1)}% ${(cell.y * 100).toFixed(1)}%, ${rgba(c, a)} 0%, transparent 56%)`);
  }
  return layers.join(",");
}

// lift a cell colour to a tint (pale on paper, glowing on night) + blend to a pole
function grade(cell: { r: number; g: number; b: number }, dark: boolean, light: RGB, poleBias: number): RGB {
  const raw = { r: cell.r, g: cell.g, b: cell.b };
  const lifted = dark ? mix(raw, light, 0.18) : mix(raw, WHITE, 0.34);
  const pole = warmth(raw) > 0.5 ? ORANGE : PURPLE;
  return mix(lifted, pole, poleBias);
}
function brightest(p: AlbumPalette): { r: number; g: number; b: number } {
  let best = p.grid[0];
  for (const c of p.grid) if (c.lum > best.lum) best = c;
  return best;
}

export default function AlbumLight() {
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

  // publish the light origin so the paper vignette (and anything else) obeys it
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--lx", `${(palette.lightX * 100).toFixed(1)}%`);
    root.setProperty("--ly", `${(palette.lightY * 100).toFixed(1)}%`);
  }, [palette.lightX, palette.lightY]);

  if (!mounted) return null;

  const songKey = track ? track.trackId || `${track.title}${track.artist}${track.album}` : "—";
  const field = buildField(palette, dark);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <AnimatePresence>
        {/* cross-develop: the new song's light fades up as the old fades out */}
        <motion.div
          key={songKey + (dark ? "-d" : "-l")}
          className="absolute inset-0"
          style={{ backgroundImage: field }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: "easeInOut" }}
        />
      </AnimatePresence>
    </div>
  );
}
