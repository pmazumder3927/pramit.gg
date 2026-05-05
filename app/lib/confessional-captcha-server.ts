import { createHmac, randomUUID, timingSafeEqual } from "crypto";

import OpenAI from "openai";

import {
  CAPTCHA_MIN_SOLVE_MS,
  CAPTCHA_TTL_MS,
  CAPTCHA_VERSION,
  DRAWING_IMAGE_MAX_BYTES,
  type CaptchaGlyph,
  type ConfessionalCaptchaChallenge,
  type ConfessionalCaptchaSubmission,
  type DrawingStroke,
  evaluateDrawing,
  normalizeCaptchaPhrase,
} from "@/app/lib/confessional-captcha";

const GLYPH_CATALOG: CaptchaGlyph[] = [
  { id: "fern", label: "fern", symbol: "❦", accent: "#90f6c3" },
  { id: "shell", label: "shell", symbol: "◔", accent: "#f5ca9f" },
  { id: "comet", label: "comet", symbol: "✦", accent: "#b7c7ff" },
  { id: "puddle", label: "puddle", symbol: "◡", accent: "#8fe5ff" },
  { id: "moss", label: "moss", symbol: "⬒", accent: "#a7f27a" },
  { id: "orbit", label: "orbit", symbol: "◎", accent: "#ffb4d9" },
  { id: "lantern", label: "lantern", symbol: "◌", accent: "#ffd36d" },
  { id: "tide", label: "tide", symbol: "≈", accent: "#9fd1ff" },
];

const PHRASE_OPENERS = ["moss turtle", "quiet turtle", "midnight turtle", "honest turtle"];
const PHRASE_VERBS = ["guards", "admits", "survives", "outsmarts"];
const PHRASE_OBJECTS = ["the human inbox", "this tiny confessional", "a sincere message", "the spam swamp"];

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
  const glyphs = shuffle([...GLYPH_CATALOG]).slice(0, 6);
  const glyphOrder = shuffle([...glyphs]).slice(0, 4).map((glyph) => glyph.id);
  const phrase = normalizeCaptchaPhrase(
    `${pick(PHRASE_OPENERS)} ${pick(PHRASE_VERBS)} ${pick(PHRASE_OBJECTS)}`,
  );
  const drawingPrompt = pick(DRAWING_SUBJECTS);

  const challenge: ConfessionalCaptchaChallenge = {
    version: CAPTCHA_VERSION,
    challengeId: randomUUID(),
    issuedAt,
    expiresAt: issuedAt + CAPTCHA_TTL_MS,
    minSolveMs: CAPTCHA_MIN_SOLVE_MS,
    phrase,
    glyphs,
    glyphOrder,
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
    return { ok: false, error: "Complete the captcha ritual before sending." };
  }

  const challenge = decodeChallenge(submission.token);
  if (!challenge) {
    return { ok: false, error: "Captcha challenge could not be verified." };
  }

  const now = Date.now();

  if (challenge.expiresAt <= now) {
    return { ok: false, error: "Captcha expired. Refresh the ritual and try again." };
  }

  if (challenge.issuedAt + challenge.minSolveMs > now) {
    return {
      ok: false,
      error: `Take at least ${Math.ceil(challenge.minSolveMs / 1000)} seconds to finish the ritual.`,
    };
  }

  if (normalizeCaptchaPhrase(submission.phrase) !== challenge.phrase) {
    return { ok: false, error: "Passphrase mismatch. Copy the phrase exactly." };
  }

  if (submission.glyphOrder.length !== challenge.glyphOrder.length) {
    return { ok: false, error: "Tap the glyphs in the requested order first." };
  }

  const glyphOrderMatches = submission.glyphOrder.every(
    (glyphId, index) => glyphId === challenge.glyphOrder[index],
  );

  if (!glyphOrderMatches) {
    return { ok: false, error: "The glyph order was incorrect." };
  }

  const drawing = evaluateDrawing(submission.strokes);
  if (!drawing.ok) {
    return {
      ok: false,
      error: drawing.errors[0] ?? "Add a little more to your drawing.",
    };
  }

  const imageCheck = validateImagePayload(submission.image);
  if (!imageCheck.ok) {
    return { ok: false, error: imageCheck.error };
  }

  const verdict = await classifyDrawing({
    prompt: challenge.drawingPrompt,
    imageDataUrl: submission.image,
  });

  if (!verdict.ok) {
    return { ok: false, error: verdict.error };
  }

  if (!verdict.matches) {
    return {
      ok: false,
      error: `That doesn't quite read as ${challenge.drawingPrompt}. Try again.`,
    };
  }

  return { ok: true, challenge, matchReason: verdict.reason };
}

type ImageValidation =
  | { ok: true; bytes: number }
  | { ok: false; error: string };

function validateImagePayload(image: string): ImageValidation {
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return { ok: false, error: "Drawing image was missing or malformed." };
  }

  const commaIndex = image.indexOf(",");
  if (commaIndex < 0) {
    return { ok: false, error: "Drawing image was missing or malformed." };
  }

  // base64 encoded length is ~4/3 of byte length; clamp to byte budget.
  const base64Length = image.length - commaIndex - 1;
  const approxBytes = Math.ceil((base64Length * 3) / 4);

  if (approxBytes > DRAWING_IMAGE_MAX_BYTES) {
    return { ok: false, error: "Drawing image is too large." };
  }

  return { ok: true, bytes: approxBytes };
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
      error: "Drawing review is unavailable right now. Please try again later.",
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
              "You are a generous captcha verifier reviewing rough finger sketches. " +
              "Decide whether a quick, sincere sketch reasonably depicts a target subject. " +
              "Sketches are crude — be lenient, accept any reasonable attempt, and only reject if it is clearly a different subject, just scribbles, or essentially blank. " +
              'Always reply with strict JSON of the form {"matches": boolean, "reason": "<one short sentence>"}.',
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
      return { ok: false, error: "Could not review the drawing. Try again." };
    }

    const parsed = JSON.parse(raw) as { matches?: unknown; reason?: unknown };
    const matches = parsed.matches === true;
    const reason =
      typeof parsed.reason === "string" && parsed.reason.length > 0
        ? parsed.reason
        : matches
          ? "looks right"
          : "doesn't match";

    return { ok: true, matches, reason };
  } catch (error) {
    console.error("Drawing classification error:", error);
    return { ok: false, error: "Could not review the drawing. Try again." };
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
    typeof candidate.phrase === "string" &&
    Array.isArray(candidate.glyphOrder) &&
    candidate.glyphOrder.every((glyphId) => typeof glyphId === "string") &&
    Array.isArray(candidate.strokes) &&
    candidate.strokes.every(isStroke) &&
    typeof candidate.image === "string"
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

function shuffle<T>(values: T[]) {
  const copy = [...values];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}
