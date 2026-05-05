"use client";

import { AnimatePresence, motion, type Variants } from "motion/react";
import { useEffect, useMemo, useState } from "react";

export type Verdict = "judging" | "approve" | "reject";

type CatCouncilProps = {
  verdict: Verdict;
  message?: string;
};

// 12 wide x 16 tall pixel sprite, drawn top-to-bottom.
// Symbols: T = hat tip · H = hat · v = hat brim · *  = hat star accent
//          f = fur     · e = eye · n = nose      · m = mouth
//          .          = transparent
const CAT_SPRITE = [
  "............",
  ".....TT.....",
  "....HHHH....",
  "...HHHHHH...",
  "..HHHHHHHH.*",
  ".HHHHHHHHHH.",
  "vvvvvvvvvvvv",
  "............",
  ".ff......ff.",
  ".ffffffffff.",
  ".ffeffffeff.",
  ".ffffnnffff.",
  ".fffmmmmfff.",
  "..ffffffff..",
  "...ffffff...",
  "............",
];

const SPRITE_COLS = CAT_SPRITE[0].length;
const SPRITE_ROWS = CAT_SPRITE.length;
const CELL = 7;

type Palette = {
  T: string;
  H: string;
  v: string;
  star: string;
  f: string;
  e: string;
  n: string;
  m: string;
  glow: string;
  hatHighlight: string;
};

const CAT_PALETTES: Palette[] = [
  {
    T: "#ffd86b",
    H: "#7a4cd6",
    v: "#3d2470",
    star: "#ffec8a",
    f: "#f4a05a",
    e: "#15101e",
    n: "#ff9aa6",
    m: "#15101e",
    glow: "#ffd36d",
    hatHighlight: "#a87bf2",
  },
  {
    T: "#fff1a8",
    H: "#2f50d6",
    v: "#15276a",
    star: "#fff7c0",
    f: "#1c1924",
    e: "#ffd86b",
    n: "#d49572",
    m: "#0a0810",
    glow: "#9fc5ff",
    hatHighlight: "#5a78ea",
  },
  {
    T: "#ffe6c4",
    H: "#d6443a",
    v: "#7a1f1c",
    star: "#fff0c0",
    f: "#ece9f1",
    e: "#3e6cd0",
    n: "#ff9aa6",
    m: "#5a4046",
    glow: "#f8a4c8",
    hatHighlight: "#f0816d",
  },
];

export default function CatCouncil({ verdict, message }: CatCouncilProps) {
  return (
    <div className="relative flex flex-col items-center">
      <div className="relative flex items-end justify-center gap-3 sm:gap-6">
        {CAT_PALETTES.map((palette, index) => (
          <Cat
            key={index}
            palette={palette}
            verdict={verdict}
            seat={index}
          />
        ))}

        <AnimatePresence>
          {verdict === "approve" && <Sparkles key="sparkles" />}
          {verdict === "reject" && <Disapproval key="disapproval" />}
        </AnimatePresence>
      </div>

      <CouncilCaption verdict={verdict} message={message} />
    </div>
  );
}

function Cat({
  palette,
  verdict,
  seat,
}: {
  palette: Palette;
  verdict: Verdict;
  seat: number;
}) {
  const judgingDelay = seat * 0.18;

  // Each cat ticks through subtle pose changes while judging — head tilts,
  // chin scratches — driven by a counter that advances on an interval.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (verdict !== "judging") {
      return;
    }
    const id = window.setInterval(
      () => setTick((value) => value + 1),
      900 + seat * 220,
    );
    return () => window.clearInterval(id);
  }, [verdict, seat]);

  const headTilt = useMemo(() => {
    if (verdict !== "judging") return 0;
    const cycle = tick % 4;
    return cycle === 0 ? -3 : cycle === 1 ? 0 : cycle === 2 ? 3 : 0;
  }, [tick, verdict]);

  const eyeMode: EyeMode = useMemo(() => {
    if (verdict === "approve") return "wide";
    if (verdict === "reject") return "squint";
    if (verdict === "judging" && tick % 5 === 4) return "blink";
    return "default";
  }, [tick, verdict]);

  const variants: Variants = {
    judging: {
      y: [0, -2, 0, -1, 0],
      rotate: 0,
      transition: {
        duration: 2.4,
        repeat: Infinity,
        ease: "easeInOut",
        delay: judgingDelay,
      },
    },
    approve: {
      y: [0, -10, -6, -10, -6],
      rotate: [0, -4, 4, -4, 0],
      transition: {
        duration: 1.4,
        repeat: Infinity,
        repeatType: "loop",
        delay: judgingDelay * 0.3,
        ease: "easeOut",
      },
    },
    reject: {
      y: [0, 2, 0, 2, 0],
      rotate: [0, -6, 6, -6, 0],
      transition: {
        duration: 0.45,
        repeat: Infinity,
        ease: "easeInOut",
        delay: judgingDelay * 0.3,
      },
    },
  };

  return (
    <motion.div
      className="relative"
      variants={variants}
      animate={verdict}
      style={{
        filter:
          verdict === "reject"
            ? "saturate(0.6) brightness(0.75)"
            : verdict === "approve"
              ? `drop-shadow(0 0 14px ${palette.glow}AA)`
              : `drop-shadow(0 0 8px ${palette.glow}55)`,
      }}
    >
      <motion.div
        animate={{ rotate: headTilt }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{ transformOrigin: "50% 75%" }}
      >
        <CatSprite palette={palette} eyeMode={eyeMode} verdict={verdict} />
      </motion.div>
    </motion.div>
  );
}

type EyeMode = "default" | "blink" | "wide" | "squint";

function CatSprite({
  palette,
  eyeMode,
  verdict,
}: {
  palette: Palette;
  eyeMode: EyeMode;
  verdict: Verdict;
}) {
  const cells: { x: number; y: number; color: string }[] = [];

  for (let row = 0; row < SPRITE_ROWS; row++) {
    const line = CAT_SPRITE[row];
    for (let col = 0; col < SPRITE_COLS; col++) {
      const ch = line[col];
      const color = symbolColor(ch, palette);
      if (color) {
        cells.push({ x: col, y: row, color });
      }
    }
  }

  // Eye overrides: row 11, cols 3 and 7 are eyes ('e') by default. We swap
  // those cells to convey blink/wide/squint expressions.
  const eyeOverrides = eyeShapes(eyeMode, palette, verdict);

  const totalWidth = SPRITE_COLS * CELL;
  const totalHeight = SPRITE_ROWS * CELL;

  return (
    <svg
      width={totalWidth}
      height={totalHeight}
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      shapeRendering="crispEdges"
      className="block"
    >
      {cells.map((cell, index) => {
        const override = eyeOverrides.find(
          (entry) => entry.x === cell.x && entry.y === cell.y,
        );
        if (override?.skip) {
          return null;
        }
        return (
          <rect
            key={index}
            x={cell.x * CELL}
            y={cell.y * CELL}
            width={CELL}
            height={CELL}
            fill={cell.color}
          />
        );
      })}
      {eyeOverrides
        .filter((entry) => entry.fill)
        .map((entry, index) => (
          <rect
            key={`eye-${index}`}
            x={entry.x * CELL}
            y={entry.y * CELL + (entry.yOffset ?? 0)}
            width={CELL}
            height={entry.height ?? CELL}
            fill={entry.fill}
          />
        ))}
    </svg>
  );
}

type EyeOverride = {
  x: number;
  y: number;
  skip?: boolean;
  fill?: string;
  yOffset?: number;
  height?: number;
};

function eyeShapes(
  mode: EyeMode,
  palette: Palette,
  verdict: Verdict,
): EyeOverride[] {
  const eyeRow = 11;
  const eyeCols = [3, 7];

  if (mode === "blink") {
    // Replace eye cells with thin slits at the bottom of the cell.
    return eyeCols.flatMap((col) => [
      { x: col, y: eyeRow, skip: true },
      { x: col, y: eyeRow, fill: palette.e, yOffset: CELL - 2, height: 2 },
    ]);
  }

  if (mode === "wide") {
    // Bigger sparkly eye: extend up one cell.
    return eyeCols.flatMap((col) => [
      { x: col, y: eyeRow, fill: palette.e },
      { x: col, y: eyeRow - 1, fill: palette.e },
    ]);
  }

  if (mode === "squint") {
    // Disapproving squint: short slit centered.
    return eyeCols.flatMap((col) => [
      { x: col, y: eyeRow, skip: true },
      { x: col, y: eyeRow, fill: palette.e, yOffset: CELL / 2 - 1, height: 2 },
    ]);
  }

  // Default: leave the sprite cells in place. Add a sparkle highlight on
  // approve already handled by mode === 'wide'.
  if (verdict === "approve") {
    return eyeCols.map((col) => ({
      x: col,
      y: eyeRow,
      fill: palette.e,
    }));
  }

  return [];
}

function symbolColor(symbol: string, palette: Palette): string | null {
  switch (symbol) {
    case "T":
      return palette.T;
    case "H":
      return palette.H;
    case "v":
      return palette.v;
    case "*":
      return palette.star;
    case "f":
      return palette.f;
    case "e":
      return palette.e;
    case "n":
      return palette.n;
    case "m":
      return palette.m;
    default:
      return null;
  }
}

function Sparkles() {
  const sparkles = Array.from({ length: 14 }, (_, index) => ({
    id: index,
    x: 10 + Math.random() * 80,
    y: 10 + Math.random() * 80,
    delay: Math.random() * 0.6,
    size: 4 + Math.random() * 4,
    color: ["#ffd86b", "#fff7c0", "#b7ffca", "#9fc5ff"][index % 4],
  }));

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 overflow-visible"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {sparkles.map((sparkle) => (
        <motion.span
          key={sparkle.id}
          className="absolute rounded-full"
          style={{
            left: `${sparkle.x}%`,
            top: `${sparkle.y}%`,
            width: sparkle.size,
            height: sparkle.size,
            backgroundColor: sparkle.color,
            boxShadow: `0 0 12px ${sparkle.color}`,
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.3, 1, 1.4, 0.8], opacity: [0, 1, 1, 1, 0] }}
          transition={{
            duration: 1.6,
            delay: sparkle.delay,
            repeat: Infinity,
            repeatDelay: 0.4,
            ease: "easeOut",
          }}
        />
      ))}
    </motion.div>
  );
}

function Disapproval() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {[15, 50, 85].map((left, index) => (
        <motion.span
          key={left}
          className="absolute font-mono text-xl select-none"
          style={{
            left: `${left}%`,
            top: "-12px",
            color: "#f87e8b",
            textShadow: "0 0 8px rgba(248,126,139,0.6)",
          }}
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: [-8, -20, -14], opacity: [0, 1, 0] }}
          transition={{
            duration: 1.2,
            delay: index * 0.2,
            repeat: Infinity,
            repeatDelay: 0.4,
            ease: "easeOut",
          }}
        >
          ✗
        </motion.span>
      ))}
    </motion.div>
  );
}

function CouncilCaption({
  verdict,
  message,
}: {
  verdict: Verdict;
  message?: string;
}) {
  const [dotCount, setDotCount] = useState(0);

  useEffect(() => {
    if (verdict !== "judging") {
      return;
    }
    const id = window.setInterval(() => {
      setDotCount((value) => (value + 1) % 4);
    }, 450);
    return () => window.clearInterval(id);
  }, [verdict]);

  if (verdict === "judging") {
    return (
      <p className="mt-5 text-sm font-light text-white/55 tracking-wide">
        the council is deliberating{".".repeat(dotCount)}
        <span className="opacity-0">{".".repeat(3 - dotCount)}</span>
      </p>
    );
  }

  if (verdict === "approve") {
    return (
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-5 text-sm font-light tracking-wide text-emerald-200/80"
      >
        the council is satisfied. {message ?? "your message has been received."}
      </motion.p>
    );
  }

  return (
    <motion.p
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-5 max-w-md text-center text-sm font-light tracking-wide text-rose-200/80"
    >
      {message ?? "the council is unconvinced."}
    </motion.p>
  );
}
