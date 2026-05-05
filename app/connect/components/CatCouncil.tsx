"use client";

import { AnimatePresence, motion, type Variants } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import {
  DRAWING_CANVAS_HEIGHT,
  DRAWING_CANVAS_WIDTH,
  type DrawingStroke,
} from "@/app/lib/confessional-captcha";

export type Verdict = "judging" | "approve" | "reject";

type CatCouncilProps = {
  verdict: Verdict;
  message?: string;
  strokes?: DrawingStroke[];
};

// Scene viewBox. Wider than tall so it reads as a tiny diorama.
const SCENE_WIDTH = 720;
const SCENE_HEIGHT = 380;

// ── Adult judge cat (12 wide x 23 tall pixel sprite) ────────────────────────
// A sitting chibi cat: hat → head → body → paws on the ground.
// Symbols: T = hat tip   · H = hat   · v = hat brim · *  = hat star accent
//          f = fur        · b = belly fluff (lighter) · P = paw shadow line
//          e = eye        · n = nose  · m = mouth     · p = paw pad
//          .              = transparent
const ADULT_CELL = 7;
const ADULT_SPRITE = [
  "............", //  0
  ".....TT.....", //  1 hat tip
  "....HHHH....", //  2 hat top
  "...HHHHHH...", //  3
  "..HHHHHHHH.*", //  4 with star accent
  ".HHHHHHHHHH.", //  5
  "vvvvvvvvvvvv", //  6 hat brim
  "............", //  7
  ".ff......ff.", //  8 ear tufts
  ".ffffffffff.", //  9 top of head
  ".ffeffffeff.", // 10 eyes
  ".ffffnnffff.", // 11 nose
  ".fffmmmmfff.", // 12 mouth
  "..ffffffff..", // 13 chin
  "...ffffff...", // 14 chin tip / neck
  "..ffffffff..", // 15 shoulders
  ".ffffbbffff.", // 16 chest with belly fluff
  "ffffbbbbffff", // 17 wide chest
  "fffbbbbbbfff", // 18 belly
  "fffPPPPPPfff", // 19 darker line where front paws cross
  "ff.ffffff.ff", // 20 haunches with leg gaps
  "pp.pp..pp.pp", // 21 paw pads at the ground
  "............", // 22 ground breath
];
const ADULT_COLS = ADULT_SPRITE[0].length;
const ADULT_ROWS = ADULT_SPRITE.length;
const ADULT_W = ADULT_COLS * ADULT_CELL; // 84
const ADULT_H = ADULT_ROWS * ADULT_CELL; // 112

// ── Kitten sprite (9 wide x 9 tall, smaller cell for chibi proportions) ─────
const KITTEN_CELL = 4;
const KITTEN_SPRITE = [
  ".kk...kk.",
  "kkk.k.kkk",
  "kkkkkkkkk",
  "keekkkeek",
  "kkkknkkkk",
  "kkkmmmkkk",
  ".kkkkkkk.",
  "..kkkkk..",
  ".k.....k.",
];
const KITTEN_COLS = KITTEN_SPRITE[0].length;
const KITTEN_ROWS = KITTEN_SPRITE.length;
const KITTEN_W = KITTEN_COLS * KITTEN_CELL; // 36
const KITTEN_H = KITTEN_ROWS * KITTEN_CELL; // 36

// Curled-up sleeping kitten (16 wide x 9 tall) — a comma-shaped curl with
// ear, closed eye, paw tucked under, tail wrapping the body.
const SLEEPING_CELL = 5;
const SLEEPING_SPRITE = [
  "...kk...........",
  "..kkkk..........",
  ".kkkkkkkkkk.....",
  "kkkkkkkkkkkkk...",
  "kkmkkkkkkkkkkkk.",
  "kkkkkkkkkkkkkkkk",
  ".kkkkkkkkkkkkkkk",
  "..kkkkkkkkkkkk..",
  "...kk......kk...",
];
const SLEEPING_COLS = SLEEPING_SPRITE[0].length;
const SLEEPING_ROWS = SLEEPING_SPRITE.length;
const SLEEPING_W = SLEEPING_COLS * SLEEPING_CELL; // 80
const SLEEPING_H = SLEEPING_ROWS * SLEEPING_CELL; // 45

// Peeking kitten — head only (7 wide x 6 tall) so it can rise up from behind.
const PEEK_SPRITE = [
  ".kk.kk.",
  "kkkkkkk",
  "kekkekk",
  "kkknkkk",
  "kkmmmkk",
  ".kkkkk.",
];
const PEEK_COLS = PEEK_SPRITE[0].length;
const PEEK_ROWS = PEEK_SPRITE.length;
const PEEK_W = PEEK_COLS * KITTEN_CELL;
const PEEK_H = PEEK_ROWS * KITTEN_CELL;

type AdultPalette = {
  T: string;
  H: string;
  v: string;
  star: string;
  f: string;
  b: string;
  P: string;
  p: string;
  e: string;
  n: string;
  m: string;
  glow: string;
};

type KittenPalette = {
  k: string;
  e: string;
  n: string;
  m: string;
  glow: string;
};

const ADULT_PALETTES: AdultPalette[] = [
  {
    // Lavender hat, ginger fur — the warm critic.
    T: "#ffd86b",
    H: "#7a4cd6",
    v: "#3d2470",
    star: "#ffec8a",
    f: "#f4a05a",
    b: "#ffd9aa",
    P: "#a85d2e",
    p: "#ff9aa6",
    e: "#15101e",
    n: "#ff9aa6",
    m: "#15101e",
    glow: "#ffd36d",
  },
  {
    // Royal blue hat, midnight fur — the head judge.
    T: "#fff1a8",
    H: "#2f50d6",
    v: "#15276a",
    star: "#fff7c0",
    f: "#1c1924",
    b: "#3a3146",
    P: "#080510",
    p: "#d49572",
    e: "#ffd86b",
    n: "#d49572",
    m: "#0a0810",
    glow: "#9fc5ff",
  },
  {
    // Crimson hat, snowy fur — the romantic.
    T: "#ffe6c4",
    H: "#d6443a",
    v: "#7a1f1c",
    star: "#fff0c0",
    f: "#ece9f1",
    b: "#ffffff",
    P: "#b3aebd",
    p: "#ff9aa6",
    e: "#3e6cd0",
    n: "#ff9aa6",
    m: "#5a4046",
    glow: "#f8a4c8",
  },
];

const KITTEN_PALETTES: KittenPalette[] = [
  { k: "#f4f1f8", e: "#4a8ad8", n: "#ff9aa6", m: "#3a2848", glow: "#cfd8ff" },
  { k: "#231a30", e: "#a8f0b8", n: "#7a4860", m: "#050308", glow: "#aef5b8" },
  { k: "#f3a25b", e: "#3a8a3a", n: "#d56a6a", m: "#2c1410", glow: "#ffd07a" },
  { k: "#a4a3b8", e: "#ffc34a", n: "#d59a92", m: "#2a2030", glow: "#dfe1f6" },
];

export default function CatCouncil({
  verdict,
  message,
  strokes = [],
}: CatCouncilProps) {
  return (
    <div className="relative flex flex-col items-center">
      <div className="relative w-full max-w-[640px]">
        <svg
          viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`}
          width="100%"
          shapeRendering="crispEdges"
          className="block overflow-visible"
        >
          <defs>
            <radialGradient id="council-spotlight" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#fff2c2" stopOpacity="0.18" />
              <stop offset="60%" stopColor="#7a4cd6" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="rug-shade" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#5a3a8c" stopOpacity="0.85" />
              <stop offset="80%" stopColor="#2c1c50" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#1a0f30" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Soft moonlight wash */}
          <rect
            x={0}
            y={0}
            width={SCENE_WIDTH}
            height={SCENE_HEIGHT}
            fill="url(#council-spotlight)"
          />

          {/* Floor / velvet rug */}
          <Floor verdict={verdict} />

          {/* Ambient candles in the gaps between judges and easel */}
          <Candle x={195} y={285} verdict={verdict} flicker={0} />
          <Candle x={SCENE_WIDTH - 195} y={285} verdict={verdict} flicker={0.4} />

          {/* Sleeping kitten on a tiny cushion at the far left */}
          <SleepingKitten
            x={28}
            y={SCENE_HEIGHT - 70}
            palette={KITTEN_PALETTES[2]}
            verdict={verdict}
          />

          {/* Tail-chasing kitten in the far-right corner with a yarn ball */}
          <YarnBall x={SCENE_WIDTH - 32} y={SCENE_HEIGHT - 38} />
          <TailChaserKitten
            x={SCENE_WIDTH - 84}
            y={SCENE_HEIGHT - 64}
            palette={KITTEN_PALETTES[3]}
            verdict={verdict}
          />

          {/* Easel and the user's drawing */}
          <Easel
            x={(SCENE_WIDTH - 240) / 2}
            y={36}
            strokes={strokes}
            verdict={verdict}
          />

          {/* Kitten peeking over the top of the easel canvas */}
          <PeekingKitten
            x={SCENE_WIDTH / 2 + 60}
            y={4}
            palette={KITTEN_PALETTES[1]}
            verdict={verdict}
          />

          {/* The three judges */}
          <AdultCat
            seat={0}
            palette={ADULT_PALETTES[0]}
            verdict={verdict}
            x={68}
            y={185}
            facing="right"
          />
          <AdultCat
            seat={1}
            palette={ADULT_PALETTES[1]}
            verdict={verdict}
            x={(SCENE_WIDTH - ADULT_W) / 2}
            y={205}
            facing="center"
          />
          <AdultCat
            seat={2}
            palette={ADULT_PALETTES[2]}
            verdict={verdict}
            x={SCENE_WIDTH - ADULT_W - 68}
            y={185}
            facing="left"
          />

          {/* Two kittens racing across the foreground in opposite directions */}
          <RunningKitten
            verdict={verdict}
            palette={KITTEN_PALETTES[0]}
            direction="right"
            offset={0}
            duration={6.4}
          />
          <RunningKitten
            verdict={verdict}
            palette={KITTEN_PALETTES[1]}
            direction="left"
            offset={3.0}
            duration={7.6}
          />

          {/* Tiny firefly the sleeping kitten is dreaming of */}
          <Firefly x={92} y={300} verdict={verdict} />

          {/* Verdict-specific overlays */}
          <AnimatePresence>
            {verdict === "approve" ? (
              <ApproveOverlay key="approve" />
            ) : null}
            {verdict === "reject" ? (
              <RejectOverlay key="reject" />
            ) : null}
          </AnimatePresence>
        </svg>
      </div>

      <CouncilCaption verdict={verdict} message={message} />
    </div>
  );
}

// ── Floor / rug ─────────────────────────────────────────────────────────────

function Floor({ verdict }: { verdict: Verdict }) {
  const fade =
    verdict === "reject" ? 0.55 : verdict === "approve" ? 1 : 0.85;
  return (
    <g style={{ opacity: fade }}>
      {/* Cast shadow under the council */}
      <ellipse
        cx={SCENE_WIDTH / 2}
        cy={SCENE_HEIGHT - 14}
        rx={SCENE_WIDTH * 0.42}
        ry={26}
        fill="#06030c"
        opacity={0.55}
      />
      {/* Velvet rug body */}
      <ellipse
        cx={SCENE_WIDTH / 2}
        cy={SCENE_HEIGHT - 32}
        rx={SCENE_WIDTH * 0.4}
        ry={30}
        fill="url(#rug-shade)"
      />
      {/* Decorative inner ring stitched on the rug */}
      <ellipse
        cx={SCENE_WIDTH / 2}
        cy={SCENE_HEIGHT - 32}
        rx={SCENE_WIDTH * 0.32}
        ry={22}
        fill="none"
        stroke="rgba(255,232,180,0.18)"
        strokeWidth={1}
        strokeDasharray="3 5"
      />
      {/* Tassels at corners */}
      {[
        { cx: SCENE_WIDTH / 2 - SCENE_WIDTH * 0.4, cy: SCENE_HEIGHT - 32 },
        { cx: SCENE_WIDTH / 2 + SCENE_WIDTH * 0.4, cy: SCENE_HEIGHT - 32 },
      ].map((t, index) => (
        <g key={index}>
          <circle cx={t.cx} cy={t.cy} r={3} fill="#ffd36d" />
          <line
            x1={t.cx}
            y1={t.cy + 3}
            x2={t.cx}
            y2={t.cy + 11}
            stroke="#ffd36d"
            strokeWidth={1}
          />
        </g>
      ))}
    </g>
  );
}

// ── Candle ──────────────────────────────────────────────────────────────────

function Candle({
  x,
  y,
  verdict,
  flicker,
}: {
  x: number;
  y: number;
  verdict: Verdict;
  flicker: number;
}) {
  const lit = verdict !== "reject";
  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Candle wax stick */}
      <rect x={-3} y={0} width={6} height={28} fill="#f4e9c5" />
      <rect x={-3} y={0} width={2} height={28} fill="#fff8df" />
      {/* Drip */}
      <rect x={2} y={6} width={2} height={6} fill="#fff8df" />
      {/* Wick */}
      <rect x={-0.5} y={-3} width={1} height={3} fill="#2a1c10" />
      {/* Holder */}
      <rect x={-7} y={28} width={14} height={3} fill="#7a5230" />
      <rect x={-9} y={31} width={18} height={2} fill="#5a3920" />

      {lit ? (
        <motion.g
          animate={{
            scale: [1, 1.15, 0.95, 1.1, 1],
            opacity: [0.9, 1, 0.85, 1, 0.9],
          }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: flicker,
          }}
          style={{ transformOrigin: "0px -3px" }}
        >
          <ellipse cx={0} cy={-7} rx={4} ry={9} fill="#ffd36d" opacity={0.4} />
          <ellipse cx={0} cy={-7} rx={2.5} ry={6} fill="#ffec8a" />
          <ellipse cx={0} cy={-9} rx={1} ry={2.2} fill="#fff" />
        </motion.g>
      ) : (
        <g>
          <path
            d="M -3 -6 Q 0 -10 3 -6"
            stroke="#5a4070"
            strokeWidth={1}
            fill="none"
          />
          <path
            d="M 0 -7 Q 2 -12 -1 -16"
            stroke="#5a4070"
            strokeWidth={1}
            fill="none"
            opacity={0.5}
          />
        </g>
      )}
    </g>
  );
}

// ── Easel ───────────────────────────────────────────────────────────────────

function Easel({
  x,
  y,
  strokes,
  verdict,
}: {
  x: number;
  y: number;
  strokes: DrawingStroke[];
  verdict: Verdict;
}) {
  const FRAME_W = 240;
  const FRAME_H = 160;

  const wobble: Variants = {
    judging: {
      rotate: [-0.4, 0.4, -0.4],
      transition: { duration: 6, repeat: Infinity, ease: "easeInOut" },
    },
    approve: {
      rotate: [0, -2, 2, -1.5, 0],
      y: [0, -3, 0, -2, 0],
      transition: { duration: 1.4, repeat: Infinity, ease: "easeInOut" },
    },
    reject: {
      rotate: [0, -1, 1, -1, 0],
      transition: { duration: 0.4, repeat: Infinity, ease: "easeInOut" },
    },
  };

  return (
    <g transform={`translate(${x}, ${y})`}>
    <motion.g
      variants={wobble}
      animate={verdict}
      style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
    >
      {/* Soft halo behind the artwork */}
      <ellipse
        cx={FRAME_W / 2}
        cy={FRAME_H / 2 - 4}
        rx={FRAME_W * 0.62}
        ry={FRAME_H * 0.56}
        fill="#ffd36d"
        opacity={verdict === "reject" ? 0.04 : 0.08}
      />

      {/* Tripod legs (rendered behind the canvas) */}
      <line
        x1={20}
        y1={FRAME_H + 6}
        x2={-22}
        y2={FRAME_H + 86}
        stroke="#3a261a"
        strokeWidth={6}
        strokeLinecap="round"
      />
      <line
        x1={FRAME_W - 20}
        y1={FRAME_H + 6}
        x2={FRAME_W + 22}
        y2={FRAME_H + 86}
        stroke="#3a261a"
        strokeWidth={6}
        strokeLinecap="round"
      />
      <line
        x1={FRAME_W / 2}
        y1={FRAME_H + 6}
        x2={FRAME_W / 2}
        y2={FRAME_H + 96}
        stroke="#2c1d12"
        strokeWidth={5}
        strokeLinecap="round"
      />
      {/* Cross bar */}
      <line
        x1={-6}
        y1={FRAME_H + 50}
        x2={FRAME_W + 6}
        y2={FRAME_H + 50}
        stroke="#3a261a"
        strokeWidth={3}
        strokeLinecap="round"
      />

      {/* Outer wood frame */}
      <rect
        x={-9}
        y={-9}
        width={FRAME_W + 18}
        height={FRAME_H + 18}
        rx={4}
        fill="#5a3920"
      />
      <rect
        x={-9}
        y={-9}
        width={FRAME_W + 18}
        height={FRAME_H + 18}
        rx={4}
        fill="none"
        stroke="#7a5230"
        strokeWidth={2}
      />
      {/* Inner mat */}
      <rect
        x={-2}
        y={-2}
        width={FRAME_W + 4}
        height={FRAME_H + 4}
        rx={2}
        fill="#1a1226"
      />
      {/* Canvas */}
      <rect x={0} y={0} width={FRAME_W} height={FRAME_H} fill="#0c0816" />

      {/* The drawing itself, centered + scaled to fit canvas */}
      <svg
        x={0}
        y={0}
        width={FRAME_W}
        height={FRAME_H}
        viewBox={`0 0 ${DRAWING_CANVAS_WIDTH} ${DRAWING_CANVAS_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {strokes.map((stroke, index) => {
          const path = strokeToPath(stroke);
          if (!path) return null;
          const color = stroke.color ?? "#f5f5f5";
          const width = stroke.width ?? 5;
          return (
            <path
              key={index}
              d={path}
              stroke={color}
              strokeWidth={width * 1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={0.95}
            />
          );
        })}
      </svg>

      {/* Top hanger nail */}
      <rect x={FRAME_W / 2 - 1} y={-13} width={2} height={4} fill="#3a261a" />
      <circle cx={FRAME_W / 2} cy={-15} r={2} fill="#c8a06a" />
    </motion.g>
    </g>
  );
}

function strokeToPath(stroke: DrawingStroke): string {
  const points = stroke.points;
  if (!points || points.length === 0) return "";
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x} ${p.y} l 0.1 0.1`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x} ${points[i].y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

// ── Adult cat sprite ────────────────────────────────────────────────────────

type EyeMode = "default" | "blink" | "wide" | "squint";
type Facing = "left" | "center" | "right";

function AdultCat({
  palette,
  verdict,
  seat,
  x,
  y,
  facing,
}: {
  palette: AdultPalette;
  verdict: Verdict;
  seat: number;
  x: number;
  y: number;
  facing: Facing;
}) {
  const judgingDelay = seat * 0.18;

  // Each cat ticks through subtle pose changes: head tilts, blinks, eye darts.
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
    if (verdict === "approve") return 0;
    if (verdict === "reject") return 0;
    const cycle = tick % 4;
    return cycle === 0 ? -3 : cycle === 1 ? 0 : cycle === 2 ? 3 : 0;
  }, [tick, verdict]);

  const eyeMode: EyeMode = useMemo(() => {
    if (verdict === "approve") return "wide";
    if (verdict === "reject") return "squint";
    if (verdict === "judging" && tick % 5 === 4) return "blink";
    return "default";
  }, [tick, verdict]);

  // Eyes flick toward the easel and back during judging — gives a sense of
  // appraisal that floating heads can't.
  const gaze: Facing = useMemo(() => {
    if (verdict !== "judging") return facing;
    const dart = tick % 6;
    if (dart === 1 || dart === 4) return "center";
    return facing;
  }, [tick, verdict, facing]);

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
    <g transform={`translate(${x}, ${y})`}>
    <motion.g
      variants={variants}
      animate={verdict}
      style={{
        transformBox: "fill-box",
        transformOrigin: "50% 100%",
        filter:
          verdict === "reject"
            ? "saturate(0.6) brightness(0.8)"
            : verdict === "approve"
              ? `drop-shadow(0 0 14px ${palette.glow}AA)`
              : `drop-shadow(0 0 7px ${palette.glow}55)`,
      }}
    >
      {/* Tail flick — peeks out from behind the cat */}
      <Tail verdict={verdict} palette={palette} facing={facing} seat={seat} />

      <motion.g
        animate={{ rotate: headTilt }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        style={{
          transformBox: "fill-box",
          transformOrigin: "50% 75%",
        }}
      >
        <AdultSpriteSvg palette={palette} eyeMode={eyeMode} gaze={gaze} />

        {/* Pink cheek blush — single most impactful cuteness pixel */}
        <rect
          x={1 * ADULT_CELL}
          y={11 * ADULT_CELL}
          width={ADULT_CELL - 1}
          height={ADULT_CELL - 1}
          fill="#ff9aa6"
          opacity={0.55}
        />
        <rect
          x={9 * ADULT_CELL + 1}
          y={11 * ADULT_CELL}
          width={ADULT_CELL - 1}
          height={ADULT_CELL - 1}
          fill="#ff9aa6"
          opacity={0.55}
        />

        {/* The head judge wears a monocle — a tiny ring around the right eye */}
        {seat === 1 ? (
          <g>
            <circle
              cx={7 * ADULT_CELL + ADULT_CELL / 2}
              cy={10 * ADULT_CELL + ADULT_CELL / 2}
              r={6.5}
              fill="none"
              stroke="#ffd86b"
              strokeWidth={1.5}
            />
            <line
              x1={7 * ADULT_CELL + ADULT_CELL + 5}
              y1={10 * ADULT_CELL + ADULT_CELL / 2}
              x2={7 * ADULT_CELL + ADULT_CELL + 14}
              y2={11 * ADULT_CELL + ADULT_CELL + 4}
              stroke="#ffd86b"
              strokeWidth={1}
            />
          </g>
        ) : null}
      </motion.g>

      {/* Subtle floor shadow */}
      <ellipse
        cx={ADULT_W / 2}
        cy={ADULT_H + 2}
        rx={ADULT_W * 0.42}
        ry={4}
        fill="#06030c"
        opacity={0.5}
      />
    </motion.g>
    </g>
  );
}

function Tail({
  verdict,
  palette,
  facing,
  seat,
}: {
  verdict: Verdict;
  palette: AdultPalette;
  facing: Facing;
  seat: number;
}) {
  // Tails emerge on the side opposite to where the cat is facing, curling up
  // and outward like a comma.
  const onRight = facing !== "right";
  const sweep = onRight ? 1 : -1;
  const baseX = onRight ? ADULT_W - 8 : 8;
  const baseY = ADULT_H * 0.66;
  const tipX = baseX + sweep * 22;
  const tipY = baseY - 36;

  const flicker: Variants = {
    judging: {
      rotate: [0, 12, -4, 8, 0],
      transition: {
        duration: 2.4 + seat * 0.3,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
    approve: {
      rotate: [0, 26, -8, 26, 0],
      transition: { duration: 0.9, repeat: Infinity, ease: "easeInOut" },
    },
    reject: {
      rotate: [0, -10, 10, -8, 0],
      transition: { duration: 0.5, repeat: Infinity, ease: "easeInOut" },
    },
  };

  return (
    <motion.g
      variants={flicker}
      animate={verdict}
      style={{
        transformBox: "fill-box",
        transformOrigin: `${baseX}px ${baseY}px`,
      }}
    >
      <path
        d={`M ${baseX} ${baseY} q ${sweep * 16} -10 ${sweep * 22} -28 q ${sweep * 2} -10 ${-sweep * 6} -8`}
        stroke={palette.f}
        strokeWidth={6}
        strokeLinecap="round"
        fill="none"
      />
      {/* Tail tip cap so the curl reads cleanly */}
      <circle cx={tipX - sweep * 6} cy={tipY + 4} r={3.5} fill={palette.f} />
    </motion.g>
  );
}

function AdultSpriteSvg({
  palette,
  eyeMode,
  gaze,
}: {
  palette: AdultPalette;
  eyeMode: EyeMode;
  gaze: Facing;
}) {
  const cells: { x: number; y: number; color: string }[] = [];

  for (let row = 0; row < ADULT_ROWS; row += 1) {
    const line = ADULT_SPRITE[row];
    for (let col = 0; col < ADULT_COLS; col += 1) {
      const ch = line[col];
      const color = adultSymbolColor(ch, palette);
      if (color) {
        cells.push({ x: col, y: row, color });
      }
    }
  }

  const eyeOverrides = adultEyeShapes(eyeMode, palette, gaze);

  return (
    <g>
      {cells.map((cell, index) => {
        const override = eyeOverrides.find(
          (entry) => entry.row === cell.y && entry.col === cell.x,
        );
        if (override?.skip) {
          return null;
        }
        return (
          <rect
            key={index}
            x={cell.x * ADULT_CELL}
            y={cell.y * ADULT_CELL}
            width={ADULT_CELL}
            height={ADULT_CELL}
            fill={cell.color}
          />
        );
      })}
      {eyeOverrides
        .filter((entry) => entry.fill)
        .map((entry, index) => (
          <rect
            key={`eye-${index}`}
            x={entry.col * ADULT_CELL + (entry.dx ?? 0)}
            y={entry.row * ADULT_CELL + (entry.dy ?? 0)}
            width={entry.width ?? ADULT_CELL}
            height={entry.height ?? ADULT_CELL}
            fill={entry.fill}
          />
        ))}
    </g>
  );
}

type EyeOverride = {
  col: number;
  row: number;
  skip?: boolean;
  fill?: string;
  dx?: number;
  dy?: number;
  width?: number;
  height?: number;
};

function adultEyeShapes(
  mode: EyeMode,
  palette: AdultPalette,
  gaze: Facing,
): EyeOverride[] {
  const eyeRow = 10;
  const eyeCols = [2, 7];

  if (mode === "blink") {
    return eyeCols.flatMap((col) => [
      { col, row: eyeRow, skip: true },
      {
        col,
        row: eyeRow,
        fill: palette.e,
        dy: ADULT_CELL - 2,
        height: 2,
      },
    ]);
  }

  if (mode === "squint") {
    return eyeCols.flatMap((col) => [
      { col, row: eyeRow, skip: true },
      {
        col,
        row: eyeRow,
        fill: palette.e,
        dy: ADULT_CELL / 2 - 1,
        height: 2,
      },
    ]);
  }

  if (mode === "wide") {
    // Sparkly oversized eye + a tiny highlight pixel.
    return eyeCols.flatMap((col) => [
      { col, row: eyeRow, skip: true },
      {
        col,
        row: eyeRow,
        fill: palette.e,
        dx: 0,
        dy: -2,
        width: ADULT_CELL,
        height: ADULT_CELL + 2,
      },
      {
        col,
        row: eyeRow,
        fill: "#ffffff",
        dx: ADULT_CELL - 3,
        dy: 0,
        width: 2,
        height: 2,
      },
    ]);
  }

  // Default — render the eye as a smaller block with directional gaze + a
  // pinprick highlight. Sub-cell offsets convey "looking left/center/right".
  const gazeOffset = gaze === "left" ? -1.5 : gaze === "right" ? 1.5 : 0;
  return eyeCols.flatMap((col) => [
    { col, row: eyeRow, skip: true },
    {
      col,
      row: eyeRow,
      fill: palette.e,
      dx: 1.5 + gazeOffset,
      dy: 1.5,
      width: 4,
      height: 4,
    },
    {
      col,
      row: eyeRow,
      fill: "#ffffffcc",
      dx: 2 + gazeOffset,
      dy: 2,
      width: 1,
      height: 1,
    },
  ]);
}

function adultSymbolColor(
  symbol: string,
  palette: AdultPalette,
): string | null {
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
    case "b":
      return palette.b;
    case "P":
      return palette.P;
    case "p":
      return palette.p;
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

// ── Kittens ─────────────────────────────────────────────────────────────────

function KittenSpriteSvg({
  sprite,
  cell,
  palette,
  closedEyes,
}: {
  sprite: string[];
  cell: number;
  palette: KittenPalette;
  closedEyes?: boolean;
}) {
  const cells: { x: number; y: number; color: string; isEye: boolean }[] = [];
  for (let row = 0; row < sprite.length; row += 1) {
    const line = sprite[row];
    for (let col = 0; col < line.length; col += 1) {
      const ch = line[col];
      const color = kittenSymbolColor(ch, palette);
      if (color) {
        cells.push({ x: col, y: row, color, isEye: ch === "e" });
      }
    }
  }
  return (
    <g>
      {cells.map((c, i) => {
        if (c.isEye && closedEyes) {
          // Replace eye with a thin slit.
          return (
            <rect
              key={i}
              x={c.x * cell}
              y={c.y * cell + cell - 1}
              width={cell}
              height={1}
              fill={palette.m}
            />
          );
        }
        if (c.isEye) {
          // Draw eye with a tiny pinprick highlight.
          return (
            <g key={i}>
              <rect
                x={c.x * cell}
                y={c.y * cell}
                width={cell}
                height={cell}
                fill={c.color}
              />
              <rect
                x={c.x * cell + cell - 1}
                y={c.y * cell}
                width={1}
                height={1}
                fill="#fff"
              />
            </g>
          );
        }
        return (
          <rect
            key={i}
            x={c.x * cell}
            y={c.y * cell}
            width={cell}
            height={cell}
            fill={c.color}
          />
        );
      })}
    </g>
  );
}

function kittenSymbolColor(
  symbol: string,
  palette: KittenPalette,
): string | null {
  switch (symbol) {
    case "k":
      return palette.k;
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

// Kitten that bounces across the foreground, off-stage, then repeats.
function RunningKitten({
  verdict,
  palette,
  direction,
  offset,
  duration,
}: {
  verdict: Verdict;
  palette: KittenPalette;
  direction: "left" | "right";
  offset: number;
  duration: number;
}) {
  const goingRight = direction === "right";
  const startX = goingRight ? -KITTEN_W - 30 : SCENE_WIDTH + 30;
  const endX = goingRight ? SCENE_WIDTH + 40 : -KITTEN_W - 40;
  const baseY = goingRight ? SCENE_HEIGHT - 80 : SCENE_HEIGHT - 56;
  const speedScale =
    verdict === "approve" ? 0.7 : verdict === "reject" ? 1.4 : 1;
  const totalDuration = duration * speedScale;

  return (
    <motion.g
      animate={{ x: [startX, endX] }}
      transition={{
        duration: totalDuration,
        repeat: Infinity,
        ease: "linear",
        delay: offset,
      }}
    >
      <motion.g
        animate={{ y: [baseY, baseY - 8, baseY, baseY - 8, baseY] }}
        transition={{
          duration: totalDuration / 5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <g transform={goingRight ? undefined : `scale(-1 1) translate(-${KITTEN_W} 0)`}>
          {/* Tail flicking behind */}
          <motion.g
            animate={{ rotate: [-14, 18, -14] }}
            transition={{ duration: 0.4, repeat: Infinity, ease: "easeInOut" }}
            style={{
              transformBox: "fill-box",
              transformOrigin: `${KITTEN_CELL}px ${KITTEN_H * 0.55}px`,
            }}
          >
            <path
              d={`M ${KITTEN_CELL} ${KITTEN_H * 0.55} q -8 -3 -12 -16`}
              stroke={palette.k}
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
            />
          </motion.g>
          <KittenSpriteSvg
            sprite={KITTEN_SPRITE}
            cell={KITTEN_CELL}
            palette={palette}
          />
          {/* Shadow under feet */}
          <ellipse
            cx={KITTEN_W / 2}
            cy={KITTEN_H + 2}
            rx={KITTEN_W * 0.4}
            ry={2}
            fill="#06030c"
            opacity={0.6}
          />
        </g>
      </motion.g>
    </motion.g>
  );
}

// A kitten chasing its own tail — spins in place in a cute corner of the rug.
function TailChaserKitten({
  x,
  y,
  palette,
  verdict,
}: {
  x: number;
  y: number;
  palette: KittenPalette;
  verdict: Verdict;
}) {
  const spin: Variants = {
    judging: {
      rotate: [0, 360],
      transition: { duration: 3.4, repeat: Infinity, ease: "linear" },
    },
    approve: {
      rotate: [0, 360],
      transition: { duration: 1.6, repeat: Infinity, ease: "linear" },
    },
    reject: {
      rotate: [0, -20, 20, -10, 0],
      transition: { duration: 0.8, repeat: Infinity, ease: "easeInOut" },
    },
  };

  return (
    <g transform={`translate(${x}, ${y})`}>
      <motion.g
        variants={spin}
        animate={verdict}
        style={{
          transformBox: "fill-box",
          transformOrigin: "50% 60%",
        }}
      >
        <KittenSpriteSvg
          sprite={KITTEN_SPRITE}
          cell={KITTEN_CELL}
          palette={palette}
        />
        {/* Tail curving away from body — reads as something to chase */}
        <path
          d={`M ${KITTEN_W - KITTEN_CELL} ${KITTEN_H * 0.55} q 12 -2 14 -16 q 0 -6 -6 -6`}
          stroke={palette.k}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />
      </motion.g>
      <ellipse
        cx={KITTEN_W / 2}
        cy={KITTEN_H + 2}
        rx={KITTEN_W * 0.45}
        ry={3}
        fill="#06030c"
        opacity={0.5}
      />
    </g>
  );
}

function SleepingKitten({
  x,
  y,
  palette,
  verdict,
}: {
  x: number;
  y: number;
  palette: KittenPalette;
  verdict: Verdict;
}) {
  const breathing: Variants = {
    judging: {
      scaleY: [1, 1.06, 1],
      transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" },
    },
    approve: {
      scaleY: [1, 1.05, 1, 1.05, 1],
      y: [0, -3, 0],
      transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
    },
    reject: {
      scaleY: [1, 1.04, 1],
      transition: { duration: 2.2, repeat: Infinity, ease: "easeInOut" },
    },
  };

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Tiny cushion */}
      <rect
        x={-4}
        y={SLEEPING_H - 4}
        width={SLEEPING_W + 8}
        height={10}
        rx={4}
        fill="#7a4cd6"
        opacity={0.55}
      />
      <rect
        x={-4}
        y={SLEEPING_H - 4}
        width={SLEEPING_W + 8}
        height={3}
        rx={1.5}
        fill="#a87bf2"
        opacity={0.6}
      />
      <motion.g
        variants={breathing}
        animate={verdict}
        style={{
          transformBox: "fill-box",
          transformOrigin: "50% 100%",
        }}
      >
        <KittenSpriteSvg
          sprite={SLEEPING_SPRITE}
          cell={SLEEPING_CELL}
          palette={palette}
        />
      </motion.g>
      {/* Floating Z's for sleepy ambience */}
      <SleepyZ x={SLEEPING_W - 6} y={-6} delay={0} />
      <SleepyZ x={SLEEPING_W + 6} y={-14} delay={1.4} />
      {/* Floor shadow */}
      <ellipse
        cx={SLEEPING_W / 2}
        cy={SLEEPING_H + 6}
        rx={SLEEPING_W * 0.5}
        ry={3}
        fill="#06030c"
        opacity={0.55}
      />
    </g>
  );
}

function SleepyZ({
  x,
  y,
  delay,
}: {
  x: number;
  y: number;
  delay: number;
}) {
  return (
    <motion.text
      x={x}
      y={y}
      fill="#cfd8ff"
      fontSize={9}
      fontFamily="monospace"
      opacity={0.7}
      animate={{ y: [y, y - 14], opacity: [0, 0.85, 0] }}
      transition={{ duration: 2.6, delay, repeat: Infinity, ease: "easeOut" }}
    >
      z
    </motion.text>
  );
}

function PeekingKitten({
  x,
  y,
  palette,
  verdict,
}: {
  x: number;
  y: number;
  palette: KittenPalette;
  verdict: Verdict;
}) {
  // Bobs up and down behind the easel, peeking at the drawing.
  const bob: Variants = {
    judging: {
      y: [0, -10, 0, -8, 0],
      transition: { duration: 3.4, repeat: Infinity, ease: "easeInOut" },
    },
    approve: {
      y: [-8, -22, -10, -22, -8],
      rotate: [-3, 3, -3],
      transition: { duration: 1.2, repeat: Infinity, ease: "easeOut" },
    },
    reject: {
      y: [0, 6, 0],
      transition: { duration: 0.6, repeat: Infinity, ease: "easeInOut" },
    },
  };

  return (
    <g transform={`translate(${x}, ${y})`}>
      <motion.g
        variants={bob}
        animate={verdict}
        style={{
          transformBox: "fill-box",
          transformOrigin: "50% 100%",
        }}
      >
        <KittenSpriteSvg
          sprite={PEEK_SPRITE}
          cell={KITTEN_CELL}
          palette={palette}
        />
        {/* Two paws gripping the edge */}
        <rect
          x={2}
          y={PEEK_H - 1}
          width={4}
          height={3}
          fill={palette.k}
        />
        <rect
          x={PEEK_W - 6}
          y={PEEK_H - 1}
          width={4}
          height={3}
          fill={palette.k}
        />
      </motion.g>
    </g>
  );
}

// Tiny ball of yarn for the tail-chaser to bat around.
function YarnBall({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle cx={0} cy={0} r={6} fill="#f8a4c8" />
      <path
        d="M -5 -2 q 5 6 10 2 q -5 -6 -10 -2 z"
        fill="none"
        stroke="#d56a98"
        strokeWidth={0.8}
      />
      <path
        d="M -5 1 q 5 4 10 -2"
        fill="none"
        stroke="#d56a98"
        strokeWidth={0.8}
      />
      <path
        d="M -2 -5 q 1 5 5 6"
        fill="none"
        stroke="#d56a98"
        strokeWidth={0.8}
      />
      {/* Trailing thread toward the tail-chaser kitten */}
      <path
        d="M 0 -2 q -10 -8 -34 -4"
        stroke="#f8a4c8"
        strokeWidth={1}
        fill="none"
        opacity={0.85}
      />
      {/* Floor shadow */}
      <ellipse cx={0} cy={7} rx={6} ry={1.6} fill="#06030c" opacity={0.5} />
    </g>
  );
}

// Tiny firefly bouncing near the sleeping kitten — adds atmosphere.
function Firefly({
  x,
  y,
  verdict,
}: {
  x: number;
  y: number;
  verdict: Verdict;
}) {
  if (verdict === "reject") return null;
  return (
    <motion.g
      animate={{
        x: [x, x + 14, x - 6, x + 18, x],
        y: [y, y - 18, y - 8, y - 22, y],
      }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.circle
        cx={0}
        cy={0}
        r={3}
        fill="#fff5b8"
        animate={{ opacity: [0.3, 1, 0.4, 1, 0.3] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        style={{ filter: "drop-shadow(0 0 6px #fff5b8)" }}
      />
    </motion.g>
  );
}

// ── Verdict overlays ────────────────────────────────────────────────────────

function ApproveOverlay() {
  // Bigger hearts + sparkles rising and drifting over the scene.
  const items = useMemo(() => {
    const palette = ["#ffd86b", "#fff7c0", "#f8a4c8", "#b7ffca", "#9fc5ff"];
    return Array.from({ length: 22 }, (_, index) => ({
      id: index,
      x: 50 + Math.random() * (SCENE_WIDTH - 100),
      y: 40 + Math.random() * 240,
      drift: -16 + Math.random() * 32,
      delay: Math.random() * 1.2,
      size: 8 + Math.random() * 10,
      color: palette[index % palette.length],
      kind: index % 3 === 0 ? "heart" : "sparkle",
    }));
  }, []);

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {items.map((item) =>
        item.kind === "heart" ? (
          <motion.g
            key={item.id}
            initial={{ x: item.x, y: item.y, opacity: 0, scale: 0 }}
            animate={{
              x: [item.x, item.x + item.drift],
              y: [item.y, item.y - 80],
              opacity: [0, 1, 1, 0],
              scale: [0, 1.3, 1.1, 0.6],
              rotate: [-15, 10, -5, 0],
            }}
            transition={{
              duration: 2.4,
              delay: item.delay,
              repeat: Infinity,
              repeatDelay: 0.4,
              ease: "easeOut",
            }}
            style={{ filter: `drop-shadow(0 0 8px ${item.color})` }}
          >
            <path
              d="M 0 -3 c -5 -9 -16 -2 -10 6 c 2 3 7 6 10 9 c 3 -3 8 -6 10 -9 c 6 -8 -5 -15 -10 -6 z"
              fill={item.color}
              opacity={0.95}
              transform={`scale(${item.size / 14})`}
            />
          </motion.g>
        ) : (
          <motion.g
            key={item.id}
            initial={{ x: item.x, y: item.y, scale: 0, opacity: 0 }}
            animate={{
              scale: [0, 1.4, 1, 1.4, 0.6],
              opacity: [0, 1, 1, 1, 0],
              rotate: [0, 90, 180],
            }}
            transition={{
              duration: 1.6,
              delay: item.delay,
              repeat: Infinity,
              repeatDelay: 0.4,
              ease: "easeOut",
            }}
            style={{ filter: `drop-shadow(0 0 10px ${item.color})` }}
          >
            <path
              d={`M 0 -${item.size / 2} L ${item.size / 8} -${item.size / 8} L ${item.size / 2} 0 L ${item.size / 8} ${item.size / 8} L 0 ${item.size / 2} L -${item.size / 8} ${item.size / 8} L -${item.size / 2} 0 L -${item.size / 8} -${item.size / 8} z`}
              fill={item.color}
            />
          </motion.g>
        ),
      )}
    </motion.g>
  );
}

function RejectOverlay() {
  // Big slashes above each judge plus tiny tear-drops.
  const slashes = [
    { x: 110, y: 200 },
    { x: SCENE_WIDTH / 2, y: 220 },
    { x: SCENE_WIDTH - 110, y: 200 },
  ];
  const drops = [
    { x: 140, y: 250, delay: 0.1 },
    { x: 380, y: 270, delay: 0.5 },
    { x: 600, y: 250, delay: 0.3 },
  ];
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {slashes.map((s, index) => (
        <motion.g
          key={index}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{
            opacity: [0.7, 1, 0.85, 1, 0.7],
            scale: [0.95, 1.15, 1, 1.15, 0.95],
            rotate: [-6, 6, -2, 4, -6],
          }}
          transition={{
            duration: 1.2,
            delay: index * 0.15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            transformBox: "fill-box",
            transformOrigin: `${s.x}px ${s.y}px`,
            filter: "drop-shadow(0 0 8px rgba(248,126,139,0.8))",
          }}
        >
          <line
            x1={s.x - 14}
            y1={s.y - 14}
            x2={s.x + 14}
            y2={s.y + 14}
            stroke="#ff7b8b"
            strokeWidth={4}
            strokeLinecap="round"
          />
          <line
            x1={s.x + 14}
            y1={s.y - 14}
            x2={s.x - 14}
            y2={s.y + 14}
            stroke="#ff7b8b"
            strokeWidth={4}
            strokeLinecap="round"
          />
        </motion.g>
      ))}

      {drops.map((d, index) => (
        <motion.path
          key={`d-${index}`}
          d={`M ${d.x} ${d.y} q -3 4 0 8 q 3 -4 0 -8 z`}
          fill="#9fc5ff"
          initial={{ opacity: 0 }}
          animate={{
            y: [0, 18, 22],
            opacity: [0, 0.85, 0],
          }}
          transition={{
            duration: 1.4,
            delay: d.delay,
            repeat: Infinity,
            repeatDelay: 0.6,
            ease: "easeIn",
          }}
        />
      ))}
    </motion.g>
  );
}

// ── Caption ─────────────────────────────────────────────────────────────────

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
