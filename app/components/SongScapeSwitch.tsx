"use client";

// Chooses which now-playing backdrop renders. Default is the mountain SongScape.
// Visit any page with ?scape=ink to switch to the Sumi-no-Mizu (ink) variant
// (the choice is remembered in localStorage); ?scape=mountain reverts.
import { useEffect, useState } from "react";
import SongScape from "./SongScape";
import SongScapeInk from "./SongScapeInk";

type Variant = "mountain" | "ink";

export default function SongScapeSwitch() {
  const [variant, setVariant] = useState<Variant | null>(null);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("scape");
      if (q === "ink" || q === "mountain") localStorage.setItem("scape", q);
      const v = localStorage.getItem("scape");
      setVariant(v === "ink" ? "ink" : "mountain");
    } catch {
      setVariant("mountain");
    }
  }, []);

  if (variant === null) return null; // both variants also no-op until mounted
  return variant === "ink" ? <SongScapeInk /> : <SongScape />;
}
