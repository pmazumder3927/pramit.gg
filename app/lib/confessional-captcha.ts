export const CAPTCHA_VERSION = 4 as const;
export const CAPTCHA_TTL_MS = 10 * 60 * 1000;
export const CAPTCHA_MIN_SOLVE_MS = 6_000;
export const DRAWING_CANVAS_WIDTH = 480;
export const DRAWING_CANVAS_HEIGHT = 320;
export const DRAWING_MIN_STROKES = 1;
export const DRAWING_MIN_TOTAL_LENGTH = 120;
export const DRAWING_MAX_LEVEL = 5;

export type DrawingPoint = {
  x: number;
  y: number;
};

export type DrawingStroke = {
  points: DrawingPoint[];
  color?: string;
  width?: number;
};

export type ConfessionalCaptchaChallenge = {
  version: typeof CAPTCHA_VERSION;
  challengeId: string;
  issuedAt: number;
  expiresAt: number;
  minSolveMs: number;
  drawingPrompt: string;
  level: number;
  levelLabel: string;
  globalIndex: number;
};

export type ConfessionalCaptchaSubmission = {
  token: string;
  strokes: DrawingStroke[];
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
      points: Array.isArray(stroke?.points)
        ? stroke.points.filter(isValidPoint)
        : [],
    }))
    .filter((stroke) => stroke.points.length > 0);

  const totalLength = normalized.reduce(
    (sum, stroke) => sum + strokeLength(stroke.points),
    0,
  );

  const strokeCountOk = normalized.length >= DRAWING_MIN_STROKES;
  const lengthOk = totalLength >= DRAWING_MIN_TOTAL_LENGTH;

  const checklist: DrawingChecklistItem[] = [
    {
      key: "strokes",
      label: "at least one stroke on the canvas",
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
    errors.push("Add at least one stroke before submitting.");
  }
  if (!lengthOk) {
    errors.push("Draw a little more — a single dot is not enough.");
  }

  return {
    ok: checklist.every((item) => item.passed),
    errors,
    checklist,
    totalLength,
  };
}

function strokeLength(points: DrawingPoint[]) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += Math.hypot(
      points[index].x - points[index - 1].x,
      points[index].y - points[index - 1].y,
    );
  }
  return length;
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
