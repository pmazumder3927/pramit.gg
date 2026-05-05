"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import {
  DRAWING_CANVAS_HEIGHT,
  DRAWING_CANVAS_WIDTH,
  type DrawingStroke,
} from "@/app/lib/confessional-captcha";

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

type DrawingRecord = {
  id: string;
  strokes: DrawingStroke[];
  prompt: string | null;
  created_at: string;
};

type GalleryResponse = {
  turtles: DrawingRecord[];
};

export default function TurtleGallery() {
  const [drawings, setDrawings] = useState<DrawingRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/turtles", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load drawings.");
      }

      const data = (await response.json()) as GalleryResponse;
      setDrawings(data.turtles);
      setError(null);
    } catch (loadError) {
      console.error("Gallery load error:", loadError);
      setError("the gallery is hiding. try again in a moment.");
    }
  }, []);

  useEffect(() => {
    void load();

    // ConfessionalBooth dispatches this after a successful submission so the
    // freshly drawn sketch shows up without a page reload.
    const handleNew = () => {
      void load();
    };

    window.addEventListener("turtle:new", handleNew);
    return () => window.removeEventListener("turtle:new", handleNew);
  }, [load]);

  return (
    <div className="relative">
      <div className="absolute top-0 left-0 w-8 h-px bg-white/10" />
      <div className="absolute top-0 left-0 w-px h-8 bg-white/10" />
      <div className="absolute bottom-0 right-0 w-8 h-px bg-white/10" />
      <div className="absolute bottom-0 right-0 w-px h-8 bg-white/10" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <h2 className="text-2xl md:text-3xl font-extralight text-white/80 mb-2">
          the drawing gallery
        </h2>
        <p className="text-white/40 font-light text-sm max-w-md mx-auto">
          every confession comes with a sketch. these are theirs.
        </p>
      </motion.div>

      {error ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/5 p-5 text-center text-sm font-light text-rose-100/80">
          {error}
        </div>
      ) : drawings === null ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm font-light text-white/40">
          gathering drawings...
        </div>
      ) : drawings.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm font-light text-white/40">
          nothing here yet. be the first.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {drawings.map((drawing, index) => (
            <motion.div
              key={drawing.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: Math.min(index * 0.03, 0.4),
              }}
              className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-2 transition-colors duration-300 hover:border-white/15 hover:bg-white/[0.04]"
            >
              <DrawingSvg drawing={drawing} />
              <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[10px] font-light text-white/40">
                <span className="truncate">
                  {drawing.prompt ?? "a turtle"}
                </span>
                <span className="text-white/25 tabular-nums">
                  {formatDate(drawing.created_at)}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function DrawingSvg({ drawing }: { drawing: DrawingRecord }) {
  // Old turtle records were drawn on a 320x220 canvas with no per-stroke color;
  // detect by absence of stored prompt and fall back to the legacy palette.
  const isLegacy = drawing.prompt === null;
  const width = isLegacy ? LEGACY_CANVAS_WIDTH : DRAWING_CANVAS_WIDTH;
  const height = isLegacy ? LEGACY_CANVAS_HEIGHT : DRAWING_CANVAS_HEIGHT;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full rounded-lg bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.04),_transparent_60%)]"
      style={{ aspectRatio: `${width} / ${height}` }}
      preserveAspectRatio="xMidYMid meet"
    >
      {drawing.strokes.map((stroke, index) => {
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
      })}
    </svg>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
