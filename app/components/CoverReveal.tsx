"use client";

// Song-change repaint — the dramatic hand-off between tracks.
// When the song switches, the NEW album cover is brushed onto the sheet with a
// few broad calligraphic strokes (each revealing a band of the art, staggered &
// alternating so it paints in stroke-by-stroke). That sweep OVERWRITES the old
// songscape (the "wipe"); the cover holds a beat, then washes down into the
// fresh doodle-scape that's been inking in underneath the whole time.
//   · medium : strokes + paper, never a hard rectangular wipe. The reveal mask is
//              a handful of wavy brush strokes whose edges are frayed by a
//              turbulence displacement (dry-brush), and the cover is pressed into
//              the paper (multiply on the day sheet, screen on the night sheet),
//              slightly desaturated — ink-on-paper, not a glossy photo.
//   · written: the mask strokes draw in via stroke-dashoffset (reusing .ink-write),
//              so the reveal shares the songscape's own "writing" gesture.
//   · once   : a one-shot per switch (keyed remount + CSS). Skipped on first load
//              and under reduced-motion. Sits above SongScapeInk in the backdrop.

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { useNowPlayingContext } from "./NowPlayingContext";

const W = 1600;
const H = 900;

// total choreography (s): paint ≈ 0–1.4, hold ≈ 1.4–2.0, wash ≈ 2.0–3.0
const TOTAL_MS = 3000;

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
const r1 = (v: number) => Math.round(v * 10) / 10;
const poly = (p: [number, number][]) => "M" + p.map((q) => `${r1(q[0])} ${r1(q[1])}`).join("L");

/* ---------------------------- brush strokes ---------------------------- */
// A small set of broad horizontal-ish strokes that together cover the frame.
// Each is a gentle wave across the full width; they overlap (1.7× band height)
// so no paper shows through, and reveal in a scattered order — not top-to-bottom.
type RevealStroke = { d: string; sw: number; delay: number; dur: number };

function makeStrokes(seedStr: string): RevealStroke[] {
  const rand = mkRand(fnv(seedStr));
  const N = 7;
  const band = H / N;

  // a scattered reveal order so the cover assembles unevenly (hand-painted)
  const order = Array.from({ length: N }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const strokes: RevealStroke[] = [];
  for (let i = 0; i < N; i++) {
    const cy = (i + 0.5) * band + (rand() - 0.5) * band * 0.3;
    const amp = band * (0.22 + rand() * 0.5);
    const phase = rand() * Math.PI * 2;
    const humps = 1 + Math.floor(rand() * 2); // 1–2 gentle waves across the width
    const dir = i % 2 ? 1 : -1; // alternate sweep direction
    const steps = 18;
    const pts: [number, number][] = [];
    for (let s = 0; s <= steps; s++) {
      const tx = s / steps;
      const along = dir > 0 ? tx : 1 - tx;
      const x = along * W * 1.18 - W * 0.09; // overshoot both edges so caps clear
      const y = cy + Math.sin(phase + tx * Math.PI * humps * 2) * amp;
      pts.push([x, y]);
    }
    const slot = order.indexOf(i);
    strokes.push({
      d: poly(pts),
      sw: band * 1.7,
      delay: (slot / N) * 0.9, // spread the reveal across ~0.9s
      dur: 0.5 + rand() * 0.18,
    });
  }
  return strokes;
}

/* ------------------------------ component ------------------------------ */
export default function CoverReveal() {
  const { track } = useNowPlayingContext();
  const reduced = useReducedMotion();

  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);
  const [active, setActive] = useState<{ url: string; key: string; id: number } | null>(null);

  const prevKey = useRef<string | null>(null);
  const cycle = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const albumUrl = track?.albumImageUrl || null;

  // fire one repaint per genuine track change (skip first paint + no-cover)
  useEffect(() => {
    if (reduced) return;
    if (!songKey || songKey === "—") return;
    if (prevKey.current === null) {
      prevKey.current = songKey; // adopt the first song silently — no intro flash
      return;
    }
    if (songKey === prevKey.current) return;
    prevKey.current = songKey;
    if (!albumUrl) {
      setActive(null);
      return;
    }
    cycle.current += 1;
    const id = cycle.current;
    setActive({ url: albumUrl, key: songKey, id });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setActive((a) => (a && a.id === id ? null : a));
    }, TOTAL_MS);
  }, [songKey, albumUrl, reduced]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const strokes = useMemo(
    () => (active ? makeStrokes(active.key + ":" + active.id) : []),
    [active]
  );

  if (!mounted || reduced || !active) return null;

  const dispScale = (H / 7) * 0.7; // dry-brush fray on the mask edges

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ mixBlendMode: dark ? "screen" : "multiply" }}
    >
      <svg
        key={active.id}
        className="h-full w-full"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          {/* frayed (dry-brush) edges for the reveal strokes */}
          <filter id="cr-ragged" x="-6%" y="-6%" width="112%" height="112%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.011 0.02"
              numOctaves={3}
              seed={fnv(active.key) % 1000}
              result="n"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="n"
              scale={dispScale}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
          {/* press the cover into the paper — a touch desaturated, never glossy */}
          <filter id="cr-paper">
            <feColorMatrix type="saturate" values="0.8" />
          </filter>
          {/* the brush-stroke reveal: strokes draw in via stroke-dashoffset */}
          <mask id={`cr-mask-${active.id}`} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
            <g filter="url(#cr-ragged)">
              {strokes.map((s, i) => (
                <path
                  key={i}
                  d={s.d}
                  pathLength={1}
                  fill="none"
                  stroke="#fff"
                  strokeWidth={s.sw}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ink-write"
                  style={{ "--wdur": `${s.dur.toFixed(2)}s`, "--wdelay": `${s.delay.toFixed(2)}s` } as React.CSSProperties}
                />
              ))}
            </g>
          </mask>
        </defs>

        {/* the cover, painted on then washed down into the new scape */}
        <g className="cover-wash">
          <image
            href={active.url}
            x={0}
            y={0}
            width={W}
            height={H}
            preserveAspectRatio="xMidYMid slice"
            opacity={dark ? 0.9 : 0.95}
            mask={`url(#cr-mask-${active.id})`}
            filter="url(#cr-paper)"
          />
        </g>
      </svg>
    </div>
  );
}
