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

// Doodles are saved as transparent PNGs (strokes only, no baked background). The
// confessional canvas is theme-aware: a light visitor draws DARK ink on warm
// paper, a dark visitor draws LIGHT ink on the inky tablet. Since the snapshot
// carries no ground, we have to supply one — and a single fixed ground makes one
// of those two cases nearly invisible (dark ink on a dark tablet). So we pick the
// ground per tile from the strokes' own colors: light ink → dark tablet, dark ink
// → warm paper. The transparent ink then always lands on a contrasting surface,
// mirroring the paper it was drawn on. Both grounds live in the site's palette.
const GROUNDS = {
  // Inky "offering tablet" — for light ink. Keeps the warm ember glow + a faint
  // light inner edge for depth.
  dark: {
    lum: relativeLuminance("#1a1410"),
    className:
      "bg-[#1a1410] bg-[radial-gradient(circle_at_top,_rgba(255,180,120,0.06),_transparent_60%)]",
    ring: "ring-white/5",
  },
  // Warm sketchbook paper — for dark ink. Subtle dark vignette + dark inner edge.
  light: {
    lum: relativeLuminance("#f3ece0"),
    className:
      "bg-[#f3ece0] bg-[radial-gradient(circle_at_bottom,_rgba(120,90,60,0.08),_transparent_60%)]",
    ring: "ring-black/10",
  },
} as const;

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

  const ground = pickGround(strokes, isLegacy);

  return (
    <div
      className={`relative aspect-[3/2] overflow-hidden rounded-md ${ground.className} ${className}`}
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
        className={`pointer-events-none absolute inset-0 rounded-md ring-1 ring-inset ${ground.ring}`}
      />
    </div>
  );
}

/**
 * Choose the tile ground (dark tablet vs warm paper) that best contrasts the
 * doodle's ink, so transparent strokes stay legible wherever they were drawn.
 *
 * For each candidate ground we sum |L(ink) − L(ground)| weighted by how much of
 * that ink is on the page (path length × width), then keep the higher-contrast
 * ground. This naturally handles mixed drawings: the surface that makes the most
 * ink readable wins. Legacy rows (light pastel inks) fall straight to the dark
 * tablet they were always shown on.
 */
function pickGround(
  strokes: DrawingStroke[] | null | undefined,
  isLegacy: boolean,
): (typeof GROUNDS)[keyof typeof GROUNDS] {
  if (isLegacy) return GROUNDS.dark;

  let darkScore = 0;
  let lightScore = 0;
  for (const stroke of strokes ?? []) {
    const points = Array.isArray(stroke?.points) ? stroke.points : [];
    if (points.length === 0) continue;
    const lum = relativeLuminance(stroke.color ?? "#f5f5f5");
    const weight = inkCoverage(points) * (stroke.width ?? 5);
    darkScore += weight * Math.abs(lum - GROUNDS.dark.lum);
    lightScore += weight * Math.abs(lum - GROUNDS.light.lum);
  }

  // No usable strokes (e.g. a snapshot-only row): keep the historical default.
  if (darkScore === 0 && lightScore === 0) return GROUNDS.dark;
  return lightScore > darkScore ? GROUNDS.light : GROUNDS.dark;
}

// Rough amount of ink laid down: polyline length, with a floor so a single dot
// or tiny mark still counts.
function inkCoverage(points: DrawingStroke["points"]): number {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    length += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y,
    );
  }
  return Math.max(length, 2);
}

// WCAG relative luminance from a #rgb / #rrggbb hex; mid-grey for anything else.
function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0.5;
  const lin = (channel: number) => {
    const v = channel / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  let body = match[1];
  if (body.length === 3) {
    body = body[0] + body[0] + body[1] + body[1] + body[2] + body[2];
  }
  return {
    r: parseInt(body.slice(0, 2), 16),
    g: parseInt(body.slice(2, 4), 16),
    b: parseInt(body.slice(4, 6), 16),
  };
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
