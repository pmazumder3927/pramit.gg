"use client";

// The song's words, written INTO the scape like a hand filling a page.
//
// Model — a PEN writing in COLUMNS:
//   · A column has a position, orientation, size and an advance direction. Lines
//     flow one after another along it (a real passage), each "written in" with a
//     left→right ink wipe.
//   · When the next slot is blocked — by a doodle, the page's own text, another
//     line or the edge — or the column's quota runs out, the pen lifts and starts
//     a FRESH column in open space, sized to whatever gap it finds (a small note
//     in a tight spot, big text down an open margin).
//   · So flow is the default and placements still fill the gaps; "obstacles" are
//     the foreground DOM text, the doodles (passed in) and the live lines.
//
// Timing rides the same interpolated playhead the doodles use, so lines land in
// step with the vocal; see useActiveLine.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { LyricLine } from "./useLyrics";
import type { SpotifyTrack } from "./NowPlayingContext";
import { type Box, collectForeground } from "@/app/lib/scape-layout";

const W = 1600;
const H = 900;
const FONT = 60;
const MIN_SIZE = FONT * 0.5; // can shrink to tuck into a small gap
const MAX_SIZE = FONT * 1.9; // …or grow to fill a margin
const MAX_VISIBLE = 3; // current line + 2 fading ghosts
// nudge lines in slightly early so they read in-time with the vocal, not chasing.
const LYRIC_LEAD_MS = 220;

/* -------------------------------- fonts -------------------------------- */
// Caveat for Latin, then per-script inked faces (lazy webfonts + system
// fallbacks), then serif. Webfonts first so each script gets its own hand; the
// broad system fallbacks (e.g. pan-Indic Nirmala UI) sit last so they can't
// intercept a script that has a dedicated face.
const LYRIC_FONT =
  "var(--font-caveat), " +
  "var(--font-cjk-hand), var(--font-kr-hand), var(--font-hi-hand), var(--font-bn-hand), " +
  "'Kaiti SC', 'STKaiti', 'KaiTi', 'Kaiti TC', 'Xingkai SC', " +
  "'Apple SD Gothic Neo', 'Malgun Gothic', " +
  "'Kohinoor Devanagari', 'Kohinoor Bangla', 'Bangla Sangam MN', 'Vrinda', 'Nirmala UI', " +
  "'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif CJK SC', 'Songti SC', " +
  "cursive, serif";

// width estimate per glyph class: full-width (CJK/kana/hangul) ~1em; Devanagari/
// Bengali ~0.6em; Latin ~0.42em — so line lengths are roughly right for layout.
const WIDE =
  /[ᄀ-ᇿ⺀-〿぀-ヿ㐀-䶿一-鿿ꥠ-꥿가-퟿豈-﫿＀-￯]/;
const MED = /[ऀ-ॿঀ-৿]/; // Devanagari + Bengali
function estWidth(text: string, size: number): number {
  let w = 0;
  for (const ch of text) w += (WIDE.test(ch) ? 1.0 : MED.test(ch) ? 0.6 : 0.42) * size;
  return w;
}

// Scripts that SHAPE together (conjuncts, vowel signs) must render whole; per-
// char tspans would break them. CJK/Hangul/Latin glyphs are independent.
const COMPLEX = /[ऀ-ॿঀ-৿]/;

/* ------------------------------ geometry ------------------------------- */
function fnv(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mkRand(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Anchor = "start" | "middle" | "end";

const LH = 1.25; // line-height multiple (row spacing within a wrapped block)

// AABB of a local rect rotated about (cx,cy)
function rotAABB(cx: number, cy: number, l: number, t: number, r: number, b: number, rot: number): Box {
  const th = (rot * Math.PI) / 180;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const corners: [number, number][] = [[l, t], [r, t], [r, b], [l, b]];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [px, py] of corners) {
    const dx = px - cx;
    const dy = py - cy;
    const rx = cx + dx * c - dy * s;
    const ry = cy + dx * s + dy * c;
    if (rx < x0) x0 = rx;
    if (rx > x1) x1 = rx;
    if (ry < y0) y0 = ry;
    if (ry > y1) y1 = ry;
  }
  return { x0, y0, x1, y1 };
}

// the AABB a block of `nRows` rows (max width `w`) occupies after rotation about
// its anchor (x,y) — rows stack downward in the unrotated frame.
function blockBox(x: number, y: number, size: number, rot: number, anchor: Anchor, w: number, nRows: number): Box {
  const left = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
  return rotAABB(x, y, left, y - size * 0.78, left + w, y + (nRows - 1) * size * LH + size * 0.28, rot);
}

// greedy word-wrap (char-wrap for space-less scripts) so a line that won't fit
// its gap cleanly breaks into rows instead of being squished by textLength.
function wrapRows(text: string, size: number, maxLen: number): string[] {
  const max = Math.max(80, maxLen);
  if (estWidth(text, size) <= max) return [text];
  const hasSpace = /\s/.test(text);
  const units = hasSpace ? text.split(/(\s+)/) : Array.from(text);
  const rows: string[] = [];
  let cur = "";
  for (const u of units) {
    if (!cur) {
      cur = u;
    } else if (estWidth((cur + u).trim(), size) > max) {
      rows.push(cur.trim());
      cur = hasSpace ? u.replace(/^\s+/, "") : u;
    } else {
      cur += u;
    }
  }
  if (cur.trim()) rows.push(cur.trim());
  return rows.length ? rows : [text];
}
const maxRowWidth = (rows: string[], size: number) =>
  rows.reduce((m, r) => Math.max(m, estWidth(r, size)), 0);

// fraction of a box that overlaps the obstacles (0 = clear)
function overlapFrac(b: Box, obstacles: Box[]): number {
  const area = Math.max(1, (b.x1 - b.x0) * (b.y1 - b.y0));
  let covered = 0;
  for (const o of obstacles) {
    const ix = Math.min(b.x1, o.x1) - Math.max(b.x0, o.x0);
    const iy = Math.min(b.y1, o.y1) - Math.max(b.y0, o.y0);
    if (ix > 0 && iy > 0) covered += ix * iy;
  }
  return covered / area;
}

// fraction of a box that falls outside the VISIBLE band (0 = fully on-screen).
// `vis` is the on-screen slice of the view-box — on portrait the sides are
// cropped, so this gate keeps lines inside the band the visitor can actually see.
function offCanvasFrac(b: Box, vis: Box): number {
  const area = Math.max(1, (b.x1 - b.x0) * (b.y1 - b.y0));
  const ix = Math.min(b.x1, vis.x1) - Math.max(b.x0, vis.x0);
  const iy = Math.min(b.y1, vis.y1) - Math.max(b.y0, vis.y0);
  const inside = ix > 0 && iy > 0 ? ix * iy : 0;
  return 1 - inside / area;
}

// near-slab entry distance of a ray vs a box — null if it misses (0 = inside)
function rayBoxEntry(px: number, py: number, dx: number, dy: number, o: Box): number | null {
  let tmin = -Infinity;
  let tmax = Infinity;
  if (Math.abs(dx) < 1e-9) {
    if (px < o.x0 || px > o.x1) return null;
  } else {
    let t1 = (o.x0 - px) / dx;
    let t2 = (o.x1 - px) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
  }
  if (Math.abs(dy) < 1e-9) {
    if (py < o.y0 || py > o.y1) return null;
  } else {
    let t1 = (o.y0 - py) / dy;
    let t2 = (o.y1 - py) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
  }
  if (tmax < tmin || tmax < 0) return null;
  return tmin > 0 ? tmin : 0;
}

// free run of space from (px,py) along a unit dir before hitting obstacle/edge.
// edges are the VISIBLE band, not the full view-box, so columns flow within view.
function rayDist(px: number, py: number, dx: number, dy: number, obstacles: Box[], vis: Box): number {
  let best = Infinity;
  if (dx > 0) best = Math.min(best, (vis.x1 - px) / dx);
  else if (dx < 0) best = Math.min(best, (vis.x0 - px) / dx);
  if (dy > 0) best = Math.min(best, (vis.y1 - py) / dy);
  else if (dy < 0) best = Math.min(best, (vis.y0 - py) / dy);
  for (const o of obstacles) {
    const t = rayBoxEntry(px, py, dx, dy, o);
    if (t !== null && t < best) best = t;
  }
  return Math.max(0, best);
}

// a seeded orientation: mostly gentle tilt, some strong diagonal, often vertical
function pickRot(rand: () => number): number {
  const sign = rand() < 0.5 ? -1 : 1;
  const o = rand();
  return o < 0.26
    ? sign * (74 + rand() * 16) // ~74–90°, near-vertical
    : o < 0.55
      ? sign * (16 + rand() * 28) // 16–44°, strong diagonal
      : sign * rand() * 12; // 0–12°, gentle tilt
}

/* ------------------------- per-character jitter ------------------------ */
interface Glyph {
  ch: string;
  size: number;
  dy: number; // baseline shift relative to the previous glyph (wobble)
  rot: number; // per-glyph tilt, degrees
}
function makeGlyphs(seed: number, size: number, text: string): Glyph[] {
  const rand = mkRand(seed);
  let prevDy = 0;
  return Array.from(text).map((ch) => {
    const absDy = (rand() * 2 - 1) * size * 0.055;
    const dy = absDy - prevDy;
    prevDy = absDy;
    return { ch, size: size * (0.88 + rand() * 0.24), dy, rot: (rand() * 2 - 1) * 2.6 };
  });
}

/* ------------------------------ the pen -------------------------------- */
// one wrapped row of a line: its text, optional per-char jitter, and a write-in
// duration + delay (so rows of a wrapped block cascade in).
interface Row {
  text: string;
  glyphs: Glyph[] | null;
  dur: number;
  delay: number;
}
interface Inscription {
  key: number;
  x: number; // anchor of the FIRST row
  y: number;
  rot: number;
  size: number;
  anchor: Anchor;
  lineHeight: number; // row spacing
  rows: Row[]; // 1 row normally; several when the line is wrapped
}
interface Column {
  x: number; // anchor of the NEXT line
  y: number;
  rot: number;
  size: number;
  anchor: Anchor;
  advX: number; // unit advance toward the next line
  advY: number;
  gap: number; // distance between rows
  maxLen: number; // baseline length available — wrap target
  left: number; // lines still allowed in this column
}

// turn wrapped row texts into renderable rows with per-char jitter and staggered
// write-in timing (rows of a wrapped block cascade in one after another).
function buildRows(seed: number, size: number, texts: string[]): Row[] {
  let delay = 0;
  return texts.map((t, i) => {
    const glyphs = COMPLEX.test(t) ? null : makeGlyphs(seed + i * 7919, size, t);
    const dur = clamp(t.length * 0.04, 0.4, 1.8);
    const row: Row = { text: t, glyphs, dur, delay };
    delay += dur * 0.55; // next row starts before this one finishes
    return row;
  });
}

// the rotated AABB an inscription occupies (for obstacle tests)
function inscBox(insc: Inscription): Box {
  const w = maxRowWidth(insc.rows.map((r) => r.text), insc.size);
  return blockBox(insc.x, insc.y, insc.size, insc.rot, insc.anchor, w, insc.rows.length);
}

// Eye a blank spot: drop a pen at (px,py) and feel the free run along the chosen
// orientation (both ways) and across it, then size a line to fill that gap, and
// pick the more open perpendicular side to stack future lines toward.
function evalSeed(
  px: number,
  py: number,
  rot: number,
  text: string,
  obstacles: Box[],
  vis: Box,
  rand: () => number
): { col: Column; clear: boolean; aesthetic: number; badness: number } {
  const th = (rot * Math.PI) / 180;
  const bx = Math.cos(th);
  const by = Math.sin(th);
  const fwd = rayDist(px, py, bx, by, obstacles, vis);
  const bwd = rayDist(px, py, -bx, -by, obstacles, vis);
  const up = rayDist(px, py, Math.sin(th), -Math.cos(th), obstacles, vis);
  const down = rayDist(px, py, -Math.sin(th), Math.cos(th), obstacles, vis);

  const lo = Math.min(fwd, bwd);
  const hi = Math.max(fwd, bwd);
  let anchor: Anchor;
  let lenBudget: number;
  if (lo > hi * 0.45) {
    anchor = "middle";
    lenBudget = lo * 2;
  } else {
    anchor = fwd >= bwd ? "start" : "end";
    lenBudget = hi;
  }

  // stack rows / future lines toward whichever perpendicular side is more open
  const runA = rayDist(px, py, -by, bx, obstacles, vis);
  const runB = rayDist(px, py, by, -bx, obstacles, vis);
  const towardA = runA >= runB;
  const advX = towardA ? -by : by;
  const advY = towardA ? bx : -bx;
  const advRun = Math.max(runA, runB);

  const unit = estWidth(text, 1) || 1;
  // single-line fit: shrink to span the gap length (and within its thickness)
  let size = clamp(Math.min(lenBudget / unit, Math.min(up / 0.82, down / 0.4)), MIN_SIZE, MAX_SIZE);
  let rows = [text];
  // WRAP only when the line genuinely can't fit one row even at the smallest size
  // — otherwise a thin single line still slots into tight gaps, so wrapping (which
  // makes a bigger block that fits fewer clear spots) is reserved for truly long
  // lines. When we do wrap, grow the size only as far as the gap actually allows.
  if (estWidth(text, MIN_SIZE) > lenBudget) {
    let bestS = MIN_SIZE;
    let bestRows = wrapRows(text, MIN_SIZE, lenBudget);
    for (let s = MIN_SIZE + 6; s <= MAX_SIZE; s += 6) {
      const r = wrapRows(text, s, lenBudget);
      // bigger size ⇒ taller block; stop at the first that no longer fits the run
      if (r.length * s * LH > advRun || maxRowWidth(r, s) > lenBudget) break;
      bestS = s;
      bestRows = r;
    }
    size = bestS;
    rows = bestRows;
  }

  const gap = size * LH;
  const w = maxRowWidth(rows, size);
  const box = blockBox(px, py, size, rot, anchor, w, rows.length);
  const ov = overlapFrac(box, obstacles);
  const off = offCanvasFrac(box, vis);
  const fill = clamp(w / Math.max(1, lenBudget), 0, 1);
  const sizeNorm = (size - MIN_SIZE) / (MAX_SIZE - MIN_SIZE);
  const flowRoom = clamp(advRun / (gap * (rows.length + 2)), 0, 1);

  // A seed is "clear" if it genuinely misses the page content. Among clear seeds
  // we then optimise aesthetics; only if NONE are clear do we fall back to the
  // least-bad one. This hard gate is what keeps lines off the page's text.
  const clear = ov < 0.02 && off < 0.04;
  const aesthetic = Math.max(fill, sizeNorm) * 1.0 + flowRoom * 0.8 + rand() * 0.6;
  const badness = ov * 8 + off * 3;

  // quota of lines for this column. We deliberately DON'T cap by the thin-ray
  // advance estimate — that collapses to 1 on a busy page and kills flow. The
  // real terminator is the per-line clear-check while flowing (see place()).
  const left = 2 + Math.floor(rand() * 4); // 2..5
  return {
    col: { x: px, y: py, rot, size, anchor, advX, advY, gap, maxLen: lenBudget, left },
    clear,
    aesthetic,
    badness,
  };
}

// Begin a fresh column: sample many seeds across the page. Prefer the nicest spot
// that's genuinely CLEAR of content; fall back to the least-bad only if the page
// leaves nowhere clean.
function startColumn(rand: () => number, text: string, obstacles: Box[], vis: Box): Column {
  const vw = vis.x1 - vis.x0;
  const vh = vis.y1 - vis.y0;
  const seeds = [];
  for (let i = 0; i < 28; i++) {
    // sample WITHIN the on-screen band (inset from its edges) so seeds — and the
    // columns grown from them — sit where the visitor can see them on portrait.
    const px = vis.x0 + (0.05 + rand() * 0.9) * vw;
    const py = vis.y0 + (0.09 + rand() * 0.82) * vh;
    seeds.push(evalSeed(px, py, pickRot(rand), text, obstacles, vis, rand));
  }
  const clear = seeds.filter((s) => s.clear);
  if (clear.length) {
    let best = clear[0];
    for (const s of clear) if (s.aesthetic > best.aesthetic) best = s;
    return best.col;
  }
  let best = seeds[0];
  for (const s of seeds) if (s.badness < best.badness) best = s;
  return best.col;
}

// assemble an inscription at a column's current slot: wrap to the column width,
// build the rows, and return the new pen state advanced past the whole block.
function layoutAt(col: Column, size: number, gseed: number, text: string): { insc: Inscription; col: Column } {
  const texts = wrapRows(text, size, col.maxLen);
  const lineHeight = size * LH;
  const insc: Inscription = {
    key: 0,
    x: col.x,
    y: col.y,
    rot: col.rot,
    size,
    anchor: col.anchor,
    lineHeight,
    rows: buildRows(gseed, size, texts),
  };
  // advance past the whole block (so the next line clears a wrapped one)
  const span = texts.length * lineHeight;
  const advanced: Column = {
    ...col,
    x: col.x + col.advX * span,
    y: col.y + col.advY * span,
    left: col.left - 1,
  };
  return { insc, col: advanced };
}

// Place one line: continue the current column if its (possibly wrapped) block
// stays clear, else lift the pen and start a fresh column.
function place(
  prevCol: Column | null,
  seedNum: number,
  text: string,
  obstacles: Box[],
  vis: Box
): { insc: Inscription; col: Column } {
  const rand = mkRand(seedNum);
  const gseed = (seedNum ^ 0x9e3779b9) >>> 0;
  if (prevCol && prevCol.left > 0) {
    const size = clamp(prevCol.size * (0.94 + rand() * 0.12), MIN_SIZE, MAX_SIZE); // gentle drift
    const texts = wrapRows(text, size, prevCol.maxLen);
    const box = blockBox(
      prevCol.x, prevCol.y, size, prevCol.rot, prevCol.anchor,
      maxRowWidth(texts, size), texts.length
    );
    // continue only while the block stays essentially clear of content; a tiny
    // sliver is tolerated for the conservative AABB, but more ends the column so
    // it relocates instead of creeping onto the page.
    if (overlapFrac(box, obstacles) < 0.05 && offCanvasFrac(box, vis) < 0.06) {
      return layoutAt({ ...prevCol, size }, size, gseed, text);
    }
  }
  const col = startColumn(rand, text, obstacles, vis);
  return layoutAt(col, col.size, gseed, text);
}

// squeeze a single ROW so its rotated box fits the canvas in BOTH dimensions
// (a fallback for a word too long even to wrap; normal rows already fit).
function fitRow(text: string, size: number, rot: number) {
  const w = estWidth(text, size);
  const th = (rot * Math.PI) / 180;
  const ac = Math.abs(Math.cos(th));
  const as = Math.abs(Math.sin(th));
  const limW = ac > 1e-3 ? (W - 40 - size * as) / ac : Infinity;
  const limH = as > 1e-3 ? (H - 40 - size * ac) / as : Infinity;
  const lim = Math.max(120, Math.min(limW, limH));
  return w > lim
    ? { textLength: Math.round(lim), lengthAdjust: "spacingAndGlyphs" as const }
    : {};
}

/* ----------------------------- live playhead ---------------------------- */
function useActiveLine(track: SpotifyTrack | null, lines: LyricLine[]): number {
  const [idx, setIdx] = useState(-1);
  const playing = !!track?.isPlaying;
  const duration = track?.duration ?? 0;
  const progress = track?.progress ?? 0;
  const serverNow = track?.serverNow ?? 0;
  const fetchedAt = track?.fetchedAt ?? 0;
  const latency = track?.clientLatency ?? 0;

  useEffect(() => {
    if (!lines.length) {
      setIdx(-1);
      return;
    }
    const cacheAge = serverNow && fetchedAt ? serverNow - fetchedAt : 0;
    const baseMs = progress + cacheAge;
    const findIdx = (ms: number) => {
      if (lines[0].t > ms) return -1;
      let lo = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].t <= ms) lo = i;
        else break;
      }
      return lo;
    };

    if (!playing) {
      setIdx(findIdx(baseMs));
      return;
    }
    const lead = latency + LYRIC_LEAD_MS;
    const recv = performance.now();
    let raf = 0;
    const tick = () => {
      const ms = baseMs + lead + (performance.now() - recv);
      const next = findIdx(duration > 0 ? Math.min(ms, duration) : ms);
      setIdx((cur) => (cur === next ? cur : next));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lines, playing, duration, progress, serverNow, fetchedAt, latency]);

  return idx;
}

/* ------------------------------ component ------------------------------- */
export default function SongScapeLyrics({
  track,
  trackId,
  lines,
  ink,
  dark,
  reduced,
  doodleBoxes,
  vis,
}: {
  track: SpotifyTrack | null;
  trackId: string;
  lines: LyricLine[];
  ink: string; // solid ink rgb; age dimming via group opacity
  dark: boolean;
  reduced: boolean;
  doodleBoxes: Box[];
  vis: Box; // the on-screen slice of the view-box (lines stay inside it)
}) {
  const idx = useActiveLine(track, lines);
  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const inscriptionsRef = useRef<Inscription[]>([]);
  const colRef = useRef<Column | null>(null);
  const counter = useRef(0);
  const lastIdx = useRef(-1);

  // new song → clear the page and lift the pen
  useEffect(() => {
    inscriptionsRef.current = [];
    colRef.current = null;
    lastIdx.current = -1;
    setInscriptions([]);
  }, [trackId]);

  // playhead crossed into a new (non-empty) line → write it
  useEffect(() => {
    if (idx < 0) return;
    const text = lines[idx]?.text?.trim();
    if (!text) return;
    if (idx === lastIdx.current) return;
    lastIdx.current = idx;

    const list = inscriptionsRef.current;
    const obstacles = collectForeground().concat(doodleBoxes, list.map(inscBox));
    const { insc: base, col } = place(colRef.current, fnv(`${trackId}:${idx}`), text, obstacles, vis);
    colRef.current = col;

    const next = [...list, { ...base, key: counter.current++ }].slice(-MAX_VISIBLE);
    inscriptionsRef.current = next;
    setInscriptions(next);
  }, [idx, lines, trackId, doodleBoxes, vis]);

  if (!inscriptions.length) return null;

  // age 0 = freshest; older ghosts dim and float a touch higher
  const ageOpacity = dark ? [0.58, 0.32, 0.16] : [0.48, 0.26, 0.13];

  return (
    <g className="songscape-lyrics ink-sway" style={{ pointerEvents: "none" }}>
      <AnimatePresence>
        {inscriptions.map((insc, i) => {
          const age = inscriptions.length - 1 - i;
          return (
            <motion.g
              key={insc.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: ageOpacity[age] ?? 0.12, y: -age * 12 }}
              exit={{ opacity: 0, y: -44 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            >
              <g
                style={{
                  transform: `rotate(${insc.rot.toFixed(2)}deg)`,
                  transformBox: "view-box",
                  transformOrigin: `${insc.x.toFixed(1)}px ${insc.y.toFixed(1)}px`,
                }}
              >
                {insc.rows.map((row, ri) => (
                  <text
                    key={ri}
                    x={insc.x}
                    y={insc.y + ri * insc.lineHeight}
                    textAnchor={insc.anchor}
                    fill={ink}
                    fontSize={insc.size}
                    className={reduced ? undefined : "lyric-write"}
                    // font-family via style (CSS) so var() resolves — it does NOT
                    // substitute in the SVG presentation attribute.
                    style={{
                      fontFamily: LYRIC_FONT,
                      ...(reduced
                        ? {}
                        : {
                            "--lyric-dur": `${row.dur.toFixed(2)}s`,
                            "--lyric-delay": `${row.delay.toFixed(2)}s`,
                          }),
                    } as React.CSSProperties}
                    {...fitRow(row.text, insc.size, insc.rot)}
                  >
                    {row.glyphs
                      ? row.glyphs.map((g, gi) => (
                          <tspan key={gi} fontSize={g.size} dy={g.dy.toFixed(2)} rotate={g.rot.toFixed(1)}>
                            {g.ch}
                          </tspan>
                        ))
                      : row.text}
                  </text>
                ))}
              </g>
            </motion.g>
          );
        })}
      </AnimatePresence>
    </g>
  );
}
