import { createHmac, randomUUID, timingSafeEqual } from "crypto";

import OpenAI from "openai";
import sharp from "sharp";

import {
  CAPTCHA_MIN_SOLVE_MS,
  CAPTCHA_TTL_MS,
  CAPTCHA_VERSION,
  DRAWING_CANVAS_HEIGHT,
  DRAWING_CANVAS_WIDTH,
  type ConfessionalCaptchaChallenge,
  type ConfessionalCaptchaSubmission,
  type DrawingStroke,
  evaluateDrawing,
} from "@/app/lib/confessional-captcha";

const DRAWING_SUBJECTS = [
  "a turtle",
  "a fish",
  "a cat",
  "a dog",
  "a bird",
  "a snail",
  "a butterfly",
  "a tree",
  "a flower",
  "a mushroom",
  "a leaf",
  "a sun",
  "a moon",
  "a star",
  "a cloud",
  "a house",
  "a chair",
  "a teapot",
  "a mug",
  "an umbrella",
  "a key",
  "a book",
  "a balloon",
  "a kite",
  "a sailboat",
  "a hot air balloon",
  "a slice of pizza",
  "an ice cream cone",
  "a banana",
  "a strawberry",
  "a heart",
  "a smiley face",
  "an eye",
  "a hand",
  "a pair of glasses",
  "a hat",
  "a guitar",
  "a piano",
  "a paper airplane",
  "a snowman",
];

const DEFAULT_VISION_MODEL = "gpt-4o-mini";

type CaptchaVerificationResult =
  | { ok: true; challenge: ConfessionalCaptchaChallenge; matchReason: string }
  | { ok: false; error: string };

let cachedClient: OpenAI | null = null;

export function createConfessionalCaptchaChallenge() {
  const issuedAt = Date.now();
  const drawingPrompt = pick(DRAWING_SUBJECTS);

  const challenge: ConfessionalCaptchaChallenge = {
    version: CAPTCHA_VERSION,
    challengeId: randomUUID(),
    issuedAt,
    expiresAt: issuedAt + CAPTCHA_TTL_MS,
    minSolveMs: CAPTCHA_MIN_SOLVE_MS,
    drawingPrompt,
  };

  return {
    token: signChallenge(challenge),
    challenge,
  };
}

export async function verifyConfessionalCaptchaSubmission(
  submission: unknown,
): Promise<CaptchaVerificationResult> {
  if (!isSubmission(submission)) {
    return { ok: false, error: "The council needs your drawing." };
  }

  const challenge = decodeChallenge(submission.token);
  if (!challenge) {
    return { ok: false, error: "The council could not verify the challenge." };
  }

  const now = Date.now();

  if (challenge.expiresAt <= now) {
    return { ok: false, error: "Challenge expired. Refresh and try again." };
  }

  if (challenge.issuedAt + challenge.minSolveMs > now) {
    return {
      ok: false,
      error: `Take at least ${Math.ceil(challenge.minSolveMs / 1000)} seconds with your drawing.`,
    };
  }

  const drawing = evaluateDrawing(submission.strokes);
  if (!drawing.ok) {
    return {
      ok: false,
      error: drawing.errors[0] ?? "Add a little more to your drawing.",
    };
  }

  let imageDataUrl: string;
  try {
    imageDataUrl = await renderStrokesToDataUrl(submission.strokes);
  } catch (renderError) {
    console.error("Drawing render error:", renderError);
    return { ok: false, error: "Could not process the drawing. Try again." };
  }

  const verdict = await classifyDrawing({
    prompt: challenge.drawingPrompt,
    imageDataUrl,
  });

  if (!verdict.ok) {
    return { ok: false, error: verdict.error };
  }

  if (!verdict.matches) {
    return {
      ok: false,
      error: `The council is unconvinced — that doesn't quite read as ${challenge.drawingPrompt}.`,
    };
  }

  return { ok: true, challenge, matchReason: verdict.reason };
}

async function renderStrokesToDataUrl(
  strokes: DrawingStroke[],
): Promise<string> {
  const svg = strokesToSvg(strokes);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

function strokesToSvg(strokes: DrawingStroke[]) {
  const paths = strokes
    .map((stroke) => {
      const points = Array.isArray(stroke?.points) ? stroke.points : [];
      if (points.length === 0) {
        return "";
      }

      const color = sanitizeColor(stroke.color) ?? "#f5f5f5";
      const width = sanitizeWidth(stroke.width) ?? 5;

      if (points.length === 1) {
        const p = points[0];
        return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(width / 2).toFixed(1)}" fill="${color}"/>`;
      }

      const d = points
        .map((point, index) => {
          const command = index === 0 ? "M" : "L";
          return `${command}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
        })
        .join(" ");

      return `<path d="${d}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
    })
    .filter(Boolean)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${DRAWING_CANVAS_WIDTH}" height="${DRAWING_CANVAS_HEIGHT}" viewBox="0 0 ${DRAWING_CANVAS_WIDTH} ${DRAWING_CANVAS_HEIGHT}">
  <rect width="100%" height="100%" fill="#0a0814"/>
  ${paths}
</svg>`;
}

function sanitizeColor(value: unknown) {
  if (typeof value !== "string") return null;
  return /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : null;
}

function sanitizeWidth(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(20, Math.max(1, value));
}

type DrawingVerdict =
  | { ok: true; matches: boolean; reason: string }
  | { ok: false; error: string };

async function classifyDrawing({
  prompt,
  imageDataUrl,
}: {
  prompt: string;
  imageDataUrl: string;
}): Promise<DrawingVerdict> {
  const client = getOpenAIClient();
  if (!client) {
    return {
      ok: false,
      error: "The council is asleep. Please try again later.",
    };
  }

  const model = process.env.OPENAI_VISION_MODEL?.trim() || DEFAULT_VISION_MODEL;

  try {
    const response = await client.chat.completions.create(
      {
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You verify captcha sketches. The user was asked to draw a specific subject and you must decide if the sketch depicts that subject.\n\n" +
              "Accept (matches: true) when:\n" +
              "- The sketch is a sincere, recognizable attempt at the target subject, even if crude or stylized.\n" +
              "- Key identifying features of the subject are present.\n\n" +
              "Reject (matches: false) when ANY of these apply:\n" +
              "- The drawing is blank or near-blank (a single dot, a tiny mark, almost nothing on the canvas).\n" +
              "- The drawing is just random scribbles, lines, or noise with no recognizable subject.\n" +
              "- The drawing depicts a different subject than the target.\n" +
              "- You cannot identify any subject in the drawing.\n\n" +
              "Be generous about artistic skill — these are rough finger sketches — but strict about whether the target subject is actually depicted. " +
              'Reply with strict JSON: {"matches": boolean, "reason": "<one short sentence explaining your decision>"}.',
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Target subject: ${prompt}. Does this sketch reasonably depict that subject?`,
              },
              {
                type: "image_url",
                image_url: { url: imageDataUrl, detail: "low" },
              },
            ],
          },
        ],
      },
      { timeout: 15_000 },
    );

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) {
      return { ok: false, error: "The council was silent. Try again." };
    }

    const parsed = JSON.parse(raw) as { matches?: unknown; reason?: unknown };
    const matches = parsed.matches === true;
    const reason =
      typeof parsed.reason === "string" && parsed.reason.length > 0
        ? parsed.reason
        : matches
          ? "the council approves"
          : "the council disapproves";

    return { ok: true, matches, reason };
  } catch (error) {
    console.error("Drawing classification error:", error);
    return { ok: false, error: "The council was distracted. Try again." };
  }
}

function getOpenAIClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

function signChallenge(challenge: ConfessionalCaptchaChallenge) {
  const payload = Buffer.from(JSON.stringify(challenge)).toString("base64url");
  const signature = createHmac("sha256", getCaptchaSecret())
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function decodeChallenge(token: string) {
  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = createHmac("sha256", getCaptchaSecret())
    .update(payload)
    .digest("base64url");

  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as ConfessionalCaptchaChallenge;

    if (decoded.version !== CAPTCHA_VERSION) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

function getCaptchaSecret() {
  return (
    process.env.CONFESSIONAL_CAPTCHA_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "local-confessional-captcha-secret"
  );
}

function isSubmission(value: unknown): value is ConfessionalCaptchaSubmission {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ConfessionalCaptchaSubmission>;

  return (
    typeof candidate.token === "string" &&
    Array.isArray(candidate.strokes) &&
    candidate.strokes.every(isStroke)
  );
}

function isStroke(value: unknown): value is DrawingStroke {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as Partial<DrawingStroke>).points),
  );
}

function pick<T>(values: T[]) {
  return values[Math.floor(Math.random() * values.length)];
}
