// ============================================================================
// banner-art-director.ts — the "night curator" for the nightly doodle collage.
// ----------------------------------------------------------------------------
// gpt-image-2 exposes no seed/temperature, so ALL night-to-night variety is
// authored here in text (plus the softened reference layout). The pipeline:
//
//   analyzeNight(sketches)  ->  read deterministic signals from the doodles
//   pickLens(analysis,...)  ->  lock a curated MEDIUM x COMPOSITION x MOOD x
//                               ABSTRACTION cell (seeded, signal-biased,
//                               with a hard anti-repeat on the last 3 nights)
//   directNight(...)        ->  optional gpt-4o-mini curator writes the night's
//                               specific fusion prose WITHIN the locked lens
//   renderDeterministicProse-> graceful, on-brand fallback if the LLM is off
//                               or fails
//
// Taste is hand-locked in the enums below; the LLM may only describe how
// tonight's subjects fuse within a lens it cannot change.
// ============================================================================

import type OpenAI from "openai";

import type { SketchRecord } from "@/app/lib/homepage-banner";

// --- 1. CURATED, TASTE-LOCKED MEDIA DECK -----------------------------------
// Every medium is hand-made / analog (no digital escape hatch). Palettes span a
// wide but cohesive, muted, paper-friendly gamut — some near-monochrome, some
// earthy, some two-colour, some cool-field — so colour genuinely varies night
// to night while still blending into the site's warm, intimate world.

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
  surface: string;
  palette: string;
  logic: string;
  warm?: boolean;
  affinities?: string[];
};

export const MEDIA: Medium[] = [
  {
    id: "sumi-e",
    family: "ink",
    warm: true,
    surface:
      "sumi-e ink on warm bone-white paper — confident wet brush, dry-brush flicker at the stroke ends, vast intentional emptiness, a few decisive marks carrying the whole image",
    palette:
      "warm sumi black on bone paper, near-monochrome, with a single restrained seal of muted vermilion; no other hue",
    logic:
      "everything reduces to gesture — a handful of brushstrokes and breathing negative space",
    affinities: ["abstract-field", "horizon", "single-scene"],
  },
  {
    id: "ink-watercolor",
    family: "ink",
    warm: true,
    surface:
      "loose ink-and-watercolor — translucent washes pooling into one another, ink lines drifting and bleeding at wet edges, granulation in the settled pigment",
    palette:
      "soft umber and slate-blue washes over cream, lit by pale amber, with one bruise of dusty plum settling in the shadows",
    logic:
      "forms emerge and dissolve in overlapping washes, edges softening where colors meet",
    affinities: ["single-scene", "horizon", "abstract-field"],
  },
  {
    id: "risograph",
    family: "print",
    warm: true,
    surface:
      "a two-color risograph print — visible halftone dots, gentle ink misregistration, the matte tooth of newsprint, a third muddied tone where the inks overlap",
    palette:
      "exactly two inks: burnt-orange and a dusty grape-purple, overprinting to a bruised brown; unprinted warm paper as the third value",
    logic:
      "everything flattens to two overlapping flat-ink layers; edges glow where layers slip out of register",
    affinities: ["tessellation", "cut-paper", "constellation"],
  },
  {
    id: "gouache",
    family: "paint",
    warm: true,
    surface:
      "matte gouache on toned paper — flat opaque shapes, chalky velvet finish, visible brush ridges where strokes overlap, no gloss",
    palette:
      "terracotta, dusty sage green, dusty plum, warm ivory and slate; flat, hand-mixed and unblended",
    logic:
      "confident flat opaque shapes that overlap and abut, no rendering, no gloss",
    affinities: ["cut-paper", "single-scene", "tessellation"],
  },
  {
    id: "charcoal",
    family: "drawing",
    warm: true,
    surface:
      "vine and compressed charcoal on a kraft-toned ground — smudged passages, eraser-lifted highlights, fingerprint softness, velvety darks",
    palette:
      "graphite blacks and warm greys on kraft, near-monochrome, the only warmth a smoldering ember-orange low in the values",
    logic:
      "soft tonal masses smudged and lifted, forms surfacing from and sinking into the grey",
    affinities: ["single-scene", "horizon", "abstract-field"],
  },
  {
    id: "woodblock",
    family: "print",
    warm: true,
    surface:
      "a mokuhanga woodblock print — wood grain printed through the flats, a hand-carved key-line, slight baren mottling, registered flat color fields",
    palette:
      "persimmon orange, faded wisteria-purple, a quiet indigo ground and aged-paper cream; flat with carved white key-lines",
    logic: "bold carved flats and a single key-line; no fine detail survives the knife",
    affinities: ["horizon", "single-scene", "tessellation"],
  },
  {
    id: "cyanotype",
    family: "cameraless",
    warm: false,
    surface:
      "a cyanotype photogram — forms registered as soft white ghosts where they blocked the light, fibrous cold-press grain, faint chemical tide-lines at the edges",
    palette:
      "Prussian-blue field, paper-white negatives, one hand-bled wash of muted aubergine and a single ember of rust at the edge",
    logic: "every form becomes a luminous white silhouette in one uneven blue exposure",
    affinities: ["abstract-field", "constellation", "horizon"],
  },
  {
    id: "cut-paper",
    family: "mixed",
    warm: true,
    surface:
      "torn and cut paper collage — layered matte stock with visible deckled tears, faint drop-shadows from lifted edges, the honesty of scissors and glue",
    palette:
      "sun-faded papers: pumpkin, dusty lavender, oatmeal, soft moss and one slate; flat, with paper-fiber edges",
    logic:
      "each form is a single bold flat shape; shapes overlap, tuck behind, and share edges",
    affinities: ["cut-paper", "tessellation", "single-scene"],
  },
  {
    id: "silverpoint",
    family: "drawing",
    warm: false,
    surface:
      "silverpoint on a warm prepared ground — impossibly fine metal-stylus hatching tarnished to grey-brown, no erasing, jeweller's patience",
    palette:
      "tarnished silver-grey line on a blush-warmed ground, near-monochrome, with the faintest breath of lilac in the half-tones and one coin-sized note of ochre",
    logic:
      "delicate, barely-there hatching; everything is suggestion, nothing is loud",
    affinities: ["constellation", "single-scene", "abstract-field"],
  },
  {
    id: "linocut",
    family: "print",
    warm: true,
    surface:
      "a linocut block print — bold carved shapes and gouged negative space, visible ink texture and the carver's marks, no gradients",
    palette:
      "oxblood-red and ink-black on warm chalk-white, with one muted olive over-block; graphic and flat",
    logic:
      "everything becomes carved positive/negative shape; detail is sacrificed for unity",
    affinities: ["horizon", "tessellation", "cut-paper"],
  },
];

// --- 2. COMPOSITIONS — each carries its own dissolve clause + density gate ---
export type Density = "sparse" | "balanced" | "teeming";
export type Composition = {
  id: string;
  armature: string;
  incorporation: string;
  forDensity: Density[];
};

export const COMPOSITIONS: Composition[] = [
  {
    id: "constellation",
    armature:
      "an all-over star-chart: a quiet field threaded with the faintest hairline connections, forms reading as constellations rather than objects",
    incorporation:
      "let each doodle collapse into a cluster of points and a few connecting lines — half-remembered as a shape in the stars, never outlined as itself",
    forDensity: ["sparse", "teeming"],
  },
  {
    id: "single-scene",
    armature:
      "one cohesive scene with a clear horizon and a single source of light, one atmosphere binding everything",
    incorporation:
      "dissolve the doodles INTO the scene as native elements — a sketched umbrella becomes a real silhouette catching the light, a teapot becomes a roofline; they belong to the world, not pasted onto it",
    forDensity: ["sparse", "balanced"],
  },
  {
    id: "abstract-field",
    armature:
      "a non-representational all-over field — rhythm, texture and value across the whole surface with no single focal point, closer to music than illustration",
    incorporation:
      "abstract every doodle down to GESTURE and RHYTHM only — a cat's tail becomes a recurring curved cadence, a star a burst of radiating marks; the subjects survive as movement, not as pictures",
    forDensity: ["balanced", "teeming"],
  },
  {
    id: "tessellation",
    armature:
      "a repeating pattern / loose tessellation, an all-over decorative field like a printed endpaper or textile",
    incorporation:
      "treat the doodles as a motif alphabet — repeat, rotate and interlock simplified versions into a rhythmic pattern so no single one dominates; wallpaper, not portrait",
    forDensity: ["balanced", "teeming"],
  },
  {
    id: "horizon",
    armature:
      "a low horizon with most of the frame given to sky, forms reading as a silhouetted skyline against a graded ground",
    incorporation:
      "flatten the doodles into a single connected silhouette along the horizon — shoulder to shoulder into one continuous profile, a skyline you read left to right",
    forDensity: ["sparse", "balanced"],
  },
  {
    id: "cut-paper",
    armature:
      "flat layered shapes overlapping in a shallow stage-like space, figure and ground swapping playfully",
    incorporation:
      "reduce each doodle to its single boldest flat silhouette and let the shapes overlap, tuck behind and share edges — a child's-scissors essence, never detailed",
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

// Abstraction rungs — NONE drop a doodle; they only set legible vs. dissolved.
export type Rung = "motival" | "semi" | "rhythmic" | "dissolved";
export const RUNGS: Rung[] = ["motival", "semi", "rhythmic", "dissolved"];
export const RUNG_DIRECTIVE: Record<Rung, string> = {
  motival:
    "Subjects stay recognizable but stylized, woven into one field as repeating motifs",
  semi: "Subjects are simplified to essential shapes — some legible, some merely suggested, but all present",
  rhythmic:
    "Subjects survive mostly as repeated rhythm, contour and color; legibility is secondary to unity, yet every mark is felt",
  dissolved:
    "Subjects survive as silhouette, overlap and gesture, fully absorbed into the medium's logic — present even when not spelled out",
};

// --- 3. FIXED ON-BRAND CLAUSES (taste floor) -------------------------------
export const STANDING_RULE =
  "These sketches are raw material, not a checklist. Weave every contributor's mark into ONE coherent composition — no doodle is traced verbatim and none is a pasted cut-out; every mark must survive somewhere in the image, even if only as gesture, contour or rhythm. They should feel discovered within the picture, not arranged on top of it. Honor the spirit and quirk of the drawings — a lopsided cat stays charmingly lopsided — while letting the chosen medium fully transform them.";

export const CRAFT_TAIL =
  "Restraint above all: hand-made, intimate, a little melancholy and a little playful, on warm paper, with generous negative space. Let the palette belong to the chosen medium and shift from night to night — but keep every colour muted and hand-mixed, cohesive with a warm, paper-toned world, never saturated digital colour. The site's burnt-orange and dusty-purple are a home base the palette can echo or quietly drift from, not a fixed rule. No generic digital-illustration gloss, no cluttered maximalism, no fantasy cliché, not cute, not children's-book, no text or signatures. Apple-restrained craft — the work of one careful hand in one sitting.";

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
  rung: Rung;
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

  // Composition: density gates eligibility; signals are strong multipliers.
  const compPool = COMPOSITIONS.filter((c) => c.forDensity.includes(a.density));
  const composition = weightedPick(
    compPool.length ? compPool : COMPOSITIONS,
    (c) => {
      let w = 1;
      if (a.catRatio >= 0.35 && (c.id === "abstract-field" || c.id === "tessellation")) w *= 3;
      if (a.count <= 4 && (c.id === "single-scene" || c.id === "horizon")) w *= 2.5;
      if (a.count >= 11 && (c.id === "constellation" || c.id === "tessellation")) w *= 2.5;
      return w;
    },
    sub(1),
  );

  // Medium: forbid the last 3 nights' families outright, then bias by affinity
  // to the chosen composition and by the ink-temperature signal.
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

  // Abstraction rung: cat-heavy / teeming nights push MORE dissolved; sparse
  // nights are capped for legibility so each of the few contributors can still
  // find their mark (banners are attributed per-contributor).
  let ri = Math.floor(sub(4)() * RUNGS.length);
  if (a.catRatio >= 0.35 || a.density === "teeming") ri = Math.max(ri, 2);
  if (a.density === "sparse") ri = Math.min(ri, 1);
  const rung = RUNGS[ri];

  return { medium, composition, mood, rung, seedKey };
}

// --- 7. DETERMINISTIC FALLBACK PROSE (never throws; on-brand voice) --------
export type DirectorOut = { fusionConcept: string; prose: string };

export function renderDeterministicProse(
  a: NightAnalysis,
  lens: Lens,
): DirectorOut {
  const rand = mulberry32(fnv1a(lens.seedKey + "#subj"));
  const pool = [...a.subjects];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const subjectLine = pool.length
    ? `The contributors drew, among them: ${pool.join("; ")}.`
    : "";
  const catLine =
    a.catRatio >= 0.35
      ? " Let one recurring feline gesture — a curled spine, an ear-triangle, a comma of a tail — thread the whole composition rather than many separate cats."
      : "";
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return {
    fusionConcept:
      "The drawn subjects rhyme through shared curve and weight, fused by the medium's own process.",
    prose:
      `${cap(lens.medium.surface)}. Composed as ${lens.composition.armature}, ${lens.mood}. ` +
      `Palette: ${lens.medium.palette}. ${subjectLine} ` +
      `${RUNG_DIRECTIVE[lens.rung]}.${catLine}`,
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
// The lens is ALREADY LOCKED; the model may ONLY describe how tonight's subjects
// fuse within it. Validated + KITSCH-blocked. On any failure returns null and
// the caller falls back to deterministic prose. Mirrors the classifyDrawing
// pattern in confessional-captcha-server.ts.

const SYSTEM_RUBRIC = [
  "You are the night curator for an intimate, hand-made personal website. Once a night, a batch of finger-drawn doodles becomes ONE painting; you write the final art-direction prose for it.",
  "Voice: a discerning, restrained gallery curator — lowercase-leaning, unfussy, NOT a hype machine, NOT an AI-art prompt generator. The owner hates generic AI aesthetics, clutter, and kitsch.",
  "A curated LENS is ALREADY CHOSEN and LOCKED. You MAY NOT change the medium, palette, composition, mood, or abstraction level — only describe how THESE specific subjects fuse within them.",
  "The painting must NOT be a grid of labeled icons and must NOT trace each sketch literally. Invent ONE concrete cross-subject abstraction that unifies the motifs (e.g. 'the umbrella's ribs, the balloon's envelope and the teapot's belly are the same curved gesture at three scales', or 'one feline contour threads between every other form'). EVERY contributor's subject must be present somewhere, even if only as a gesture — do not silently drop any.",
  "The palette is already chosen and varies by medium; keep to it faithfully and add no loud, saturated colour.",
  "Forbidden words anywhere in your output: " + KITSCH.join(", ") + ".",
  'Reply with STRICT JSON only: {"fusionConcept":"<one sentence>","prose":"<a 90-140 word painterly paragraph that names the locked medium, palette, composition and mood, states the fusion, and folds in the named subjects>"}.',
].join("\n");

function validProse(p: unknown): p is DirectorOut {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  if (typeof o.prose !== "string" || o.prose.trim().length < 60) return false;
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
  const catLine =
    a.catRatio >= 0.35
      ? "Many subjects are cats — make a single recurring feline gesture the connective rhythm, not many separate cats."
      : "";
  const inkLine = a.inkBias
    ? `Contributors leaned ${a.inkBias} in their chosen inks — let that temperature whisper through the accents.`
    : "";
  const themeLine = a.centerOfGravity
    ? `Tonight's drawings cluster around a ${a.centerOfGravity} theme — let that be the quiet spine of the concept.`
    : "";
  const avoidLine = recentFamilies.length
    ? `Recent nights already used these medium families: ${recentFamilies.join(", ")}. This lens deliberately differs — lean into how different it feels.`
    : "";
  const userMsg = [
    "LOCKED LENS (do not change):",
    `Medium: ${lens.medium.surface}`,
    `Unifying process: ${lens.medium.logic}`,
    `Palette: ${lens.medium.palette}`,
    `Composition: ${lens.composition.armature}`,
    `Mood: ${lens.mood}`,
    `Abstraction: ${RUNG_DIRECTIVE[lens.rung]}.`,
    "",
    `SUBJECTS DRAWN TONIGHT: ${a.subjects.join("; ")}.`,
    themeLine,
    catLine,
    inkLine,
    avoidLine,
    "Write the fusionConcept and the final prose.",
  ]
    .filter(Boolean)
    .join("\n");

  // GPT-5 / o-series are reasoning models: they reject a custom temperature and
  // take a reasoning_effort knob instead (a touch of reasoning helps it honor the
  // locked-lens constraints; "low" keeps it ~5s). gpt-4o / gpt-4.1 are the
  // reverse — temperature, no effort. Build the tuning params per family.
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
// Build the full tagged prompt for a locked lens + director output. The caller
// strips the [lens:*] tag with stripLensTag before sending to the image model,
// and stores the tagged string so tomorrow's anti-repeat can read it.
export function assemblePrompt(
  out: DirectorOut,
  lens: Lens,
): string {
  return [
    out.prose.trim(),
    STANDING_RULE,
    lens.composition.incorporation + ".",
    CRAFT_TAIL,
    lensTag(lens.medium.family),
  ]
    .filter(Boolean)
    .join(" ");
}
