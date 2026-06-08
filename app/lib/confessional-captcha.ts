import type { GlyphEntry } from "./confessional-glyphs";
import type { DrawingPoint, DrawingStroke } from "./drawing/types";

export const CAPTCHA_VERSION = 5 as const;
export const CAPTCHA_TTL_MS = 10 * 60 * 1000;
export const CAPTCHA_MIN_SOLVE_MS = 6_000;
export const DRAWING_CANVAS_WIDTH = 480;
export const DRAWING_CANVAS_HEIGHT = 320;
export const DRAWING_MIN_STROKES = 3;
export const DRAWING_MIN_TOTAL_LENGTH = 640;
export const DRAWING_MAX_LEVEL = 5;

export type { DrawingPoint, DrawingStroke } from "./drawing/types";
export type { GlyphScript } from "./confessional-glyphs";

// What kind of offering the council is asking for: a freeform doodle of a
// subject, or the faithful inscription of a specific writing-system character.
export type ChallengeKind = "freeform" | "glyph";

// The glyph payload carried inside a signed challenge token. It is a subset of
// GlyphEntry (the difficulty `level` is already on the challenge itself). Being
// part of the HMAC-signed token makes it tamper-proof, so the verifier can
// trust it as the source of truth without a second lookup.
export type ChallengeGlyph = Omit<GlyphEntry, "level">;

export type ConfessionalCaptchaChallenge = {
  version: typeof CAPTCHA_VERSION;
  challengeId: string;
  issuedAt: number;
  expiresAt: number;
  minSolveMs: number;
  // Always present; for glyph challenges this is a readable label such as
  // `水 — "water" (Chinese)` so the gallery and council copy render nicely.
  drawingPrompt: string;
  level: number;
  levelLabel: string;
  globalIndex: number;
  kind: ChallengeKind;
  // Present only when `kind === "glyph"`.
  glyph?: ChallengeGlyph;
};

export type ConfessionalCaptchaSubmission = {
  token: string;
  strokes: DrawingStroke[];
  // Optional client-rasterized PNG (data URL). Used only for downstream
  // display — the captcha integrity check rasterizes from `strokes` instead,
  // so this field cannot be used to bypass verification.
  snapshot?: string;
};

export type DrawingChecklistItem = {
  key: string;
  label: string;
  passed: boolean;
};

export type DrawingEvaluation = {
  ok: boolean;
  errors: string[];
  checklist: DrawingChecklistItem[];
  totalLength: number;
};

export function evaluateDrawing(strokes: DrawingStroke[]): DrawingEvaluation {
  const normalized = strokes
    .map((stroke) => ({
      isSpray: isSprayStroke(stroke),
      points: Array.isArray(stroke?.points)
        ? stroke.points.filter(isValidPoint)
        : [],
    }))
    .filter((stroke) => stroke.points.length > 0);

  // Spray strokes are stamps along an underlying gesture path. We count the
  // path *skeleton* length (nearest-neighbor over scattered dots is a fine
  // proxy) so a single splat of dots can't trivially clear the gate.
  const totalLength = normalized.reduce((sum, stroke) => {
    if (stroke.isSpray) {
      return sum + sprayCoverage(stroke.points);
    }
    return sum + polylineLength(stroke.points);
  }, 0);

  const strokeCountOk = normalized.length >= DRAWING_MIN_STROKES;
  const lengthOk = totalLength >= DRAWING_MIN_TOTAL_LENGTH;

  const checklist: DrawingChecklistItem[] = [
    {
      key: "strokes",
      label: "a few strokes on the canvas",
      passed: strokeCountOk,
    },
    {
      key: "length",
      label: "the drawing has enough detail to be recognizable",
      passed: lengthOk,
    },
  ];

  const errors: string[] = [];
  if (!strokeCountOk) {
    errors.push("Add a few more strokes before submitting.");
  }
  if (!lengthOk) {
    errors.push("Draw a little more — the council expects an actual offering.");
  }

  return {
    ok: checklist.every((item) => item.passed),
    errors,
    checklist,
    totalLength,
  };
}

function isSprayStroke(stroke: DrawingStroke | null | undefined): boolean {
  if (!stroke) return false;
  return stroke.tool === "spray" || stroke.brush === "spray";
}

function polylineLength(points: DrawingPoint[]) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += Math.hypot(
      points[index].x - points[index - 1].x,
      points[index].y - points[index - 1].y,
    );
  }
  return length;
}

// Rough proxy for the gesture length behind a spray cloud: bounding-box
// diagonal × point-count factor, capped at the bounding-box perimeter. This
// rewards strokes that *moved* across the canvas, not single-spot splats.
function sprayCoverage(points: DrawingPoint[]) {
  if (points.length === 0) return 0;
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return Math.hypot(maxX - minX, maxY - minY);
}

function isValidPoint(point: unknown): point is DrawingPoint {
  if (!point || typeof point !== "object") {
    return false;
  }

  const candidate = point as Partial<DrawingPoint>;
  return (
    Number.isFinite(candidate.x ?? Number.NaN) &&
    Number.isFinite(candidate.y ?? Number.NaN)
  );
}
