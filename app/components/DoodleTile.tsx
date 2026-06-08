"use client";

import {
  DRAWING_CANVAS_HEIGHT,
  DRAWING_CANVAS_WIDTH,
  type DrawingStroke,
} from "@/app/lib/confessional-captcha";

// Old turtle records were drawn on a smaller canvas with no per-stroke color.
const LEGACY_CANVAS_WIDTH = 320;
const LEGACY_CANVAS_HEIGHT = 220;

const LEGACY_STROKE_COLORS = [
  "#f2d1b0",
  "#b9ddff",
  "#b7ffca",
  "#f8a4c8",
  "#ffe28a",
  "#d0c0ff",
  "#9df4f2",
];

// Doodles are saved as transparent PNGs (strokes only, no baked background) and
// were drawn on the confessional booth's dark "offering tablet" canvas — light
// ink on #1a1410. We always render them on that same dark ground, independent
// of the site's light/dark theme, so the ink stays legible everywhere and every
// surface (connect, collage) shows the exact same artifact.
const INKPAD_CLASS =
  "bg-[#1a1410] bg-[radial-gradient(circle_at_top,_rgba(255,180,120,0.06),_transparent_60%)]";

export type DoodleTileProps = {
  snapshotUrl?: string | null;
  strokes?: DrawingStroke[] | null;
  prompt?: string | null;
  /** Extra classes for the outer tile (e.g. rounding overrides). */
  className?: string;
};

/**
 * A single doodle rendered on the shared dark inkpad surface. Prefers the
 * pre-rasterized snapshot PNG and falls back to drawing the raw strokes as SVG
 * (used by the connect gallery for legacy rows that predate snapshots).
 */
export default function DoodleTile({
  snapshotUrl,
  strokes,
  prompt,
  className = "",
}: DoodleTileProps) {
  // Legacy rows have no stored prompt and were drawn on the old canvas size.
  const isLegacy = (prompt ?? null) === null;
  const width = isLegacy ? LEGACY_CANVAS_WIDTH : DRAWING_CANVAS_WIDTH;
  const height = isLegacy ? LEGACY_CANVAS_HEIGHT : DRAWING_CANVAS_HEIGHT;

  return (
    <div
      className={`relative aspect-[3/2] overflow-hidden rounded-md ${INKPAD_CLASS} ${className}`}
    >
      {snapshotUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={snapshotUrl}
          alt={prompt ?? "doodle"}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-contain"
        />
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {(strokes ?? []).map((stroke, index) =>
            renderStroke(stroke, index, isLegacy),
          )}
        </svg>
      )}
      {/* faint inner edge for a little depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-md ring-1 ring-inset ring-white/5"
      />
    </div>
  );
}

function renderStroke(stroke: DrawingStroke, index: number, isLegacy: boolean) {
  const points = Array.isArray(stroke?.points) ? stroke.points : [];
  if (points.length === 0) {
    return null;
  }

  const color = isLegacy
    ? LEGACY_STROKE_COLORS[index] ?? "#ffffff"
    : stroke.color ?? "#f5f5f5";
  const strokeWidth = isLegacy ? 4 : stroke.width ?? 5;
  const opacity = isLegacy ? 0.9 : stroke.opacity ?? 0.9;

  if (!isLegacy && stroke.tool === "spray") {
    const r = Math.max(0.6, strokeWidth / 2);
    return (
      <g key={index} opacity={opacity}>
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={r} fill={color} />
        ))}
      </g>
    );
  }

  if (points.length === 1) {
    return (
      <circle
        key={index}
        cx={points[0].x}
        cy={points[0].y}
        r={strokeWidth / 2}
        fill={color}
        opacity={opacity}
      />
    );
  }

  const path = points
    .map((point, i) => {
      const command = i === 0 ? "M" : "L";
      return `${command}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <path
      key={index}
      d={path}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
    />
  );
}
