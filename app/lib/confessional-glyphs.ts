// Pictographic-character challenges for the confessional captcha. The council
// sometimes asks a visitor to *inscribe* a specific writing-system glyph —
// Chinese hanzi, a Japanese kana/kanji, or an Egyptian hieroglyph — instead of
// a freeform doodle. Reproducing an exact, exotic character is something a
// human can attempt by tracing the reference, but that an LLM image generator
// reliably mangles, so it fits the same anti-bot spirit as the cruel tier-5
// freeform prompts.
//
// This module is pure data + pure helpers so it is safe to import from both the
// client (font stacks, types) and the server (challenge generation, the verify
// rubric). It must NOT import from confessional-captcha.ts to avoid a cycle.

export type GlyphScript = "chinese" | "japanese" | "egyptian";

export type GlyphEntry = {
  // The character(s) to inscribe.
  glyph: string;
  script: GlyphScript;
  // Human-facing label for the eyebrow, e.g. "Chinese" / "Japanese · hiragana".
  scriptLabel: string;
  // Pinyin / romaji / transliteration. May be "" when there is no useful one
  // (most hieroglyphs).
  romanization: string;
  // What the character means / depicts.
  meaning: string;
  // A short visual description of the character's form. Doubles as a gentle
  // human hint *and* as the grading rubric handed to the vision model, so the
  // verifier does not have to rely solely on recognizing an exotic glyph.
  shapeHint: string;
  // Difficulty 1..5, mirroring the freeform PROMPT_TIERS ladder so glyph
  // difficulty tracks the running submission count.
  level: number;
};

// CSS font-family stacks per script. These reference the variables wired up in
// app/layout.tsx (`--font-cjk-hand` already exists for CJK lyrics; the JP and
// hieroglyph faces are added there alongside it). Kept here so the canvas
// component, the reference header, and the tracing ghost all stay in sync.
const FONT_BY_SCRIPT: Record<GlyphScript, string> = {
  chinese: "var(--font-cjk-hand)",
  // Kana live only in the Japanese face; kanji can fall back to the Chinese
  // brush face if the JP font is still loading.
  japanese: "var(--font-jp-hand), var(--font-cjk-hand)",
  egyptian: "var(--font-egyptian)",
};

export function glyphFontStack(script: GlyphScript): string {
  return `${FONT_BY_SCRIPT[script]}, serif`;
}

// The exact set of glyphs we ever render. Used to subset font requests / reason
// about coverage if needed.
export function allGlyphCharacters(): string {
  return GLYPHS.map((g) => g.glyph).join("");
}

// ── Catalog ──────────────────────────────────────────────────────────────────

export const GLYPHS: GlyphEntry[] = [
  // ── Chinese (hanzi) — rendered in the Ma Shan Zheng brush face ──────────────
  {
    glyph: "一",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "yī",
    meaning: "one",
    shapeHint: "a single horizontal stroke.",
    level: 1,
  },
  {
    glyph: "二",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "èr",
    meaning: "two",
    shapeHint: "two stacked horizontal strokes, the lower one longer.",
    level: 1,
  },
  {
    glyph: "三",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "sān",
    meaning: "three",
    shapeHint: "three stacked horizontal strokes, the bottom one longest.",
    level: 1,
  },
  {
    glyph: "人",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "rén",
    meaning: "person",
    shapeHint: "two legs spreading from a single apex, like a walking figure.",
    level: 1,
  },
  {
    glyph: "大",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "dà",
    meaning: "big",
    shapeHint: "a person (人) with arms thrown wide — a horizontal bar across spreading legs.",
    level: 1,
  },
  {
    glyph: "口",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "kǒu",
    meaning: "mouth",
    shapeHint: "a simple open square / box.",
    level: 1,
  },
  {
    glyph: "日",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "rì",
    meaning: "sun / day",
    shapeHint: "a tall rectangle with one horizontal line dividing it in the middle.",
    level: 1,
  },
  {
    glyph: "月",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "yuè",
    meaning: "moon / month",
    shapeHint: "a tall rounded rectangle with two short horizontal lines inside, open at the lower left.",
    level: 2,
  },
  {
    glyph: "山",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "shān",
    meaning: "mountain",
    shapeHint: "three vertical peaks on one horizontal base, the middle peak tallest.",
    level: 1,
  },
  {
    glyph: "川",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "chuān",
    meaning: "river",
    shapeHint: "three roughly vertical strokes side by side, like flowing water.",
    level: 1,
  },
  {
    glyph: "水",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "shuǐ",
    meaning: "water",
    shapeHint: "a central vertical stroke with a hook, flanked by strokes sweeping out to each side, like a stream with branches.",
    level: 2,
  },
  {
    glyph: "火",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "huǒ",
    meaning: "fire",
    shapeHint: "a central figure like 人 with two short flanking strokes near the top, like rising flames.",
    level: 2,
  },
  {
    glyph: "木",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "mù",
    meaning: "tree / wood",
    shapeHint: "a vertical trunk crossed by one horizontal branch, with two roots sweeping down and out at the base.",
    level: 2,
  },
  {
    glyph: "中",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "zhōng",
    meaning: "middle / center",
    shapeHint: "a box with a single vertical line passing straight through its center, top to bottom.",
    level: 2,
  },
  {
    glyph: "目",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "mù",
    meaning: "eye",
    shapeHint: "a tall rectangle divided by two horizontal lines into three boxes.",
    level: 2,
  },
  {
    glyph: "心",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "xīn",
    meaning: "heart / mind",
    shapeHint: "a shallow curved bowl with three dots — one inside, two trailing to the upper right.",
    level: 3,
  },
  {
    glyph: "手",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "shǒu",
    meaning: "hand",
    shapeHint: "three horizontal strokes crossed by a long vertical stroke that hooks at the bottom.",
    level: 3,
  },
  {
    glyph: "力",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "lì",
    meaning: "strength / power",
    shapeHint: "a hooked stroke bent like a flexed arm, with one diagonal slash across it.",
    level: 2,
  },
  {
    glyph: "雨",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "yǔ",
    meaning: "rain",
    shapeHint: "a roof-like frame enclosing four dots arranged in two columns, like raindrops behind a window.",
    level: 3,
  },
  {
    glyph: "魚",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "yú",
    meaning: "fish",
    shapeHint: "a stacked figure: a small head on top, a hatched body in the middle, four dots for fins/tail at the bottom.",
    level: 3,
  },
  {
    glyph: "鳥",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "niǎo",
    meaning: "bird",
    shapeHint: "a bird in profile: a head with a dot eye on top, a body, and four dots for tail feathers at the base.",
    level: 4,
  },
  {
    glyph: "馬",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "mǎ",
    meaning: "horse",
    shapeHint: "a dense figure with several horizontal strokes over four dots (galloping legs) at the bottom.",
    level: 4,
  },
  {
    glyph: "花",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "huā",
    meaning: "flower",
    shapeHint: "the grass radical (two short stems over a horizontal bar) sitting on top of two lower components.",
    level: 3,
  },
  {
    glyph: "星",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "xīng",
    meaning: "star",
    shapeHint: "the sun box 日 on top, sitting over the 生 component (a few horizontal strokes crossed by a vertical).",
    level: 4,
  },
  {
    glyph: "海",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "hǎi",
    meaning: "sea",
    shapeHint: "three short water-drops down the left side, beside the 每 component on the right.",
    level: 4,
  },
  {
    glyph: "貓",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "māo",
    meaning: "cat",
    shapeHint: "the clawed-beast radical down the left, beside the grass radical over 田 (a field box) on the right.",
    level: 4,
  },
  {
    glyph: "福",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "fú",
    meaning: "fortune / luck",
    shapeHint: "the altar radical on the left, beside a stack of one-mouth-field (一口田) on the right.",
    level: 4,
  },
  {
    glyph: "愛",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "ài",
    meaning: "love",
    shapeHint: "a clawed top, a heart 心 in the middle, and a slow trailing foot stroke at the bottom.",
    level: 5,
  },
  {
    glyph: "夢",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "mèng",
    meaning: "dream",
    shapeHint: "the grass radical over a 目 eye box, over a roof-like cover, over the evening 夕 stroke.",
    level: 5,
  },
  {
    glyph: "龜",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "guī",
    meaning: "turtle",
    shapeHint: "a turtle seen from the side: a head on top, a hatched shell body, and legs/tail strokes — many strokes, very intricate.",
    level: 5,
  },
  {
    glyph: "龍",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "lóng",
    meaning: "dragon",
    shapeHint: "a dense two-part character: a standing component on the left, and a stack of short horizontal strokes with three on the right — very intricate.",
    level: 5,
  },

  // ── Japanese (kana + kanji) — rendered in the Yuji Syuku brush face ─────────
  // Kana have sounds rather than meanings, so the bare romaji is the gloss and
  // the redundant romanization field is left empty.
  {
    glyph: "い",
    script: "japanese",
    scriptLabel: "Japanese · hiragana",
    romanization: "",
    meaning: "i",
    shapeHint: "two separate downward strokes, a tall curved one on the left and a short one on the right.",
    level: 1,
  },
  {
    glyph: "う",
    script: "japanese",
    scriptLabel: "Japanese · hiragana",
    romanization: "",
    meaning: "u",
    shapeHint: "a short tick on top, then a single stroke that curves down and around to the right.",
    level: 1,
  },
  {
    glyph: "し",
    script: "japanese",
    scriptLabel: "Japanese · hiragana",
    romanization: "",
    meaning: "shi",
    shapeHint: "one stroke that drops straight down then hooks up to the right at the bottom, like a fish hook.",
    level: 1,
  },
  {
    glyph: "つ",
    script: "japanese",
    scriptLabel: "Japanese · hiragana",
    romanization: "",
    meaning: "tsu",
    shapeHint: "a single stroke that sweeps right across the top then curls down and back to the left.",
    level: 1,
  },
  {
    glyph: "の",
    script: "japanese",
    scriptLabel: "Japanese · hiragana",
    romanization: "",
    meaning: "no",
    shapeHint: "one continuous stroke spiraling into a loop, like a stylized @ or a curl.",
    level: 1,
  },
  {
    glyph: "こ",
    script: "japanese",
    scriptLabel: "Japanese · hiragana",
    romanization: "",
    meaning: "ko",
    shapeHint: "two short horizontal-ish strokes stacked, the lower one curving up at its right end.",
    level: 1,
  },
  {
    glyph: "あ",
    script: "japanese",
    scriptLabel: "Japanese · hiragana",
    romanization: "",
    meaning: "a",
    shapeHint: "a horizontal stroke, a vertical stroke crossing it, and a curling loop on the lower right.",
    level: 2,
  },
  {
    glyph: "さ",
    script: "japanese",
    scriptLabel: "Japanese · hiragana",
    romanization: "",
    meaning: "sa",
    shapeHint: "a horizontal stroke up top, then a stroke that curves down and to the left below it.",
    level: 2,
  },
  {
    glyph: "き",
    script: "japanese",
    scriptLabel: "Japanese · hiragana",
    romanization: "",
    meaning: "ki",
    shapeHint: "two short horizontal strokes crossed by a vertical, with a curved hook below.",
    level: 2,
  },
  {
    glyph: "ね",
    script: "japanese",
    scriptLabel: "Japanese · hiragana",
    romanization: "",
    meaning: "ne",
    shapeHint: "a vertical stroke on the left, then a stroke that loops into a curl on the right.",
    level: 2,
  },
  {
    glyph: "る",
    script: "japanese",
    scriptLabel: "Japanese · hiragana",
    romanization: "",
    meaning: "ru",
    shapeHint: "a single stroke that zig-zags down then finishes in a small loop at the bottom.",
    level: 2,
  },
  {
    glyph: "カ",
    script: "japanese",
    scriptLabel: "Japanese · katakana",
    romanization: "",
    meaning: "ka",
    shapeHint: "a hooked stroke like a flexed corner, crossed by one diagonal — the same shape as the kanji 力.",
    level: 2,
  },
  {
    glyph: "ロ",
    script: "japanese",
    scriptLabel: "Japanese · katakana",
    romanization: "",
    meaning: "ro",
    shapeHint: "a simple square box.",
    level: 1,
  },
  {
    glyph: "ツ",
    script: "japanese",
    scriptLabel: "Japanese · katakana",
    romanization: "",
    meaning: "tsu",
    shapeHint: "two short dashes on top, then a long stroke curving up from the bottom-left.",
    level: 3,
  },
  {
    glyph: "猫",
    script: "japanese",
    scriptLabel: "Japanese · kanji",
    romanization: "neko",
    meaning: "cat",
    shapeHint: "the beast radical (a curved stroke with a vertical) on the left, beside the grass radical over a 田 field box on the right.",
    level: 4,
  },
  {
    glyph: "亀",
    script: "japanese",
    scriptLabel: "Japanese · kanji",
    romanization: "kame",
    meaning: "turtle",
    shapeHint: "a turtle from the side: a small head on top, a boxy hatched shell, and a tail stroke at the base.",
    level: 4,
  },
  {
    glyph: "竜",
    script: "japanese",
    scriptLabel: "Japanese · kanji",
    romanization: "ryū",
    meaning: "dragon",
    shapeHint: "a 立 'stand' component on top, over a 田 field box, over a single hooked vertical stroke.",
    level: 4,
  },
  {
    glyph: "桜",
    script: "japanese",
    scriptLabel: "Japanese · kanji",
    romanization: "sakura",
    meaning: "cherry blossom",
    shapeHint: "the tree radical 木 on the left, beside three small strokes over a woman 女 component on the right.",
    level: 4,
  },
  {
    glyph: "夢",
    script: "japanese",
    scriptLabel: "Japanese · kanji",
    romanization: "yume",
    meaning: "dream",
    shapeHint: "the grass radical over a 目 eye box, over a roof-like cover, over the evening 夕 stroke.",
    level: 5,
  },

  // ── Egyptian hieroglyphs — rendered in Noto Sans Egyptian Hieroglyphs ───────
  // Pictographic by nature, so the shapeHint carries most of the grading load.
  {
    glyph: "𓇳",
    script: "egyptian",
    scriptLabel: "Egyptian hieroglyph",
    romanization: "rꜥ",
    meaning: "sun",
    shapeHint: "a circle with a single dot at its center — the sun disk.",
    level: 1,
  },
  {
    glyph: "𓈖",
    script: "egyptian",
    scriptLabel: "Egyptian hieroglyph",
    romanization: "n",
    meaning: "water",
    shapeHint: "a single horizontal zig-zag line — ripples of water.",
    level: 1,
  },
  {
    glyph: "𓏏",
    script: "egyptian",
    scriptLabel: "Egyptian hieroglyph",
    romanization: "t",
    meaning: "bread loaf",
    shapeHint: "a small half-circle / domed loaf sitting on a flat base.",
    level: 1,
  },
  {
    glyph: "𓂀",
    script: "egyptian",
    scriptLabel: "Egyptian hieroglyph",
    romanization: "wḏꜢt",
    meaning: "Eye of Horus",
    shapeHint: "an almond eye with a brow above, a straight line dropping below, and a curl spiraling out beneath it.",
    level: 4,
  },
  {
    glyph: "𓅓",
    script: "egyptian",
    scriptLabel: "Egyptian hieroglyph",
    romanization: "m",
    meaning: "owl",
    shapeHint: "an owl standing in profile but with its round face turned to look straight at you.",
    level: 3,
  },
  {
    glyph: "𓆑",
    script: "egyptian",
    scriptLabel: "Egyptian hieroglyph",
    romanization: "f",
    meaning: "horned viper",
    shapeHint: "a snake lying along the ground, a low wavy horizontal body with a small horn near the head.",
    level: 3,
  },
  {
    glyph: "𓃭",
    script: "egyptian",
    scriptLabel: "Egyptian hieroglyph",
    romanization: "rw",
    meaning: "lion",
    shapeHint: "a lion lying down in profile, legs folded, tail curving up.",
    level: 4,
  },
  {
    glyph: "𓀀",
    script: "egyptian",
    scriptLabel: "Egyptian hieroglyph",
    romanization: "ꜣ",
    meaning: "seated man",
    shapeHint: "a man seated on the ground in profile, knees drawn up, one hand toward his mouth.",
    level: 3,
  },
];

// Pick a glyph whose difficulty sits at or below the current tier, biased to
// the top of that range so glyph difficulty tracks the freeform tier ladder.
// Returns null only if the catalog is somehow empty.
export function pickGlyph(maxLevel: number): GlyphEntry | null {
  const withinTier = GLYPHS.filter((g) => g.level <= maxLevel);
  if (withinTier.length === 0) {
    return GLYPHS.length > 0 ? GLYPHS[0] : null;
  }
  const band = withinTier.filter((g) => g.level >= Math.max(1, maxLevel - 1));
  const pool = band.length > 0 ? band : withinTier;
  return pool[Math.floor(Math.random() * pool.length)];
}

// A readable label stored as the drawing's `prompt` (shown in the gallery) and
// used in council copy, e.g.  水 — "water" (Chinese).
export function glyphPromptLabel(entry: GlyphEntry): string {
  return `${entry.glyph} — “${entry.meaning}” (${entry.scriptLabel})`;
}
