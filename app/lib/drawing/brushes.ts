// Procedural brushes. Each brush builds an offscreen tip canvas tinted with
// the stroke color; the paint engine stamps that tip along the path.
//
// All functions below assume the browser environment (use document.createElement).
// Server-side renderers should not import this module.

import type { BrushId } from "./types";

export type BrushDef = {
  id: BrushId;
  // Builds a tinted tip for a given size + color. Cached by the paint engine.
  buildTip: (size: number, color: string) => HTMLCanvasElement;
  // Step between stamps as a multiple of the stamp size. Smaller = denser.
  spacing: number;
  // Per-stamp jitter amounts.
  jitter: {
    position?: number;
    rotation?: number;
    size?: number;
    opacity?: number;
  };
  composite: GlobalCompositeOperation;
  // Optional pressure→size response. Returns multiplier on baseSize.
  pressureSize?: (pressure: number) => number;
  // Optional velocity (px/ms)→size response.
  velocitySize?: (velocity: number) => number;
  // Per-stamp opacity multiplier (already baked into stroke opacity in
  // most cases, but used by pencil/charcoal for cumulative buildup).
  flow: number;
};

const TWO_PI = Math.PI * 2;

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

// A radial-falloff disc tinted with `color`. `hardness` 0..1 controls how
// long the solid core lasts before the alpha falloff starts.
function softDisc(
  size: number,
  color: string,
  hardness: number,
): HTMLCanvasElement {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(hardness, "rgba(255,255,255,1)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

// Add multiplicative noise to an existing tip. `intensity` 0..1.
function noisify(canvas: HTMLCanvasElement, intensity: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = img.data;
  for (let i = 3; i < data.length; i += 4) {
    const factor = 1 - intensity + Math.random() * intensity;
    data[i] = Math.floor(data[i] * factor);
  }
  ctx.putImageData(img, 0, 0);
}

// Angular streak texture for charcoal-style brushes.
function streaks(canvas: HTMLCanvasElement, count: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.strokeStyle = "rgba(0,0,0,1)";
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * TWO_PI;
    const r1 = (Math.random() * canvas.width) / 2;
    const r2 = r1 + (Math.random() * canvas.width) / 4;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    ctx.lineWidth = 0.4 + Math.random() * 0.8;
    ctx.globalAlpha = 0.2 + Math.random() * 0.4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
    ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
    ctx.stroke();
  }
  ctx.restore();
}

// ── Brush definitions ───────────────────────────────────────────────────────

const PEN: BrushDef = {
  id: "pen",
  buildTip: (size, color) => softDisc(Math.max(2, size), color, 0.85),
  spacing: 0.06,
  jitter: {},
  composite: "source-over",
  pressureSize: (p) => 0.55 + p * 0.7,
  velocitySize: (v) => Math.max(0.6, 1 - Math.min(v, 3) * 0.12),
  flow: 1,
};

const FINELINER: BrushDef = {
  id: "fineliner",
  buildTip: (size, color) => softDisc(Math.max(2, size), color, 0.9),
  spacing: 0.05,
  jitter: { position: 0.02 },
  composite: "source-over",
  pressureSize: (p) => 0.7 + p * 0.5,
  flow: 1,
};

const PENCIL: BrushDef = {
  id: "pencil",
  buildTip: (size, color) => {
    const canvas = softDisc(Math.max(4, size), color, 0.45);
    noisify(canvas, 0.7);
    return canvas;
  },
  spacing: 0.08,
  jitter: { position: 0.18, rotation: Math.PI, opacity: 0.3 },
  composite: "source-over",
  pressureSize: (p) => 0.6 + p * 0.6,
  flow: 0.55,
};

const MARKER: BrushDef = {
  id: "marker",
  buildTip: (size, color) => softDisc(Math.max(4, size), color, 0.7),
  spacing: 0.1,
  jitter: { size: 0.1 },
  composite: "source-over",
  pressureSize: (p) => 0.85 + p * 0.3,
  flow: 0.55,
};

const BRUSH: BrushDef = {
  id: "brush",
  buildTip: (size, color) => softDisc(Math.max(4, size), color, 0.55),
  spacing: 0.04,
  jitter: { position: 0.05 },
  composite: "source-over",
  pressureSize: (p) => 0.35 + p * 1.5,
  velocitySize: (v) => Math.max(0.5, 1 - Math.min(v, 4) * 0.1),
  flow: 0.85,
};

const CHARCOAL: BrushDef = {
  id: "charcoal",
  buildTip: (size, color) => {
    const canvas = softDisc(Math.max(6, size), color, 0.35);
    noisify(canvas, 0.6);
    streaks(canvas, Math.max(8, Math.floor(size * 1.5)));
    return canvas;
  },
  spacing: 0.12,
  jitter: { position: 0.25, rotation: Math.PI, size: 0.2, opacity: 0.25 },
  composite: "source-over",
  pressureSize: (p) => 0.65 + p * 0.7,
  flow: 0.7,
};

const WATERCOLOR: BrushDef = {
  id: "watercolor",
  buildTip: (size, color) => softDisc(Math.max(8, size), color, 0.2),
  spacing: 0.18,
  jitter: { position: 0.3, opacity: 0.4, size: 0.15 },
  // Multiply gives the buildup-on-overlap effect that's the whole point of
  // watercolor. Subsequent strokes deepen the existing wash.
  composite: "multiply",
  flow: 0.35,
};

const SPRAY: BrushDef = {
  id: "spray",
  buildTip: (size, color) => softDisc(Math.max(2, Math.round(size * 0.4)), color, 1),
  spacing: 0.5,
  jitter: { position: 1.6, opacity: 0.5, size: 0.4 },
  composite: "source-over",
  flow: 0.55,
};

// Eraser uses destination-out compositing so it actually removes pixels
// from the committed canvas instead of painting over them.
const ERASER: BrushDef = {
  id: "eraser",
  buildTip: (size) => softDisc(Math.max(4, size), "#000000", 0.6),
  spacing: 0.08,
  jitter: {},
  composite: "destination-out",
  flow: 1,
};

export const BRUSHES: Record<BrushId, BrushDef> = {
  pen: PEN,
  fineliner: FINELINER,
  pencil: PENCIL,
  marker: MARKER,
  brush: BRUSH,
  charcoal: CHARCOAL,
  watercolor: WATERCOLOR,
  spray: SPRAY,
  eraser: ERASER,
};

export const BRUSH_ORDER: BrushId[] = [
  "pen",
  "fineliner",
  "pencil",
  "marker",
  "brush",
  "charcoal",
  "watercolor",
  "spray",
  "eraser",
];

export function getBrush(id: BrushId | undefined): BrushDef {
  return id ? (BRUSHES[id] ?? BRUSHES.pen) : BRUSHES.pen;
}
