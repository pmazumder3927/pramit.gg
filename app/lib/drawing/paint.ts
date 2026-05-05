// Stamp-based renderer. Walks each stroke's path, stamping a tinted tip at
// fixed spacing with optional jitter, pressure, and velocity modulation.
//
// Browser-only — depends on document.createElement (via brushes.ts).

import { getBrush, type BrushDef } from "./brushes";
import { mulberry32 } from "./rng";
import type { DrawingStroke } from "./types";

type RenderStrokeOptions = {
  // 0..1; if set, only the first `progress` fraction of the path stamps.
  progress?: number;
};

const DEFAULT_COLOR = "#f5f5f5";

// Cache tips for the current scene. Keyed by brush+size+color. We keep this
// map module-scoped so DrawingCaptcha's frequent re-renders share work.
type TipKey = string;
const tipCache = new Map<TipKey, HTMLCanvasElement>();
const TIP_CACHE_LIMIT = 64;

function getTip(brush: BrushDef, size: number, color: string): HTMLCanvasElement {
  // Quantize size to nearest pixel to keep cache key cardinality bounded.
  const tipPx = Math.max(4, Math.round(size * 2));
  const key = `${brush.id}:${tipPx}:${color}`;
  const cached = tipCache.get(key);
  if (cached) return cached;
  const tip = brush.buildTip(tipPx, color);
  if (tipCache.size >= TIP_CACHE_LIMIT) {
    // Drop the oldest entry — Map preserves insertion order.
    const firstKey = tipCache.keys().next().value;
    if (firstKey) tipCache.delete(firstKey);
  }
  tipCache.set(key, tip);
  return tip;
}

export function clearTipCache() {
  tipCache.clear();
}

export function renderStroke(
  ctx: CanvasRenderingContext2D,
  stroke: DrawingStroke,
  options: RenderStrokeOptions = {},
) {
  const points = stroke.points;
  if (!points || points.length === 0) return;

  const brushId = stroke.brush ?? (stroke.tool === "spray" ? "spray" : "pen");
  const brush = getBrush(brushId);
  const baseSize = Math.max(0.5, stroke.width ?? 5);
  const color = sanitizeColor(stroke.color) ?? DEFAULT_COLOR;
  const baseAlpha = stroke.opacity ?? 1;
  const seed = stroke.seed ?? 1;
  const rng = mulberry32(seed);
  const tip = getTip(brush, baseSize, color);

  const stampSpacing = Math.max(0.5, brush.spacing * baseSize);

  const drawStamp = (
    x: number,
    y: number,
    size: number,
    alpha: number,
    rotation: number,
  ) => {
    ctx.save();
    ctx.globalAlpha = clamp01(alpha);
    ctx.globalCompositeOperation = brush.composite;
    if (rotation !== 0) {
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.drawImage(tip, -size / 2, -size / 2, size, size);
    } else {
      ctx.drawImage(tip, x - size / 2, y - size / 2, size, size);
    }
    ctx.restore();
  };

  const j = brush.jitter;
  const stampAt = (
    x: number,
    y: number,
    pressure: number,
    velocity: number,
  ) => {
    let size = baseSize;
    if (brush.pressureSize) size *= brush.pressureSize(pressure);
    if (brush.velocitySize) size *= brush.velocitySize(velocity);
    const sizeJ = j.size ? 1 + (rng() * 2 - 1) * j.size : 1;
    const jx = j.position ? (rng() * 2 - 1) * j.position * baseSize : 0;
    const jy = j.position ? (rng() * 2 - 1) * j.position * baseSize : 0;
    const jr = j.rotation ? (rng() * 2 - 1) * j.rotation : 0;
    const jo = j.opacity ? 1 - rng() * j.opacity : 1;
    drawStamp(
      x + jx,
      y + jy,
      Math.max(0.5, size * sizeJ),
      baseAlpha * brush.flow * jo,
      jr,
    );
  };

  // Compute path length up front so progress slicing is easy.
  if (points.length === 1) {
    const p = points[0];
    stampAt(p.x, p.y, p.p ?? 0.5, 0);
    return;
  }

  const segLens: number[] = new Array(points.length - 1);
  let totalLen = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const l = Math.hypot(dx, dy);
    segLens[i] = l;
    totalLen += l;
  }

  const targetLen =
    options.progress !== undefined ? totalLen * clamp01(options.progress) : totalLen;
  if (targetLen <= 0) return;

  let cursor = 0;
  let walked = 0;

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const segLen = segLens[i];
    if (segLen === 0) continue;

    while (cursor <= walked + segLen && cursor <= targetLen) {
      const t = segLen === 0 ? 0 : (cursor - walked) / segLen;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      const pressure = lerp(a.p ?? 0.5, b.p ?? 0.5, t);
      let velocity = 0;
      if (a.t !== undefined && b.t !== undefined) {
        const dt = Math.max(1, b.t - a.t);
        velocity = segLen / dt;
      }
      stampAt(x, y, pressure, velocity);
      cursor += stampSpacing;
      if (cursor > targetLen) break;
    }
    walked += segLen;
    if (cursor > targetLen) break;
  }

  // Always stamp the final point so the line closes cleanly even if the
  // cursor overshot just before reaching the end.
  if (options.progress === undefined || options.progress >= 1) {
    const last = points[points.length - 1];
    stampAt(last.x, last.y, last.p ?? 0.5, 0);
  }
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  strokes: DrawingStroke[],
) {
  for (const stroke of strokes) {
    renderStroke(ctx, stroke);
  }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp01(value: number) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function sanitizeColor(value: string | undefined) {
  if (typeof value !== "string") return null;
  return /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : null;
}
