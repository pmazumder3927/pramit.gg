"use client";

import { motion, useReducedMotion } from "motion/react";

// The two reel windows of the cassette, joined by a length of tape. The reels
// turn ONLY while a real preview clip is playing — that's the sole playback
// indicator (no audio-viz bars). Pure stroked SVG, deliberately slightly
// imperfect (the two reels turn at different rates).
export default function CassetteReels({ spinning = false }: { spinning?: boolean }) {
  const reduce = useReducedMotion();
  const turning = spinning && !reduce;

  const ink = "rgb(var(--fg) / 0.5)";
  const inkFaint = "rgb(var(--fg) / 0.22)";

  const reel = (cx: number, durations: number) => (
    <g>
      <circle cx={cx} cy={28} r={15} stroke={ink} strokeWidth={2} fill="none" />
      <motion.g
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        animate={turning ? { rotate: 360 } : { rotate: 0 }}
        transition={
          turning
            ? { repeat: Infinity, ease: "linear", duration: durations }
            : { duration: 0.3 }
        }
      >
        <circle cx={cx} cy={28} r={4.5} stroke={ink} strokeWidth={2} fill="none" />
        {[0, 60, 120, 180, 240, 300].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <line
              key={deg}
              x1={cx + Math.cos(rad) * 5.5}
              y1={28 + Math.sin(rad) * 5.5}
              x2={cx + Math.cos(rad) * 13}
              y2={28 + Math.sin(rad) * 13}
              stroke={inkFaint}
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          );
        })}
      </motion.g>
    </g>
  );

  return (
    <svg
      viewBox="0 0 150 56"
      className="h-9 w-auto"
      fill="none"
      aria-hidden
      preserveAspectRatio="xMidYMid meet"
    >
      {/* the tape spanning the two reels */}
      <path
        d="M30 24 C 55 18, 95 18, 120 24"
        stroke={inkFaint}
        strokeWidth={2}
        strokeLinecap="round"
      />
      {reel(30, 2.6)}
      {reel(120, 3.1)}
    </svg>
  );
}
