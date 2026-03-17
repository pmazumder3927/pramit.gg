import { createHmac, randomUUID, timingSafeEqual } from "crypto";

import {
  CAPTCHA_MIN_SOLVE_MS,
  CAPTCHA_TTL_MS,
  CAPTCHA_VERSION,
  type CaptchaGlyph,
  type ConfessionalCaptchaChallenge,
  type ConfessionalCaptchaSubmission,
  type TurtleStroke,
  evaluateTurtleDrawing,
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

type CaptchaVerificationResult =
  | { ok: true; challenge: ConfessionalCaptchaChallenge }
  | { ok: false; error: string };

export function createConfessionalCaptchaChallenge() {
  const issuedAt = Date.now();
  const glyphs = shuffle([...GLYPH_CATALOG]).slice(0, 6);
  const glyphOrder = shuffle([...glyphs]).slice(0, 4).map((glyph) => glyph.id);
  const phrase = normalizeCaptchaPhrase(
    `${pick(PHRASE_OPENERS)} ${pick(PHRASE_VERBS)} ${pick(PHRASE_OBJECTS)}`
  );

  const challenge: ConfessionalCaptchaChallenge = {
    version: CAPTCHA_VERSION,
    challengeId: randomUUID(),
    issuedAt,
    expiresAt: issuedAt + CAPTCHA_TTL_MS,
    minSolveMs: CAPTCHA_MIN_SOLVE_MS,
    phrase,
    glyphs,
    glyphOrder,
    turtleSteps: [
      "Stroke 1: draw one closed shell loop in the middle.",
      "Stroke 2: add a head on the right side of the shell.",
      "Strokes 3-6: draw four separate legs below the shell.",
      "Stroke 7: finish with a tail on the left.",
    ],
  };

  return {
    token: signChallenge(challenge),
    challenge,
  };
}

export function verifyConfessionalCaptchaSubmission(
  submission: unknown
): CaptchaVerificationResult {
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
    (glyphId, index) => glyphId === challenge.glyphOrder[index]
  );

  if (!glyphOrderMatches) {
    return { ok: false, error: "The glyph order was incorrect." };
  }

  const drawing = evaluateTurtleDrawing(submission.strokes);
  if (!drawing.ok) {
    return {
      ok: false,
      error: drawing.errors[0] ?? "The turtle drawing did not pass inspection.",
    };
  }

  return { ok: true, challenge };
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
      Buffer.from(payload, "base64url").toString("utf8")
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
    candidate.strokes.every(isStroke)
  );
}

function isStroke(value: unknown): value is TurtleStroke {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as Partial<TurtleStroke>).points)
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
