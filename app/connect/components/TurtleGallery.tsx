"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import {
  TURTLE_CANVAS_HEIGHT,
  TURTLE_CANVAS_WIDTH,
  type TurtleStroke,
} from "@/app/lib/confessional-captcha";

const STROKE_COLORS = [
  "#f2d1b0",
  "#b9ddff",
  "#b7ffca",
  "#f8a4c8",
  "#ffe28a",
  "#d0c0ff",
  "#9df4f2",
];

type TurtleRecord = {
  id: string;
  strokes: TurtleStroke[];
  created_at: string;
};

type GalleryResponse = {
  turtles: TurtleRecord[];
};

export default function TurtleGallery() {
  const [turtles, setTurtles] = useState<TurtleRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/turtles", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load turtles.");
      }

      const data = (await response.json()) as GalleryResponse;
      setTurtles(data.turtles);
      setError(null);
    } catch (loadError) {
      console.error("Gallery load error:", loadError);
      setError("the turtles are hiding. try again in a moment.");
    }
  }, []);

  useEffect(() => {
    void load();

    // ConfessionalBooth dispatches this after a successful submission so the
    // freshly drawn turtle shows up without a page reload.
    const handleNewTurtle = () => {
      void load();
    };

    window.addEventListener("turtle:new", handleNewTurtle);
    return () => window.removeEventListener("turtle:new", handleNewTurtle);
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
          the turtle gallery
        </h2>
        <p className="text-white/40 font-light text-sm max-w-md mx-auto">
          every confession leaves a turtle behind. these are theirs.
        </p>
      </motion.div>

      {error ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/5 p-5 text-center text-sm font-light text-rose-100/80">
          {error}
        </div>
      ) : turtles === null ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm font-light text-white/40">
          gathering turtles...
        </div>
      ) : turtles.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm font-light text-white/40">
          no turtles yet. be the first.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {turtles.map((turtle, index) => (
            <motion.div
              key={turtle.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: Math.min(index * 0.03, 0.4),
              }}
              className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-2 transition-colors duration-300 hover:border-white/15 hover:bg-white/[0.04]"
            >
              <TurtleSvg strokes={turtle.strokes} />
              <p className="mt-1 text-[10px] font-light text-white/25 text-center tabular-nums">
                {formatDate(turtle.created_at)}
              </p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function TurtleSvg({ strokes }: { strokes: TurtleStroke[] }) {
  return (
    <svg
      viewBox={`0 0 ${TURTLE_CANVAS_WIDTH} ${TURTLE_CANVAS_HEIGHT}`}
      className="w-full aspect-[320/220] rounded-lg bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.04),_transparent_60%)]"
      preserveAspectRatio="xMidYMid meet"
    >
      {strokes.map((stroke, index) => {
        const color = STROKE_COLORS[index] ?? "#ffffff";
        const path = strokeToPath(stroke);
        if (!path) {
          return null;
        }

        return (
          <path
            key={index}
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

function strokeToPath(stroke: TurtleStroke) {
  const points = Array.isArray(stroke?.points) ? stroke.points : [];
  if (points.length === 0) {
    return null;
  }

  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    })
    .join(" ");
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
