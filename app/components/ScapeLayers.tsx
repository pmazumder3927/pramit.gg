"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// The heavy scape code (doodles, lyrics, song-change repaint) loads as an
// idle-time chunk so it never competes with first paint or hydration. Nothing
// is lost visually: both layers start empty and write themselves in only once
// their data arrives — same as before, just without the JS on the critical path.
const CoverReveal = dynamic(() => import("./CoverReveal"), { ssr: false });
const SongScapeInk = dynamic(() => import("./SongScapeInk"), { ssr: false });

export default function ScapeLayers() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(() => setReady(true), { timeout: 2000 });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(() => setReady(true), 400);
    return () => clearTimeout(t);
  }, []);

  if (!ready) return null;
  return (
    <>
      {/* song-change repaint — sits BELOW the doodles so they ink on top */}
      <CoverReveal />
      {/* now-playing backdrop — visitors' confessional doodles, inked */}
      <SongScapeInk />
    </>
  );
}
