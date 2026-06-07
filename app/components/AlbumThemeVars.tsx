"use client";

import { useEffect } from "react";
import { useNowPlayingContext } from "./NowPlayingContext";

// Mirrors the current track's dominant album color onto a global CSS variable
// (`--album-rgb`, an "r g b" triplet) so parts of the site can tint themselves
// to whatever is playing — like the old aurora did, but theme-agnostic.
function hexTriplet(hex: string): string | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export default function AlbumThemeVars() {
  const { albumColor } = useNowPlayingContext();

  useEffect(() => {
    const t = hexTriplet(albumColor);
    if (t) document.documentElement.style.setProperty("--album-rgb", t);
  }, [albumColor]);

  return null;
}
