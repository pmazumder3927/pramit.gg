// ============================================================================
// Chaos engine — deterministic, seeded "fun variety" for repeated elements.
//
// The site is a hand-assembled sketchbook, so repeated things (post cards,
// pinned sketches, tracklist rows, stickers...) shouldn't look stamped from a
// mold. Feed any stable seed (a post id, a title, an index) to `chaosFor` and
// get a consistent-but-varied set of decorations: rotation, tape, paper
// texture, a clip, a corner sticker, a highlight.
//
// IMPORTANT: everything here is DETERMINISTIC (hash-based, no Math.random) so
// the server and client render identically — no hydration mismatch, and a
// given card always looks the same across reloads.
// ============================================================================

export type ChaosTone = "orange" | "purple" | "rust";
export type PaperVariant = "plain" | "ruled" | "grid" | "dotted";
export type TapePos = "tl" | "tr" | "tc" | "none";
export type Sticker = "star" | "scribble" | "squiggle" | "none";

function hash(input: string | number): number {
  const s = String(input);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministically pick an item from `arr` for `seed` (vary `salt` per field). */
export function pick<T>(seed: string | number, arr: T[], salt = 0): T {
  return arr[hash(seed + "::" + salt) % arr.length];
}

/** Deterministic yes/no at probability `prob` (0..1). */
export function chance(seed: string | number, prob: number, salt = 0): boolean {
  return (hash(seed + "::c" + salt) % 1000) / 1000 < prob;
}

/** A deterministic float in [min, max) for `seed`. */
export function range(seed: string | number, min: number, max: number, salt = 0): number {
  const t = (hash(seed + "::r" + salt) % 10000) / 10000;
  return min + t * (max - min);
}

export interface Chaos {
  rotate: number;
  tone: ChaosTone;
  paper: PaperVariant;
  tape: TapePos;
  tapeTone: ChaosTone;
  clip: boolean;
  sticker: Sticker;
  highlight: boolean;
}

const ROTATIONS = [-2.4, -1.7, -1.1, -0.6, 0.6, 1.1, 1.7, 2.4];
const TONES: ChaosTone[] = ["orange", "purple", "rust"];
// weighted: plain shows up more often so the variety reads as accents, not noise
const PAPERS: PaperVariant[] = ["plain", "plain", "plain", "ruled", "grid", "dotted"];
const TAPES: TapePos[] = ["tl", "tr", "tc", "none", "none"];
const STICKERS: Sticker[] = ["none", "none", "none", "none", "star", "scribble", "squiggle"];

export function chaosFor(seed: string | number): Chaos {
  return {
    rotate: pick(seed, ROTATIONS, 1),
    tone: pick(seed, TONES, 2),
    paper: pick(seed, PAPERS, 3),
    tape: pick(seed, TAPES, 4),
    tapeTone: pick(seed, TONES, 5),
    clip: chance(seed, 0.2, 6),
    sticker: pick(seed, STICKERS, 7),
    highlight: chance(seed, 0.16, 8),
  };
}

/** Inline background style for a paper texture variant. */
export function paperTextureStyle(paper: PaperVariant): React.CSSProperties {
  const line = "rgb(var(--accent-purple) / 0.09)";
  switch (paper) {
    case "ruled":
      return { backgroundImage: `repeating-linear-gradient(transparent 0 27px, ${line} 27px 28px)` };
    case "grid":
      return {
        backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
        backgroundSize: "22px 22px",
      };
    case "dotted":
      return {
        backgroundImage: `radial-gradient(rgb(var(--accent-purple) / 0.14) 1.1px, transparent 1.2px)`,
        backgroundSize: "18px 18px",
      };
    default:
      return {};
  }
}
