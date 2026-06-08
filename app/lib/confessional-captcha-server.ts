import { createHmac, randomUUID, timingSafeEqual } from "crypto";

import OpenAI from "openai";
import sharp from "sharp";

import {
  CAPTCHA_MIN_SOLVE_MS,
  CAPTCHA_TTL_MS,
  CAPTCHA_VERSION,
  DRAWING_CANVAS_HEIGHT,
  DRAWING_CANVAS_WIDTH,
  GLYPH_DRAWING_MIN_STROKES,
  GLYPH_DRAWING_MIN_TOTAL_LENGTH,
  type ChallengeGlyph,
  type ChallengeKind,
  type ConfessionalCaptchaChallenge,
  type ConfessionalCaptchaSubmission,
  type DrawingStroke,
  evaluateDrawing,
} from "@/app/lib/confessional-captcha";
import { glyphPromptLabel, pickGlyph } from "@/app/lib/confessional-glyphs";
import { createPublicClient } from "@/utils/supabase/server";

// Roughly this share of challenges ask for a pictographic-character inscription
// (Chinese / Japanese / Egyptian) instead of a freeform doodle. The rest stay
// freeform so the gallery keeps its mix of drawings.
const GLYPH_CHALLENGE_RATE = 0.4;

type PromptTier = {
  level: number;
  label: string;
  // Lower bound on the global submission count required to unlock this tier.
  // The hardest tier whose threshold is <= count is chosen.
  minIndex: number;
  prompts: string[];
};

// Five tiers, picked by the running count of accepted drawings (stored in
// turtle_drawings). Tier 1 is gentle, tier 5 is intentionally cruel — things
// that humans can still attempt with a stick figure but that an LLM image
// generator would mangle (specific text, exact counts, recursion, mirrored
// halves, negative space, etc.).
const PROMPT_TIERS: PromptTier[] = [
  {
    level: 1,
    label: "initiation",
    minIndex: 0,
    prompts: [
      "a circle",
      "a triangle",
      "a square",
      "a star",
      "a heart",
      "a smiley face",
      "a sun",
      "a moon",
      "a cloud",
      "a tree",
      "a flower",
      "a leaf",
      "a fish",
      "an arrow",
      "a lightning bolt",
      "a balloon",
      "a key",
      "a banana",
      "a spiral",
      "a diamond",
    ],
  },
  {
    level: 2,
    label: "apprentice",
    minIndex: 5,
    prompts: [
      "a turtle",
      "a cat",
      "a dog",
      "a bird",
      "a butterfly",
      "a snail",
      "a mushroom",
      "a teapot",
      "a mug",
      "an umbrella",
      "a sailboat",
      "an ice cream cone",
      "a slice of pizza",
      "a snowman",
      "a hat",
      "a pair of glasses",
      "a paper airplane",
      "a guitar",
      "a strawberry",
      "an eye",
      "a hand",
      "a hot air balloon",
      "a kite",
    ],
  },
  {
    level: 3,
    label: "acolyte",
    minIndex: 18,
    prompts: [
      "a ball of yarn",
      "a saucer of milk",
      "a fishbone",
      "a scratching post",
      "a cardboard box with a cat inside",
      "a tuna can",
      "a kibble bowl",
      "a fish skeleton",
      "a catnip mouse toy",
      "a tiny throne for a cat",
      "a paw print",
      "a cat tower",
      "a litter box",
      "a fish in a fishbowl",
      "a cat curled up sleeping",
      "a feather on a string",
      "a windowsill with a sunbeam on it",
      "a yarn ball with two knitting needles",
      "a cat-sized crown",
      "a saucer of cream and a fishbone, side by side",
      "a cat silhouette in a doorway",
    ],
  },
  {
    level: 4,
    label: "tribunal",
    minIndex: 50,
    prompts: [
      "a cat napping in a sunbeam on a wooden floor",
      "three kittens stacked on top of each other",
      "a cat reading an open book",
      "a cat wearing a wizard hat",
      "two cats sharing a single ball of yarn",
      "a cat sitting on a laptop keyboard",
      "a cat batting at a fish in a fishbowl",
      "a cat staring out a window at falling rain",
      "a cat about to knock a glass off a table",
      "a cat hiding inside a paper bag with only its tail showing",
      "a cat-shaped loaf of bread on a cutting board",
      "a cat with its tail curled into a question mark",
      "a kitten chasing its own shadow",
      "a cat on a tiny throne holding a scepter",
      "a cat playing chess against a small mouse",
      "a cat halfway out of a portal in the floor",
      "a cat conducting an orchestra of three smaller cats",
      "a cat tea ceremony with two cats and a teapot",
      "a cat dressed as a judge banging a gavel",
    ],
  },
  {
    level: 5,
    label: "the council's whim",
    minIndex: 130,
    prompts: [
      'a cat holding a sign that clearly reads "MEOW"',
      "a clock face showing exactly 4:17, with a cat asleep beneath it",
      "a cat-shaped hole cut into a wooden fence (just the negative space)",
      "exactly seven kittens in a single horizontal row, each a different color",
      "a cat seen from above looking down at a fish seen from below, with a sheet of glass between them",
      "a cat reflected in a mirror, but the reflection is a fish",
      "a cat balancing on its left front paw only, with its tail curled into the letter S",
      "a stack of three cats where the middle cat is upside down",
      'a cat juggling four labeled fish: "salmon", "tuna", "sardine", "koi"',
      "a cat painting a portrait of a cat painting a portrait of a cat",
      "a cat whose four whiskers spell the letters M, E, O, W (one letter per whisker)",
      "a cat split exactly down the middle: left half black with white yarn, right half white with black yarn",
      "two cats playing tug-of-war over a fish, while a third cat hangs upside down from a tree branch holding the same fish by its tail",
      "a fishbowl balanced on a cat's head, with a fish inside wearing a tiny bowler hat",
      'a cat doing a handstand on a teapot, which is itself stacked on three books labeled "ONE", "TWO", "THREE"',
      "a clock face where every numeral 1 through 12 has been replaced by a tiny cat in a different pose",
      "a Möbius strip made of yarn with a single cat walking along its only side",
      "a chessboard's four corner squares, each holding a different cat-king",
      "a cat looking at its own paw prints leading away from itself in a circle",
      "a cat-shaped constellation in the night sky, with the stars connected and labeled",
    ],
  },
];

const DEFAULT_VISION_MODEL = "gpt-4o-mini";

type CaptchaVerificationResult =
  | { ok: true; challenge: ConfessionalCaptchaChallenge; matchReason: string }
  | { ok: false; error: string };

let cachedClient: OpenAI | null = null;

export async function createConfessionalCaptchaChallenge() {
  const issuedAt = Date.now();
  const globalIndex = await getGlobalDrawingIndex();
  const tier = pickTier(globalIndex);

  // Decide between a freeform doodle and a glyph inscription. Glyph challenges
  // are intentionally hard regardless of tier (pickGlyph biases toward the most
  // intricate characters), so they do not use the freeform tier level.
  let kind: ChallengeKind = "freeform";
  let drawingPrompt = pick(tier.prompts);
  let glyph: ChallengeGlyph | undefined;

  if (Math.random() < GLYPH_CHALLENGE_RATE) {
    const entry = pickGlyph();
    if (entry) {
      kind = "glyph";
      // Carry the display + verify-rubric fields into the signed token. The
      // internal difficulty `level` already lives on the challenge itself.
      glyph = {
        glyph: entry.glyph,
        script: entry.script,
        scriptLabel: entry.scriptLabel,
        romanization: entry.romanization,
        meaning: entry.meaning,
        shapeHint: entry.shapeHint,
      };
      drawingPrompt = glyphPromptLabel(entry);
    }
  }

  const challenge: ConfessionalCaptchaChallenge = {
    version: CAPTCHA_VERSION,
    challengeId: randomUUID(),
    issuedAt,
    expiresAt: issuedAt + CAPTCHA_TTL_MS,
    minSolveMs: CAPTCHA_MIN_SOLVE_MS,
    drawingPrompt,
    level: tier.level,
    levelLabel: tier.label,
    globalIndex,
    kind,
    ...(glyph ? { glyph } : {}),
  };

  return {
    token: signChallenge(challenge),
    challenge,
  };
}

function pickTier(globalIndex: number): PromptTier {
  // Walk from the hardest tier down; pick the first whose threshold we've met.
  for (let i = PROMPT_TIERS.length - 1; i >= 0; i -= 1) {
    if (globalIndex >= PROMPT_TIERS[i].minIndex) {
      return PROMPT_TIERS[i];
    }
  }
  return PROMPT_TIERS[0];
}

async function getGlobalDrawingIndex(): Promise<number> {
  try {
    const supabase = createPublicClient();
    const { count, error } = await supabase
      .from("turtle_drawings")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("Drawing count error:", error);
      return 0;
    }

    return typeof count === "number" && count >= 0 ? count : 0;
  } catch (error) {
    console.error("Drawing count error:", error);
    return 0;
  }
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

  const drawing = evaluateDrawing(
    submission.strokes,
    challenge.kind === "glyph"
      ? {
          minStrokes: GLYPH_DRAWING_MIN_STROKES,
          minTotalLength: GLYPH_DRAWING_MIN_TOTAL_LENGTH,
        }
      : undefined,
  );
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
    level: challenge.level,
    kind: challenge.kind,
    glyph: challenge.glyph,
    imageDataUrl,
  });

  if (!verdict.ok) {
    return { ok: false, error: verdict.error };
  }

  if (!verdict.matches) {
    const unconvinced =
      challenge.kind === "glyph" && challenge.glyph
        ? `The council squints. that does not read as ${challenge.glyph.glyph} (${challenge.glyph.meaning}).`
        : `The council is unconvinced. this ${challenge.drawingPrompt} sucks`;
    return { ok: false, error: unconvinced };
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

type ImageDetail = "low" | "high" | "auto";

type Grading = {
  systemPrompt: string;
  targetLine: string;
  imageDetail: ImageDetail;
};

function buildFreeformGrading(prompt: string, level: number): Grading {
  // Higher tiers (multi-element scenes, specific text/counts, recursive
  // composition) deserve credit for capturing the *spirit* — humans cannot
  // realistically nail every constraint with a finger on a phone canvas.
  const grading =
    level >= 4
      ? "This prompt is intentionally elaborate. Accept the drawing if it makes a sincere attempt at the major elements (the subject + at least one or two of the specific qualifiers). Do not require every detail — labels, exact counts, or perfect spatial relationships can be approximated."
      : "Accept any sincere, recognizable attempt at the target subject, even if crude or stylized. Reject only if the canvas is essentially empty or shows an unrelated subject.";

  const systemPrompt =
    "You verify captcha sketches. The user was asked to draw a specific subject and you must decide if the sketch depicts that subject.\n\n" +
    grading +
    "\n\nReject (matches: false) when ANY of these apply:\n" +
    "- The drawing is blank or near-blank (a single dot, a tiny mark, almost nothing on the canvas).\n" +
    "- The drawing is just random scribbles, lines, or noise with no recognizable subject.\n" +
    "- The drawing depicts an entirely different subject than the target.\n\n" +
    "Be generous about artistic skill — these are rough finger sketches — but strict about whether the right *kind* of thing was attempted. " +
    'Reply with strict JSON: {"matches": boolean, "reason": "<one short sentence explaining your decision>"}.';

  const targetLine =
    level >= 4
      ? `Target prompt (level ${level}): ${prompt}. Did the human capture the spirit of this prompt — the subject and at least one specific qualifier?`
      : `Target subject (level ${level}): ${prompt}. Does this sketch reasonably depict that subject?`;

  return { systemPrompt, targetLine, imageDetail: "low" };
}

function buildGlyphGrading(glyph: ChallengeGlyph): Grading {
  // The user was shown the reference glyph and asked to reproduce/trace it. We
  // hand the model the character, its meaning, and an explicit shape rubric so
  // it can grade the form even when it cannot read an exotic script (e.g. a
  // hieroglyph). Strict about which character was drawn, lenient about skill.
  const systemPrompt =
    "You verify a captcha where the user was shown a single writing-system character (a Chinese hanzi, a Japanese kana/kanji, or an Egyptian hieroglyph) and asked to reproduce it by hand on a canvas. Decide whether the drawing recognizably reproduces THAT specific character.\n\n" +
    "Be generous about penmanship — these are rough finger drawings, so wobbly strokes, uneven proportions, and shaky lines are fine. Judge the overall structure and the major strokes/parts against the expected form, not the neatness.\n\n" +
    "Reject (matches: false) when ANY of these apply:\n" +
    "- The canvas is blank or near-blank (a single dot, a tiny mark, almost nothing).\n" +
    "- The marks are random scribbles or noise with no resemblance to the character.\n" +
    "- The drawing is clearly a different character, a Latin letter/word, or an unrelated picture.\n" +
    "- The overall structure is plainly wrong (e.g. the wrong number of major strokes/components, or the wrong arrangement).\n\n" +
    'Reply with strict JSON: {"matches": boolean, "reason": "<one short sentence explaining your decision>"}.';

  const romanization = glyph.romanization ? ` (${glyph.romanization})` : "";
  const targetLine =
    `Target character: ${glyph.glyph}${romanization} — ${glyph.scriptLabel}, meaning "${glyph.meaning}".\n` +
    `Expected form: ${glyph.shapeHint}\n` +
    `Does this drawing recognizably reproduce that character's shape?`;

  // Character matching benefits from finer stroke detail than a freeform blob.
  return { systemPrompt, targetLine, imageDetail: "auto" };
}

async function classifyDrawing({
  prompt,
  level,
  kind,
  glyph,
  imageDataUrl,
}: {
  prompt: string;
  level: number;
  kind: ChallengeKind;
  glyph?: ChallengeGlyph;
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

  const { systemPrompt, targetLine, imageDetail } =
    kind === "glyph" && glyph
      ? buildGlyphGrading(glyph)
      : buildFreeformGrading(prompt, level);

  try {
    const response = await client.chat.completions.create(
      {
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: targetLine,
              },
              {
                type: "image_url",
                image_url: { url: imageDataUrl, detail: imageDetail },
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

  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
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
