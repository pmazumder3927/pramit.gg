export const CAPTCHA_VERSION = 1 as const;
export const CAPTCHA_TTL_MS = 10 * 60 * 1000;
export const CAPTCHA_MIN_SOLVE_MS = 9_000;
export const TURTLE_CANVAS_WIDTH = 320;
export const TURTLE_CANVAS_HEIGHT = 220;

export type CaptchaGlyph = {
  id: string;
  label: string;
  symbol: string;
  accent: string;
};

export type TurtlePoint = {
  x: number;
  y: number;
};

export type TurtleStroke = {
  points: TurtlePoint[];
};

export type ConfessionalCaptchaChallenge = {
  version: typeof CAPTCHA_VERSION;
  challengeId: string;
  issuedAt: number;
  expiresAt: number;
  minSolveMs: number;
  phrase: string;
  glyphs: CaptchaGlyph[];
  glyphOrder: string[];
  turtleSteps: string[];
};

export type ConfessionalCaptchaSubmission = {
  token: string;
  phrase: string;
  glyphOrder: string[];
  strokes: TurtleStroke[];
};

export type TurtleChecklistItem = {
  key: string;
  label: string;
  passed: boolean;
};

export type TurtleEvaluation = {
  ok: boolean;
  errors: string[];
  checklist: TurtleChecklistItem[];
};

type StrokeMetrics = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  length: number;
};

const TURTLE_CHECKLIST: TurtleChecklistItem[] = [
  {
    key: "shell",
    label: "Stroke 1 is a closed shell loop near the middle of the canvas",
    passed: false,
  },
  {
    key: "head",
    label: "Stroke 2 is a head to the right of the shell",
    passed: false,
  },
  {
    key: "legs",
    label: "Strokes 3-6 are four separate legs below the shell",
    passed: false,
  },
  {
    key: "tail",
    label: "Stroke 7 is a tail to the left of the shell",
    passed: false,
  },
];

export function evaluateTurtleDrawing(strokes: TurtleStroke[]): TurtleEvaluation {
  const checklist = TURTLE_CHECKLIST.map((item) => ({ ...item }));
  const errors: string[] = [];

  if (strokes.length !== 7) {
    errors.push("Use exactly 7 strokes: shell, head, four legs, then tail.");
  }

  const normalizedStrokes = strokes
    .map((stroke) => ({
      points: Array.isArray(stroke.points) ? stroke.points.filter(isValidPoint) : [],
    }))
    .filter((stroke) => stroke.points.length > 0);

  if (normalizedStrokes.length !== 7) {
    if (!errors.length) {
      errors.push("The turtle needs 7 visible strokes before it can be verified.");
    }

    return {
      ok: false,
      errors,
      checklist,
    };
  }

  const [shellStroke, headStroke, ...rest] = normalizedStrokes;
  const legStrokes = rest.slice(0, 4);
  const tailStroke = rest[4];

  const shellMetrics = getStrokeMetrics(shellStroke);
  const headMetrics = getStrokeMetrics(headStroke);
  const legMetrics = legStrokes.map(getStrokeMetrics);
  const tailMetrics = getStrokeMetrics(tailStroke);

  const shellClosedDistance = distance(
    shellStroke.points[0],
    shellStroke.points[shellStroke.points.length - 1]
  );

  const shellOk =
    shellStroke.points.length >= 16 &&
    shellMetrics.width >= 70 &&
    shellMetrics.height >= 45 &&
    shellMetrics.width / shellMetrics.height >= 1.1 &&
    shellMetrics.width / shellMetrics.height <= 2.6 &&
    shellMetrics.centerX >= TURTLE_CANVAS_WIDTH * 0.25 &&
    shellMetrics.centerX <= TURTLE_CANVAS_WIDTH * 0.75 &&
    shellMetrics.centerY >= TURTLE_CANVAS_HEIGHT * 0.25 &&
    shellMetrics.centerY <= TURTLE_CANVAS_HEIGHT * 0.65 &&
    shellClosedDistance <= 30;

  if (shellOk) {
    checklist[0].passed = true;
  } else {
    errors.push("Stroke 1 needs to be a closed shell loop in the center.");
  }

  const headOk =
    shellOk &&
    headStroke.points.length >= 2 &&
    headMetrics.length >= 10 &&
    headMetrics.width <= 70 &&
    headMetrics.height <= 60 &&
    headMetrics.centerX > shellMetrics.maxX - 6 &&
    headMetrics.centerY >= shellMetrics.minY - 24 &&
    headMetrics.centerY <= shellMetrics.maxY + 24;

  if (headOk) {
    checklist[1].passed = true;
  } else {
    errors.push("Stroke 2 needs to place a head on the right side of the shell.");
  }

  const shellMidX = (shellMetrics.minX + shellMetrics.maxX) / 2;
  const legSummary = legMetrics.reduce(
    (summary, metrics) => {
      const legValid =
        metrics.length >= 8 &&
        metrics.width <= 36 &&
        metrics.height <= 50 &&
        metrics.centerX >= shellMetrics.minX - 20 &&
        metrics.centerX <= shellMetrics.maxX + 20 &&
        metrics.centerY >= shellMetrics.centerY - 4 &&
        metrics.maxY >= shellMetrics.maxY - 2;

      if (legValid) {
        summary.validCount += 1;
        if (metrics.centerX < shellMidX) {
          summary.leftCount += 1;
        } else {
          summary.rightCount += 1;
        }
      }

      return summary;
    },
    { validCount: 0, leftCount: 0, rightCount: 0 }
  );

  const legsOk =
    shellOk &&
    legSummary.validCount === 4 &&
    legSummary.leftCount >= 2 &&
    legSummary.rightCount >= 2;

  if (legsOk) {
    checklist[2].passed = true;
  } else {
    errors.push("Strokes 3-6 need to be four separate legs beneath the shell.");
  }

  const tailOk =
    shellOk &&
    tailStroke.points.length >= 2 &&
    tailMetrics.length >= 8 &&
    tailMetrics.width <= 36 &&
    tailMetrics.height <= 40 &&
    tailMetrics.centerX < shellMetrics.minX + 8 &&
    tailMetrics.centerY >= shellMetrics.minY - 20 &&
    tailMetrics.centerY <= shellMetrics.maxY + 20;

  if (tailOk) {
    checklist[3].passed = true;
  } else {
    errors.push("Stroke 7 needs to be a tail on the left side of the shell.");
  }

  return {
    ok: checklist.every((item) => item.passed),
    errors: unique(errors),
    checklist,
  };
}

export function normalizeCaptchaPhrase(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function getStrokeMetrics(stroke: TurtleStroke): StrokeMetrics {
  const xs = stroke.points.map((point) => point.x);
  const ys = stroke.points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  let length = 0;
  for (let index = 1; index < stroke.points.length; index += 1) {
    length += distance(stroke.points[index - 1], stroke.points[index]);
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    length,
  };
}

function distance(first: TurtlePoint, second: TurtlePoint) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function isFiniteNumber(value: number) {
  return Number.isFinite(value);
}

function isValidPoint(point: unknown): point is TurtlePoint {
  if (!point || typeof point !== "object") {
    return false;
  }

  const candidate = point as Partial<TurtlePoint>;
  return isFiniteNumber(candidate.x ?? Number.NaN) && isFiniteNumber(candidate.y ?? Number.NaN);
}
