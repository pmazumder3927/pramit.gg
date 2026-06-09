// ============================================================================
// banner-art-director.ts — the "night curator" for the nightly doodle collage.
// ----------------------------------------------------------------------------
// IMPORTANT ARCHITECTURE NOTE (2026-06): the image model NEVER redraws the
// doodles. It paints ONLY a warm paper-and-wash GROUND; the real contributor
// strokes are stamped on top, pixel-for-pixel, by homepage-banner.ts. That
// guarantees every drawing keeps its exact lines, colour and quirks (no
// normalising, no dropping). So everything below authors the night's GROUND —
// its medium, palette, atmosphere and mood — and explicitly forbids the model
// from drawing any subject.
//
// gpt-image-2 exposes no seed/temperature, so all night-to-night variety is
// authored here in text (plus the softened reference layout). The pipeline:
//
//   analyzeNight(sketches)  ->  read deterministic signals from the doodles
//   pickLens(analysis,...)  ->  lock a curated MEDIUM x ATMOSPHERE x MOOD cell
//                               (seeded, signal-biased, anti-repeat on 3 nights)
//   directNight(...)        ->  optional LLM curator writes the night's specific
//                               wash-ground prose WITHIN the locked lens
//   renderDeterministicProse-> graceful on-brand fallback if the LLM is off
//
// Taste is hand-locked in the enums below; the LLM may only describe how
// tonight's GROUND is washed within a lens it cannot change.
// ============================================================================

import type OpenAI from "openai";

import type { SketchRecord } from "@/app/lib/homepage-banner";

// --- 1. CURATED, TASTE-LOCKED GROUND-MEDIUM DECK ---------------------------
// Each medium is a hand-made / analog WASH GROUND (paper + wash character +
// palette) — never an instruction to render subjects. Palettes span a wide but
// cohesive, muted, paper-friendly gamut so colour genuinely varies night to
// night while staying in the site's warm, intimate world.

export type Family =
  | "ink"
  | "paint"
  | "print"
  | "cameraless"
  | "drawing"
  | "mixed";

export type Medium = {
  id: string;
  family: Family;
  surface: string; // describes the GROUND wash, never any subject
  palette: string;
  logic: string; // how the wash behaves
  warm?: boolean;
  affinities?: string[];
};

export const MEDIA: Medium[] = [
  {
    id: "sumi-e",
    family: "ink",
    warm: true,
    surface:
      "a sheet of warm bone-white paper washed with sumi ink — translucent grey pools with soft feathered backruns and dry-brush edges, and vast intentional emptiness",
    palette:
      "warm sumi greys on bone paper, near-monochrome, with at most a single restrained breath of muted vermilion; no other hue",
    logic:
      "a few decisive translucent washes and breathing negative space; the wash pools and dries, it never depicts anything",
    affinities: ["abstract-field", "horizon", "single-scene"],
  },
  {
    id: "ink-watercolor",
    family: "ink",
    warm: true,
    surface:
      "loose ink-and-watercolour washes on cream paper — translucent fields pooling and bleeding into one another, granulation settling in the low areas, soft tide-lines where washes meet",
    palette:
      "soft umber and slate-blue washes over cream, lit by pale amber, with one bruise of dusty plum settling in the shadows",
    logic:
      "overlapping transparent washes that soften and bleed where they meet",
    affinities: ["single-scene", "horizon", "abstract-field"],
  },
  {
    id: "risograph",
    family: "print",
    warm: true,
    surface:
      "a two-colour risograph ground — soft overlapping flats of two inks with a third muddied tone where they overlap, gentle ink mis-registration, the matte tooth of newsprint",
    palette:
      "exactly two inks: burnt-orange and a dusty grape-purple, overprinting to a bruised brown; unprinted warm paper as the third value",
    logic:
      "two soft overlapping flat-ink fields; edges glow where the layers slip out of register",
    affinities: ["tessellation", "cut-paper", "constellation"],
  },
  {
    id: "gouache",
    family: "paint",
    warm: true,
    surface:
      "matte gouache washes on toned paper — soft chalky fields of flat hand-mixed colour meeting and abutting, a velvet finish, faint brush ridges, no gloss",
    palette:
      "terracotta, dusty sage green, dusty plum, warm ivory and slate; flat, hand-mixed and unblended",
    logic: "soft flat opaque fields that meet and abut, no rendering, no gloss",
    affinities: ["cut-paper", "single-scene", "tessellation"],
  },
  {
    id: "charcoal",
    family: "drawing",
    warm: true,
    surface:
      "a kraft-toned ground rubbed with vine-charcoal dust — soft smudged tonal clouds, eraser-lifted light, fingerprint softness, velvety darks low in the page",
    palette:
      "graphite blacks and warm greys on kraft, near-monochrome, the only warmth a smoldering ember-orange low in the values",
    logic: "soft tonal masses smudged and lifted, light surfacing from the grey",
    affinities: ["single-scene", "horizon", "abstract-field"],
  },
  {
    id: "woodblock",
    family: "print",
    warm: true,
    surface:
      "a mokuhanga woodblock ground — soft registered flats of flat colour with woodgrain printed through and gentle baren mottling",
    palette:
      "persimmon orange, faded wisteria-purple, a quiet indigo ground and aged-paper cream; flat, soft-edged fields",
    logic: "a few soft registered flats; the grain and mottling carry the texture",
    affinities: ["horizon", "single-scene", "tessellation"],
  },
  {
    id: "cyanotype",
    family: "cameraless",
    warm: false,
    surface:
      "a cyanotype ground — an uneven Prussian-blue wash with fibrous cold-press grain and faint chemical tide-lines at the edges",
    palette:
      "Prussian-blue field, paper-white reserves, one hand-bled wash of muted aubergine and a single ember of rust at the edge",
    logic: "one uneven blue exposure, lighter where the chemistry was thin",
    affinities: ["abstract-field", "constellation", "horizon"],
  },
  {
    id: "cut-paper",
    family: "mixed",
    warm: true,
    surface:
      "a torn-and-layered paper ground — soft fields of matte stock with deckled tears and faint drop-shadows from lifted edges",
    palette:
      "sun-faded papers: pumpkin, dusty lavender, oatmeal, soft moss and one slate; flat, with paper-fibre edges",
    logic: "a few flat matte fields overlapping and tucking behind one another",
    affinities: ["cut-paper", "tessellation", "single-scene"],
  },
  {
    id: "silverpoint",
    family: "drawing",
    warm: false,
    surface:
      "a blush-warmed prepared ground, near-monochrome — the faintest tarnished silver-grey half-tones drifting across the page, jeweller's restraint",
    palette:
      "tarnished silver-grey on a blush-warmed ground, near-monochrome, with the faintest breath of lilac in the half-tones and one coin-sized note of ochre",
    logic: "barely-there tonal drift; everything is suggestion, nothing is loud",
    affinities: ["constellation", "single-scene", "abstract-field"],
  },
  {
    id: "linocut",
    family: "print",
    warm: true,
    surface:
      "a warm chalk-white printed ground with one or two soft carved-colour flats and visible ink texture, no gradients",
    palette:
      "oxblood-red and a muted olive over warm chalk-white; graphic and flat",
    logic: "one or two soft flat fields and the carver's ink texture; no fine detail",
    affinities: ["horizon", "tessellation", "cut-paper"],
  },
];

// --- 2. ATMOSPHERES — how the GROUND wash is organised + density gate -------
export type Density = "sparse" | "balanced" | "teeming";
export type Composition = {
  id: string;
  armature: string; // organises the GROUND wash only
  forDensity: Density[];
};

export const COMPOSITIONS: Composition[] = [
  {
    id: "constellation",
    armature:
      "an open, quiet field — washes kept light and drifting toward the edges, generous dark/empty breathing space, a few faint scattered tonal flecks like distant stars",
    forDensity: ["sparse", "teeming"],
  },
  {
    id: "single-scene",
    armature:
      "one soft binding atmosphere with a faint low horizon-wash and a single gentle source of light, everything held in one quiet air",
    forDensity: ["sparse", "balanced"],
  },
  {
    id: "abstract-field",
    armature:
      "an all-over non-representational wash field — rhythm, texture and value spread across the whole surface with no single focal point, closer to music than illustration",
    forDensity: ["balanced", "teeming"],
  },
  {
    id: "tessellation",
    armature:
      "an all-over gently repeating wash rhythm, like a faded printed endpaper or textile, even across the page",
    forDensity: ["balanced", "teeming"],
  },
  {
    id: "horizon",
    armature:
      "a low horizon-wash with most of the page given to a soft graded sky above and a settled ground below",
    forDensity: ["sparse", "balanced"],
  },
  {
    id: "cut-paper",
    armature:
      "a few shallow layered fields of flat colour overlapping in a stage-like space, figure-ground reading playfully",
    forDensity: ["sparse", "balanced", "teeming"],
  },
];

export const MOODS = [
  "hushed and nocturnal, the quiet after midnight",
  "warm and nostalgic, like a sun-faded photograph",
  "playful and a little absurd, a daydream caught mid-thought (but never twee or children's-book)",
  "melancholy and tender, the ache of a fond memory",
  "still and meditative, holding its breath",
  "wistful and slightly surreal, a half-remembered dream",
] as const;

// --- 3. FIXED ON-BRAND CLAUSES (taste floor) -------------------------------
// The single most important rule: the model paints ONLY the ground. The real
// doodles are stamped on afterward, so the model must not draw them.
export const GROUND_RULE =
  "Paint ONLY this paper-and-wash GROUND. The faint grey shapes in the reference mark where small hand-drawn ink doodles will be stamped on later — do NOT draw, ink, outline, fill, trace or illustrate them, and invent no subjects, figures, animals, objects or scenery of your own. Treat each faint shape only as a soft reserved opening to leave gently clear so a drawing can nestle there. Output paper and wash only — no line art whatsoever.";

export const CRAFT_TAIL =
  "Restraint above all: hand-made, intimate, a little melancholy and a little playful, on warm paper, with generous breathing negative space. Let the palette belong to the chosen medium and shift from night to night — but keep every colour muted and hand-mixed, cohesive with a warm, paper-toned world, never saturated digital colour. The site's burnt-orange and dusty-purple are a home base the palette can echo or quietly drift from, not a fixed rule. Real ink/watercolour behaviour — feathered edges, gentle pooling and backruns — never a flat digital gradient or a soft photographic blur. No digital-illustration gloss, no painted photoreal scenery, no text or signatures.";

export const KITSCH = [
  "neon",
  "cyberpunk",
  "fantasy",
  "epic",
  "hyperreal",
  "8k",
  "trending",
  "rainbow",
  "kawaii",
  "magical",
  "lens flare",
  "vibrant",
  "masterpiece",
  "ultra-detailed",
  "highly detailed",
];

// --- 4. SIGNAL READER (deterministic) --------------------------------------
// Still useful: the doodles' colour temperature and theme quietly flavour the
// GROUND wash so it feels of-a-piece with what was drawn.
export type Category =
  | "creature"
  | "celestial"
  | "domestic"
  | "weather"
  | "food"
  | "vessel"
  | "geometry";

export type NightAnalysis = {
  subjects: string[];
  count: number;
  density: Density;
  catRatio: number;
  centerOfGravity: Category | null;
  inkBias: "warm" | "cool" | null;
};

// Theme defaults are NOT intent — ignore them so the ink signal only fires when
// a contributor deliberately reached for a colour swatch.
const DEFAULT_INKS = new Set(["#2a2018", "#f5f5f5"]);
const WARM_SWATCHES = new Set(["#ff8f6b", "#e0922f", "#d56a98"]);
const COOL_SWATCHES = new Set(["#5e86b8", "#8b6fc4", "#3fa7a3", "#a87bf2", "#7aa86a"]);

const CATEGORY_RULES: Array<[Category, RegExp]> = [
  ["creature", /cat|kitten|feline|mouse|bird|fish(?!bowl)|moth|paw|whisker/i],
  ["celestial", /star|moon|sun|planet|comet|constellation|eye/i],
  ["weather", /cloud|rain|umbrella|balloon|kite|wind|snow/i],
  ["domestic", /window|sill|lamp|chair|teapot|cup|book|key|sunbeam|mug/i],
  ["food", /pizza|cake|mushroom|fruit|slice|kibble|cream/i],
  ["vessel", /boat|fishbowl|jar|bottle|teapot|bowl/i],
  ["geometry", /möbius|mobius|spiral|strip|yarn|paper airplane|origami|knot|triangle|circle/i],
];

export function analyzeNight(sketches: SketchRecord[]): NightAnalysis {
  const subjects = Array.from(
    new Set(
      sketches
        .map((s) => s.prompt?.trim())
        .filter((p): p is string => !!p && p.length > 0),
    ),
  ).slice(0, 16);
  const count = subjects.length;
  const density: Density = count < 5 ? "sparse" : count <= 10 ? "balanced" : "teeming";
  const catHits = subjects.filter((s) => /cat|kitten|feline/i.test(s)).length;
  const catRatio = count ? catHits / count : 0;

  const tally = new Map<Category, number>();
  for (const s of subjects)
    for (const [cat, re] of CATEGORY_RULES)
      if (re.test(s)) tally.set(cat, (tally.get(cat) ?? 0) + 1);
  const centerOfGravity =
    Array.from(tally.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  let warm = 0;
  let cool = 0;
  for (const sk of sketches)
    for (const st of sk.strokes ?? []) {
      const c = st.color?.toLowerCase();
      if (!c || DEFAULT_INKS.has(c)) continue;
      if (WARM_SWATCHES.has(c)) warm++;
      else if (COOL_SWATCHES.has(c)) cool++;
    }
  const inkBias: NightAnalysis["inkBias"] =
    warm + cool === 0
      ? null
      : warm > cool * 1.3
        ? "warm"
        : cool > warm * 1.3
          ? "cool"
          : null;

  return { subjects, count, density, catRatio, centerOfGravity, inkBias };
}

// --- 5. SEED + RNG ---------------------------------------------------------
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function weightedPick<T>(
  items: T[],
  weightOf: (i: T) => number,
  rand: () => number,
): T {
  const w = items.map((i) => Math.max(1e-4, weightOf(i)));
  let r = rand() * w.reduce((x, y) => x + y, 0);
  for (let i = 0; i < items.length; i++) {
    r -= w[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// --- 6. LENS SELECTION (locked aesthetic, signal-biased, anti-repeat) ------
export type Lens = {
  medium: Medium;
  composition: Composition;
  mood: string;
  seedKey: string;
};

export function pickLens(
  a: NightAnalysis,
  date: Date,
  reRollSalt: number,
  recentFamilies: Family[],
): Lens {
  const seedKey =
    isoDate(date) +
    "|" +
    [...a.subjects].sort().join("·") +
    "|" +
    a.density +
    (reRollSalt ? "|r" + reRollSalt : "");
  const sub = (salt: number) => mulberry32(fnv1a(seedKey + "#" + salt));

  // Atmosphere: density gates eligibility; signals are gentle multipliers.
  const compPool = COMPOSITIONS.filter((c) => c.forDensity.includes(a.density));
  const composition = weightedPick(
    compPool.length ? compPool : COMPOSITIONS,
    (c) => {
      let w = 1;
      if (a.catRatio >= 0.35 && (c.id === "abstract-field" || c.id === "tessellation")) w *= 2.5;
      if (a.count <= 4 && (c.id === "single-scene" || c.id === "horizon")) w *= 2.5;
      if (a.count >= 11 && (c.id === "constellation" || c.id === "tessellation")) w *= 2.5;
      return w;
    },
    sub(1),
  );

  // Medium: forbid the last 3 nights' families outright, then bias by affinity
  // to the chosen atmosphere and by the ink-temperature signal.
  const eligible = MEDIA.filter((m) => !recentFamilies.includes(m.family));
  const mediumPool = eligible.length >= 3 ? eligible : MEDIA;
  const medium = weightedPick(
    mediumPool,
    (m) => {
      let w = 1;
      if ((m.affinities ?? []).includes(composition.id)) w *= 2;
      if (a.inkBias === "warm" && m.warm) w *= 1.8;
      if (a.inkBias === "cool" && !m.warm) w *= 1.8;
      return w;
    },
    sub(2),
  );

  const mood = MOODS[Math.floor(sub(3)() * MOODS.length)];

  return { medium, composition, mood, seedKey };
}

// --- 7. DETERMINISTIC FALLBACK PROSE (never throws; on-brand voice) --------
export type DirectorOut = { fusionConcept: string; prose: string };

export function renderDeterministicProse(
  a: NightAnalysis,
  lens: Lens,
): DirectorOut {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const tempLine =
    a.inkBias === "warm"
      ? " Let the warmth of the contributors' own inks whisper through the wash."
      : a.inkBias === "cool"
        ? " Let a cool quiet drawn from the contributors' inks settle through the wash."
        : "";
  return {
    fusionConcept:
      "A quiet washed world that holds the night's drawings without ever drawing them.",
    prose:
      `${cap(lens.medium.surface)}, ${lens.mood}. ` +
      `Palette: ${lens.medium.palette}.${tempLine}`,
  };
}

// --- 8. ANTI-REPEAT TAG round-trip (no schema change) ----------------------
// The chosen medium family is stored as a hidden tag inside homepage_banners.
// prompt; tomorrow's run parses it back out to forbid repeats. Stripped before
// the image model ever sees it.
export function lensTag(family: Family): string {
  return `[lens:${family}]`;
}

export function parseRecentFamilies(pastPrompts: (string | null)[]): Family[] {
  return pastPrompts
    .map((p) => p?.match(/\[lens:([a-z]+)\]/)?.[1])
    .filter((f): f is Family => !!f)
    .slice(0, 3);
}

export function stripLensTag(prompt: string): string {
  return prompt.replace(/\s*\[lens:[a-z]+\]\s*$/i, "").trim();
}

// --- 9. THE CONSTRAINED DIRECTOR -------------------------------------------
// One orchestrator call (default gpt-5.5; override with OPENAI_DIRECTOR_MODEL).
// The lens is ALREADY LOCKED; the model may ONLY describe how tonight's GROUND
// is washed within it — never any subject. Validated + KITSCH-blocked. On any
// failure returns null and the caller falls back to deterministic prose.

const SYSTEM_RUBRIC = [
  "You are the night curator for an intimate, hand-made personal website. Once a night, a batch of finger-drawn doodles is collaged onto a hand-washed paper background; you write the art-direction prose for the BACKGROUND only.",
  "CRUCIAL: the doodles themselves are stamped on later, pixel-for-pixel — you are NOT describing or placing them. You describe ONLY the paper-and-wash ground they will rest on. Never name, draw, or arrange any subject, figure, animal, object or scene.",
  "Voice: a discerning, restrained gallery curator — lowercase-leaning, unfussy, NOT a hype machine, NOT an AI-art prompt generator. The owner hates generic AI aesthetics, clutter, and kitsch.",
  "A curated LENS is ALREADY CHOSEN and LOCKED. You MAY NOT change the medium, palette, atmosphere, or mood — only describe, vividly and specifically, how tonight's wash settles on the paper within them (pooling, backruns, granulation, mis-registration, tide-lines, where it breathes empty, where it gathers).",
  "The palette is already chosen and varies by medium; keep to it faithfully and add no loud, saturated colour. Real ink/watercolour behaviour, never a flat digital gradient.",
  "Forbidden words anywhere in your output: " + KITSCH.join(", ") + ".",
  'Reply with STRICT JSON only: {"fusionConcept":"<one short sentence on the ground\'s feeling>","prose":"<a 70-110 word painterly paragraph that names the locked medium, palette, atmosphere and mood and describes ONLY how the wash ground settles — no subjects, no line art>"}.',
].join("\n");

function validProse(p: unknown): p is DirectorOut {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  if (typeof o.prose !== "string" || o.prose.trim().length < 50) return false;
  const low = (o.prose as string).toLowerCase();
  if (
    KITSCH.some((k) =>
      new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(low),
    )
  )
    return false;
  return true;
}

const DEFAULT_DIRECTOR_MODEL = "gpt-5.5";

export async function directNight(
  a: NightAnalysis,
  lens: Lens,
  client: OpenAI,
  recentFamilies: string[],
): Promise<DirectorOut | null> {
  const model = process.env.OPENAI_DIRECTOR_MODEL?.trim() || DEFAULT_DIRECTOR_MODEL;
  const inkLine = a.inkBias
    ? `The contributors leaned ${a.inkBias} in their own inks — let that temperature quietly tint the wash.`
    : "";
  const themeLine = a.centerOfGravity
    ? `Tonight's drawings lean ${a.centerOfGravity} — let that gently flavour the ground's feeling, without depicting anything.`
    : "";
  const avoidLine = recentFamilies.length
    ? `Recent nights already used these medium families: ${recentFamilies.join(", ")}. This lens deliberately differs — lean into how different it feels.`
    : "";
  const userMsg = [
    "LOCKED LENS (do not change):",
    `Ground medium: ${lens.medium.surface}`,
    `Wash behaviour: ${lens.medium.logic}`,
    `Palette: ${lens.medium.palette}`,
    `Mood: ${lens.mood}`,
    "",
    "The scene's spatial structure (horizon, sky, ground, water, weather) is decided separately and appended after your text — so describe ONLY the wash's texture, colour and feeling within this medium and mood, never any layout, composition, or subject.",
    themeLine,
    inkLine,
    avoidLine,
    "Write the fusionConcept and the final prose for the WASH itself — no subjects, no layout.",
  ]
    .filter(Boolean)
    .join("\n");

  // GPT-5 / o-series are reasoning models: they reject a custom temperature and
  // take a reasoning_effort knob instead. gpt-4o / gpt-4.1 are the reverse.
  const isReasoning = /^(gpt-5|o\d)/.test(model);
  const tuning: Record<string, unknown> = isReasoning
    ? { reasoning_effort: process.env.OPENAI_DIRECTOR_EFFORT?.trim() || "low" }
    : { temperature: 0.7 };

  try {
    const res = await client.chat.completions.create(
      {
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_RUBRIC },
          { role: "user", content: userMsg },
        ],
        ...tuning,
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
      { timeout: 60_000 },
    );
    const raw = res.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DirectorOut>;
    if (!validProse(parsed)) return null;
    return {
      fusionConcept:
        typeof parsed.fusionConcept === "string" ? parsed.fusionConcept : "",
      prose: parsed.prose!.trim(),
    };
  } catch (e) {
    console.error("Banner art-director failed; using deterministic prose:", e);
    return null;
  }
}

// --- 10. ASSEMBLY ----------------------------------------------------------
// Build the full tagged GROUND prompt for a locked lens + director output +
// the scene's spatial structure (sentences from composeScene). The caller
// strips the [lens:*] tag with stripLensTag before sending to the image model,
// and stores the tagged string so tomorrow's anti-repeat can read it.
export function assemblePrompt(
  out: DirectorOut,
  lens: Lens,
  sceneBits: string[] = [],
): string {
  return [
    out.prose.trim(),
    ...sceneBits,
    GROUND_RULE,
    CRAFT_TAIL,
    lensTag(lens.medium.family),
  ]
    .filter(Boolean)
    .join(" ");
}
