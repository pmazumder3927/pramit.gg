// Pictographic-character challenges for the confessional captcha. The council
// sometimes asks a visitor to *inscribe* a specific writing-system glyph —
// Chinese hanzi, a Japanese kanji, or an Egyptian hieroglyph — instead of a
// freeform doodle. The character is shown only as a small reference in the
// council's header; there is NO tracing guide on the canvas, so visitors must
// reproduce these intricate, unfamiliar glyphs freehand from a glance. The
// botched results are the point. Reproducing an exact exotic character is also
// something a human can attempt but that an LLM image generator reliably
// mangles, so it fits the same anti-bot spirit as the cruel freeform prompts.
//
// This module is pure data + pure helpers so it is safe to import from both the
// client (font stacks, types) and the server (challenge generation, the verify
// rubric). It must NOT import from confessional-captcha.ts to avoid a cycle.

export type GlyphScript = "chinese" | "japanese" | "egyptian";

export type GlyphEntry = {
  // The character(s) to inscribe.
  glyph: string;
  script: GlyphScript;
  // Human-facing label for the eyebrow, e.g. "Chinese" / "Japanese · kanji".
  scriptLabel: string;
  // Pinyin / romaji / transliteration. May be "".
  romanization: string;
  // What the character means / depicts.
  meaning: string;
  // A short visual description of the character's form. Doubles as a gentle
  // human hint *and* as the grading rubric handed to the vision model, so the
  // verifier does not have to rely solely on recognizing an exotic glyph.
  shapeHint: string;
  // Difficulty 3 (hard) … 5 (brutal). Only biases selection toward the harder
  // glyphs — there is no easy tier here on purpose.
  level: number;
};

// CSS font-family stacks per script. These reference the variables wired up in
// app/layout.tsx (`--font-cjk-hand` already exists for CJK lyrics; the JP and
// hieroglyph faces are added there alongside it). Kept here so the canvas
// component and the reference header stay in sync.
//
// IMPORTANT: Ma Shan Zheng (--font-cjk-hand) is a Simplified-Chinese-only face,
// so every Chinese entry below uses a simplified form (verified against the
// font's cmap). Traditional forms would render as tofu.
const FONT_BY_SCRIPT: Record<GlyphScript, string> = {
  chinese: "var(--font-cjk-hand)",
  // Kanji live in the Japanese face; fall back to the Chinese brush face if the
  // JP font is still loading.
  japanese: "var(--font-jp-hand), var(--font-cjk-hand)",
  egyptian: "var(--font-egyptian)",
};

export function glyphFontStack(script: GlyphScript): string {
  return `${FONT_BY_SCRIPT[script]}, serif`;
}

// The exact set of glyphs we ever render. Handy for reasoning about / subsetting
// font coverage.
export function allGlyphCharacters(): string {
  return GLYPHS.map((g) => g.glyph).join("");
}

// ── Catalog ──────────────────────────────────────────────────────────────────
//
// Intentionally HARD with lots of variety. Every glyph was checked against the
// actual font cmap (Ma Shan Zheng is simplified-only, so all hanzi are
// simplified; Yuji Syuku and Noto Sans Egyptian Hieroglyphs cover their sets
// fully), so none render as tofu.

export const GLYPHS: GlyphEntry[] = [
  // ── Chinese (simplified hanzi) — Ma Shan Zheng brush face ───────────────────
  {
    glyph: "爨",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "cuàn",
    meaning: "cooking-stove",
    shapeHint:
      "one of the most complex characters there is — a roof over a vessel, over two hands, over crossed wood and fire. ~30 strokes.",
    level: 5,
  },
  {
    glyph: "饕餮",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "tāo tiè",
    meaning: "taotie, a gluttonous mythical beast",
    shapeHint:
      "two dense characters side by side, each built on the 'eat/food' radical — a maw that devours everything.",
    level: 5,
  },
  {
    glyph: "鬱",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "yù",
    meaning: "gloom / lush",
    shapeHint:
      "a famously dense character: trees flanking a vessel up top, over a cover, over a tangle of strokes. ~29 strokes.",
    level: 5,
  },
  {
    glyph: "黼",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "fǔ",
    meaning: "axe-shaped embroidery pattern",
    shapeHint:
      "the black-silk radical 黹 on the left (itself intricate) beside the 甫 component on the right.",
    level: 5,
  },
  {
    glyph: "鬻",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "yù",
    meaning: "to sell / gruel",
    shapeHint:
      "two bow shapes 弓 flanking a 米 (rice) up top, all sitting over a 鬲 cauldron at the bottom.",
    level: 5,
  },
  {
    glyph: "鬣",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "liè",
    meaning: "mane / bristles",
    shapeHint:
      "the long-hair radical 髟 arched over the top, over a stack of small components below.",
    level: 5,
  },
  {
    glyph: "巍",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "wēi",
    meaning: "towering, lofty",
    shapeHint: "the mountain 山 perched on top of the dense 魏 character beneath it.",
    level: 5,
  },
  {
    glyph: "鹦鹉",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "yīng wǔ",
    meaning: "parrot",
    shapeHint:
      "two characters, each ending in the bird radical 鸟 on the right, with dense components on the left.",
    level: 5,
  },
  {
    glyph: "蟋蟀",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "xī shuài",
    meaning: "cricket",
    shapeHint:
      "two characters, each with the insect radical 虫 on the left and a dense component on the right.",
    level: 5,
  },
  {
    glyph: "鼎",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "dǐng",
    meaning: "ancient three-legged cauldron",
    shapeHint:
      "a boxy 目-like body up top sitting on a frame with two splayed legs — a bronze ritual cauldron.",
    level: 4,
  },
  {
    glyph: "鑫",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "xīn",
    meaning: "prosperity (three golds)",
    shapeHint:
      "the character 金 (gold) drawn three times — one on top, two below — stacked into a pyramid.",
    level: 4,
  },
  {
    glyph: "淼",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "miǎo",
    meaning: "a vast expanse of water (three waters)",
    shapeHint: "the character 水 (water) drawn three times — one on top, two below.",
    level: 4,
  },
  {
    glyph: "焱",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "yàn",
    meaning: "flames / sparks (three fires)",
    shapeHint: "the character 火 (fire) drawn three times — one on top, two below.",
    level: 4,
  },
  {
    glyph: "矗",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "chù",
    meaning: "towering, upright",
    shapeHint: "the character 直 (straight) drawn three times — one on top, two below.",
    level: 4,
  },
  {
    glyph: "颧",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "quán",
    meaning: "cheekbone",
    shapeHint:
      "a dense left component (grass over two mouths over a bird) beside the 页 'head' radical on the right.",
    level: 4,
  },
  {
    glyph: "馕",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "náng",
    meaning: "naan (flatbread)",
    shapeHint:
      "the food radical 饣 on the left beside the tall, dense 囊 'sack' character on the right.",
    level: 4,
  },
  {
    glyph: "警",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "jǐng",
    meaning: "to warn / police",
    shapeHint:
      "the dense 敬 'respect' character on top, sitting over the 言 'speech' radical at the bottom.",
    level: 4,
  },
  {
    glyph: "黛",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "dài",
    meaning: "dark eyebrow pigment",
    shapeHint:
      "the 代 component on top, sitting over the 黑 'black' radical (a dense box over four dots) below.",
    level: 4,
  },
  {
    glyph: "龟",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "guī",
    meaning: "turtle",
    shapeHint:
      "a turtle seen from the side: a small head on top, a hooked body/shell, and a hooked tail stroke.",
    level: 4,
  },
  {
    glyph: "鹰",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "yīng",
    meaning: "eagle / hawk",
    shapeHint:
      "a cliff radical sheltering a 'person + bird' inside, over the bird radical 鸟 at the bottom.",
    level: 4,
  },
  {
    glyph: "鹤",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "hè",
    meaning: "crane",
    shapeHint:
      "a dense left component (a roof over 隹) beside the bird radical 鸟 on the right.",
    level: 4,
  },
  {
    glyph: "鼠",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "shǔ",
    meaning: "rat / mouse",
    shapeHint:
      "a boxy head up top with whiskers, over a body with several short clawed strokes and a tail.",
    level: 4,
  },
  {
    glyph: "森",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "sēn",
    meaning: "forest (three trees)",
    shapeHint: "the character 木 (tree) drawn three times — one on top, two below.",
    level: 3,
  },
  {
    glyph: "磊",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "lěi",
    meaning: "a pile of rocks (three stones)",
    shapeHint: "the character 石 (stone) drawn three times — one on top, two below.",
    level: 3,
  },
  {
    glyph: "晶",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "jīng",
    meaning: "sparkle / crystal (three suns)",
    shapeHint: "the character 日 (sun) drawn three times — one on top, two below.",
    level: 3,
  },
  {
    glyph: "龙",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "lóng",
    meaning: "dragon",
    shapeHint:
      "a short stroke and a hooked stroke up top, with a long curved-and-hooked stroke sweeping down on the right.",
    level: 3,
  },
  {
    glyph: "凤",
    script: "chinese",
    scriptLabel: "Chinese",
    romanization: "fèng",
    meaning: "phoenix",
    shapeHint: "an enclosing hooked stroke wrapping around the 又 component inside it.",
    level: 3,
  },

  // ── Japanese (kanji) — Yuji Syuku brush face ────────────────────────────────
  {
    glyph: "鬱",
    script: "japanese",
    scriptLabel: "Japanese · kanji",
    romanization: "utsu",
    meaning: "gloom / depression",
    shapeHint:
      "a famously dense kanji (~29 strokes): trees flanking a vessel up top, over a cover, over a tangle of strokes.",
    level: 5,
  },
  {
    glyph: "薔薇",
    script: "japanese",
    scriptLabel: "Japanese · kanji",
    romanization: "bara",
    meaning: "rose",
    shapeHint: "two characters, each capped by the grass radical 艹 over dense lower halves.",
    level: 5,
  },
  {
    glyph: "檸檬",
    script: "japanese",
    scriptLabel: "Japanese · kanji",
    romanization: "remon",
    meaning: "lemon",
    shapeHint:
      "two characters, each with the tree radical 木 on the left and a dense component on the right.",
    level: 5,
  },
  {
    glyph: "麒麟",
    script: "japanese",
    scriptLabel: "Japanese · kanji",
    romanization: "kirin",
    meaning: "giraffe / the mythical qilin",
    shapeHint:
      "two characters, each built on the deer radical 鹿 on the left with a dense component on the right.",
    level: 5,
  },
  {
    glyph: "髑髏",
    script: "japanese",
    scriptLabel: "Japanese · kanji",
    romanization: "dokuro",
    meaning: "skull",
    shapeHint:
      "two characters, each with the bone radical 骨 on the left and a dense component on the right.",
    level: 5,
  },
  {
    glyph: "鳳凰",
    script: "japanese",
    scriptLabel: "Japanese · kanji",
    romanization: "hōō",
    meaning: "phoenix",
    shapeHint:
      "two characters, each an enclosing hooked frame wrapping a bird-like component inside.",
    level: 5,
  },
  {
    glyph: "顰",
    script: "japanese",
    scriptLabel: "Japanese · kanji",
    romanization: "hisomu",
    meaning: "to frown / knit the brows",
    shapeHint:
      "an extremely dense kanji — a wide grid of components over the 頻 character; almost no white space.",
    level: 5,
  },
  {
    glyph: "葡萄",
    script: "japanese",
    scriptLabel: "Japanese · kanji",
    romanization: "budō",
    meaning: "grapes",
    shapeHint:
      "two characters, each capped by the grass radical 艹 over a wrapped lower component.",
    level: 4,
  },
  {
    glyph: "籠",
    script: "japanese",
    scriptLabel: "Japanese · kanji",
    romanization: "kago",
    meaning: "basket / cage",
    shapeHint: "the bamboo radical 竹 across the top, sitting over the dragon character 龍 below.",
    level: 4,
  },
  {
    glyph: "鯨",
    script: "japanese",
    scriptLabel: "Japanese · kanji",
    romanization: "kujira",
    meaning: "whale",
    shapeHint:
      "the fish radical 魚 on the left (a head, hatched body, four dots) beside the 京 component on the right.",
    level: 4,
  },
  {
    glyph: "蟹",
    script: "japanese",
    scriptLabel: "Japanese · kanji",
    romanization: "kani",
    meaning: "crab",
    shapeHint:
      "the dense 解 'untie' character up top, sitting over the insect radical 虫 at the bottom.",
    level: 4,
  },
  {
    glyph: "鰻",
    script: "japanese",
    scriptLabel: "Japanese · kanji",
    romanization: "unagi",
    meaning: "eel",
    shapeHint: "the fish radical 魚 on the left beside the 曼 component on the right.",
    level: 4,
  },
  {
    glyph: "魔",
    script: "japanese",
    scriptLabel: "Japanese · kanji",
    romanization: "ma",
    meaning: "demon / magic",
    shapeHint:
      "the cliff/hemp radical 麻 sheltering the 鬼 'demon' character tucked underneath it.",
    level: 4,
  },
  {
    glyph: "闇",
    script: "japanese",
    scriptLabel: "Japanese · kanji",
    romanization: "yami",
    meaning: "darkness",
    shapeHint: "the gate radical 門 enclosing the 音 'sound' character inside it.",
    level: 4,
  },
  {
    glyph: "燕",
    script: "japanese",
    scriptLabel: "Japanese · kanji",
    romanization: "tsubame",
    meaning: "swallow (the bird)",
    shapeHint:
      "a stack: 廿 on top, a hatched middle with 口 and flanks, over the four-dot fire radical at the bottom — a swallow in flight.",
    level: 4,
  },
  {
    glyph: "鬼",
    script: "japanese",
    scriptLabel: "Japanese · kanji",
    romanization: "oni",
    meaning: "demon / ogre",
    shapeHint:
      "a big boxy head (田) up top with a horn-stroke, over legs and a small curling tail to the right.",
    level: 3,
  },
  {
    glyph: "嵐",
    script: "japanese",
    scriptLabel: "Japanese · kanji",
    romanization: "arashi",
    meaning: "storm",
    shapeHint:
      "the mountain 山 on top, sitting over the wind character 風 (a hooked frame around an insect) below.",
    level: 3,
  },
  {
    glyph: "雷",
    script: "japanese",
    scriptLabel: "Japanese · kanji",
    romanization: "kaminari",
    meaning: "thunder",
    shapeHint:
      "the rain radical 雨 (a roofed frame with four drops) on top, over a single 田 field box below.",
    level: 3,
  },
  {
    glyph: "椿",
    script: "japanese",
    scriptLabel: "Japanese · kanji",
    romanization: "tsubaki",
    meaning: "camellia",
    shapeHint: "the tree radical 木 on the left beside the 春 'spring' character on the right.",
    level: 3,
  },

  // ── Egyptian hieroglyphs — Noto Sans Egyptian Hieroglyphs ───────────────────
  // Pictographic, so the shapeHint carries the grading load.
  {
    glyph: "𓂀",
    script: "egyptian",
    scriptLabel: "Egyptian hieroglyph",
    romanization: "wḏꜢt",
    meaning: "the Eye of Horus",
    shapeHint:
      "an almond eye with a brow above, a straight line dropping below, and a long curl spiraling out beneath it.",
    level: 4,
  },
  {
    glyph: "𓆣",
    script: "egyptian",
    scriptLabel: "Egyptian hieroglyph",
    romanization: "ḫpr",
    meaning: "scarab beetle",
    shapeHint:
      "a dung beetle seen from above — a rounded body with a notched head and legs splayed to each side.",
    level: 4,
  },
  {
    glyph: "𓅃",
    script: "egyptian",
    scriptLabel: "Egyptian hieroglyph",
    romanization: "ḥr",
    meaning: "falcon (the god Horus)",
    shapeHint: "a falcon standing in profile, body upright, wings folded, facing right.",
    level: 4,
  },
  {
    glyph: "𓄿",
    script: "egyptian",
    scriptLabel: "Egyptian hieroglyph",
    romanization: "Ꜣ",
    meaning: "Egyptian vulture",
    shapeHint: "a vulture standing in profile with a hooked beak and a long drooping tail.",
    level: 4,
  },
  {
    glyph: "𓃭",
    script: "egyptian",
    scriptLabel: "Egyptian hieroglyph",
    romanization: "rw",
    meaning: "reclining lion",
    shapeHint: "a lion lying down in profile, legs folded beneath it, tail curving up.",
    level: 4,
  },
  {
    glyph: "𓃒",
    script: "egyptian",
    scriptLabel: "Egyptian hieroglyph",
    romanization: "kꜢ",
    meaning: "bull",
    shapeHint: "a bull standing in profile, with curved horns and a long tail.",
    level: 4,
  },
  {
    glyph: "𓀭",
    script: "egyptian",
    scriptLabel: "Egyptian hieroglyph",
    romanization: "nṯr",
    meaning: "a seated god",
    shapeHint: "a bearded figure seated on a low throne, seen in profile, knees forward.",
    level: 4,
  },
  {
    glyph: "𓆤",
    script: "egyptian",
    scriptLabel: "Egyptian hieroglyph",
    romanization: "bjt",
    meaning: "bee",
    shapeHint:
      "a bee seen from above — a fat segmented body with wings and legs spread to the sides.",
    level: 4,
  },
  {
    glyph: "𓋹",
    script: "egyptian",
    scriptLabel: "Egyptian hieroglyph",
    romanization: "ꜥnḫ",
    meaning: "ankh — life",
    shapeHint: "a cross with a teardrop loop on top — the looped ankh, symbol of life.",
    level: 3,
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
    glyph: "𓆓",
    script: "egyptian",
    scriptLabel: "Egyptian hieroglyph",
    romanization: "ḏ",
    meaning: "cobra",
    shapeHint: "a cobra resting along the ground then rearing up at the head end.",
    level: 3,
  },
  {
    glyph: "𓅱",
    script: "egyptian",
    scriptLabel: "Egyptian hieroglyph",
    romanization: "w",
    meaning: "quail chick",
    shapeHint: "a small, fat quail chick standing in profile with a stubby tail.",
    level: 3,
  },
  {
    glyph: "𓊖",
    script: "egyptian",
    scriptLabel: "Egyptian hieroglyph",
    romanization: "njwt",
    meaning: "town / village",
    shapeHint: "a circle quartered by a cross inside it — crossroads within a town wall.",
    level: 3,
  },
  {
    glyph: "𓁹",
    script: "egyptian",
    scriptLabel: "Egyptian hieroglyph",
    romanization: "jr",
    meaning: "eye",
    shapeHint: "a single human eye, almond-shaped with a pupil and a brow line above.",
    level: 3,
  },
];

// Pick a glyph, biased toward the harder ones (weight ∝ level) while keeping the
// pool varied. Difficulty is independent of the freeform tier ladder — glyph
// challenges are meant to be hard for everyone.
export function pickGlyph(): GlyphEntry | null {
  if (GLYPHS.length === 0) return null;
  const total = GLYPHS.reduce((sum, g) => sum + g.level, 0);
  let r = Math.random() * total;
  for (const g of GLYPHS) {
    r -= g.level;
    if (r < 0) return g;
  }
  return GLYPHS[GLYPHS.length - 1];
}

// A readable label stored as the drawing's `prompt` (shown in the gallery) and
// used in council copy, e.g.  爨 — "cooking-stove" (Chinese).
export function glyphPromptLabel(entry: GlyphEntry): string {
  return `${entry.glyph} — “${entry.meaning}” (${entry.scriptLabel})`;
}
