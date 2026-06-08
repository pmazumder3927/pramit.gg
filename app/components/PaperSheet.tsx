"use client";

// The GROUND the doodle-scape rests on — "Deckle": the doodles are inked onto a
// real sheet of handmade paper pulled from a drawer. Per song the sheet gets its
// own watermark + foxing (age spots) so each track is a different sheet; the
// album's colour faintly tints the watermark (the song "pressed into the paper").
// Pure CSS layers + one static turbulence tile — no masks, no blend, no per-frame
// JS, so it never flickers. Sits behind SongScapeInk, above the corner washes.

import { useEffect, useMemo, useState } from "react";
import { useNowPlayingContext } from "./NowPlayingContext";
import { useAlbumPalette } from "@/app/lib/use-album-palette";

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
const toRgb = (h: string) => {
  const n = parseInt(h.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};
const mix = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, t: number) => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
});
const rgba = (c: { r: number; g: number; b: number }, a: number) =>
  `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${a})`;

// fine paper "tooth" (fiber grain) as a static, tiling turbulence — black specks
// for light paper, white specks for night paper. Rendered once by the browser.
const tooth = (white: boolean) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 ${white ? 1 : 0} 0 0 0 0 ${white ? 1 : 0} 0 0 0 0 ${white ? 1 : 0} 0.55 0.55 0.55 0 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`
  )}")`;

export default function PaperSheet() {
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

  const songKey = track ? track.trackId || `${track.title}${track.artist}${track.album}` : "—";
  // per-song sheet: a watermark position + a scatter of foxing/age spots
  const { wmx, wmy, fox } = useMemo(() => {
    const rand = mkRand(fnv(songKey));
    return {
      wmx: 30 + rand() * 40, // central-ish band
      wmy: 26 + rand() * 46,
      fox: Array.from({ length: 4 }, () => ({ x: 7 + rand() * 86, y: 7 + rand() * 86, r: 0.8 + rand() * 1.3 })),
    };
  }, [songKey]);

  if (!mounted) return null;

  // the watermark carries a whisper of the song's colour. dark = "pressed into
  // black paper": a DEEP album tint (mixed toward near-black), barely there, so it
  // never lifts the floor to grey. light = a soft warm bloom.
  const wmCol = dark
    ? rgba(mix(toRgb(palette.vibrant), { r: 30, g: 28, b: 44 }, 0.55), 0.05)
    : rgba(mix({ r: 255, g: 255, b: 255 }, toRgb(palette.vibrant), 0.12), 0.06);
  const foxCol = dark ? "rgba(96,90,120,0.035)" : "rgba(120,82,42,0.06)";
  const marks = [
    `radial-gradient(42% 38% at ${wmx.toFixed(1)}% ${wmy.toFixed(1)}%, ${wmCol} 0%, transparent 62%)`,
    ...fox.map(
      (f) =>
        `radial-gradient(${f.r.toFixed(2)}% ${(f.r * 1.7).toFixed(2)}% at ${f.x.toFixed(1)}% ${f.y.toFixed(1)}%, ${foxCol} 0%, transparent 72%)`
    ),
  ].join(",");

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="paper-tooth absolute inset-0" style={{ backgroundImage: tooth(dark) }} />
      <div className="paper-laid absolute inset-0" />
      <div className="paper-marks absolute inset-0" style={{ backgroundImage: marks }} />
      <div className="paper-vignette absolute inset-0" />
    </div>
  );
}
