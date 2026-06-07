"use client";

import { useEffect, useState } from "react";

// A richer cousin of use-album-color: instead of a single dominant hex, it
// pulls a small palette (vibrant + secondary + deep + light) plus overall
// brightness/saturation, so a backdrop can be themed from the album art.
export interface AlbumPalette {
  vibrant: string; // dominant saturated hue
  secondary: string; // a distinct second hue (or a tint of vibrant)
  deep: string; // darkest meaningful colour — silhouettes / ink
  light: string; // brightest meaningful colour — highlights
  brightness: number; // 0..1 average luma
  saturation: number; // 0..1 average saturation
}

export const DEFAULT_PALETTE: AlbumPalette = {
  vibrant: "#ff6b3d",
  secondary: "#5b56a8",
  deep: "#2a1a12",
  light: "#ffd9c4",
  brightness: 0.5,
  saturation: 0.55,
};

const cache = new Map<string, AlbumPalette>();

function hex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function extract(img: HTMLImageElement): AlbumPalette {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return DEFAULT_PALETTE;

  const N = 48;
  canvas.width = N;
  canvas.height = N;
  ctx.drawImage(img, 0, 0, N, N);
  const data = ctx.getImageData(0, 0, N, N).data;

  const BINS = 12;
  const binW = new Array(BINS).fill(0);
  const binR = new Array(BINS).fill(0);
  const binG = new Array(BINS).fill(0);
  const binB = new Array(BINS).fill(0);

  let sumLuma = 0;
  let sumSat = 0;
  let count = 0;
  let dark = { l: 2, r: 0, g: 0, b: 0 };
  let lite = { l: -1, r: 0, g: 0, b: 0 };

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (data[i + 3] < 128) continue;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const sat = max === 0 ? 0 : delta / max;

    sumLuma += luma;
    sumSat += sat;
    count++;

    let h = 0;
    if (delta !== 0) {
      if (max === r) h = ((g - b) / delta) % 6;
      else if (max === g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    const bin = Math.min(BINS - 1, Math.floor((h / 360) * BINS));
    // weight prefers saturated, mid-luminance pixels (true "colour")
    const w = sat * Math.max(0, 1 - Math.abs(luma - 0.55) / 0.55);
    binW[bin] += w;
    binR[bin] += r * w;
    binG[bin] += g * w;
    binB[bin] += b * w;

    if (luma > 0.05 && luma < dark.l) dark = { l: luma, r, g, b };
    if (luma < 0.96 && luma > lite.l) lite = { l: luma, r, g, b };
  }

  if (count === 0) return DEFAULT_PALETTE;

  // vibrant = heaviest hue bin
  let b1 = 0;
  for (let b = 1; b < BINS; b++) if (binW[b] > binW[b1]) b1 = b;
  const vib =
    binW[b1] > 0
      ? { r: binR[b1] / binW[b1], g: binG[b1] / binW[b1], b: binB[b1] / binW[b1] }
      : { r: lite.r, g: lite.g, b: lite.b };

  // secondary = heaviest bin at least 2 steps (60°) away from vibrant
  let b2 = -1;
  for (let b = 0; b < BINS; b++) {
    const dist = Math.min(Math.abs(b - b1), BINS - Math.abs(b - b1));
    if (dist >= 2 && (b2 < 0 || binW[b] > binW[b2])) b2 = b;
  }
  const sec =
    b2 >= 0 && binW[b2] > 0
      ? { r: binR[b2] / binW[b2], g: binG[b2] / binW[b2], b: binB[b2] / binW[b2] }
      : { r: vib.r * 0.7 + 60, g: vib.g * 0.7 + 50, b: vib.b * 0.7 + 90 };

  return {
    vibrant: hex(vib.r, vib.g, vib.b),
    secondary: hex(sec.r, sec.g, sec.b),
    deep: dark.l < 2 ? hex(dark.r, dark.g, dark.b) : hex(vib.r * 0.4, vib.g * 0.4, vib.b * 0.4),
    light: lite.l >= 0 ? hex(lite.r, lite.g, lite.b) : hex(vib.r, vib.g, vib.b),
    brightness: sumLuma / count,
    saturation: sumSat / count,
  };
}

export function useAlbumPalette(imageUrl: string | null): AlbumPalette {
  const [palette, setPalette] = useState<AlbumPalette>(DEFAULT_PALETTE);

  useEffect(() => {
    if (!imageUrl) {
      setPalette(DEFAULT_PALETTE);
      return;
    }
    if (cache.has(imageUrl)) {
      setPalette(cache.get(imageUrl)!);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const p = extract(img);
        cache.set(imageUrl, p);
        setPalette(p);
      } catch {
        setPalette(DEFAULT_PALETTE);
      }
    };
    img.onerror = () => setPalette(DEFAULT_PALETTE);
    img.src = imageUrl;
  }, [imageUrl]);

  return palette;
}
