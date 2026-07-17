// Shared layout helpers for the SongScape backdrop — the page's foreground
// content that both the doodles and the lyrics write AROUND. Everything is in the
// SVG view-box space (1600×900); the backdrop SVG is drawn full-viewport with
// preserveAspectRatio="xMidYMid slice" (cover), and we invert that mapping here.

export const VB_W = 1600;
export const VB_H = 900;

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

// The slice of the 1600×900 view-box that's actually ON-SCREEN, inverting the
// "slice" (cover) mapping. On a ~16:9 desktop this is essentially the whole box;
// on a portrait phone the sides are cropped, so this is a tall CENTER BAND. The
// art is authored full-width, so placement (doodles + lyrics) must stay inside
// this rect — otherwise content lands in the cropped sides and the backdrop
// looks blank with lyrics that "never appear".
export function visibleBox(): Box {
  const full: Box = { x0: 0, y0: 0, x1: VB_W, y1: VB_H };
  if (typeof window === "undefined") return full;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!vw || !vh) return full;
  const scale = Math.max(vw / VB_W, vh / VB_H); // slice = cover
  const offX = (vw - VB_W * scale) / 2;
  const offY = (vh - VB_H * scale) / 2;
  return {
    x0: -offX / scale,
    y0: -offY / scale,
    x1: (vw - offX) / scale,
    y1: (vh - offY) / scale,
  };
}

// Measure the visible foreground content in raw viewport CSS px. We walk TEXT
// NODES (not elements) and measure each visible run with a Range — this
// captures text precisely no matter how it's nested, including mixed-content
// like <h1>pramit mazumder<span>.</span></h1> whose name lives in a bare text
// node an element scan would miss. Plus interactive/media (buttons, links,
// inputs, images) which may be icon-only. Backdrop content (aria-hidden) is
// always skipped; [data-avoid-lyrics] force-includes anything missed.
//
// [data-lyrics-ignore] (e.g. the post TOC) is an opt-out from LYRIC avoidance
// specifically — the lyric pen may write across it. Consumers that must avoid
// ALL readable text (the canvas repaint: CoverReveal paints AROUND these
// rects) pass includeLyricOptOuts to measure that chrome too;
// collectForeground below maps the lyric/doodle view (opt-outs skipped) into
// the backdrop SVG's view-box space.
export function collectForegroundRects(includeLyricOptOuts = false): Box[] {
  if (typeof window === "undefined") return [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!vw || !vh) return [];

  const boxes: Box[] = [];
  const push = (r: DOMRect) => {
    if (r.width < 6 || r.height < 6) return;
    if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) return; // offscreen
    boxes.push({ x0: r.left, y0: r.top, x1: r.right, y1: r.bottom });
  };
  const hidden = (el: Element | null): boolean => {
    if (!el) return true;
    if (el.closest('[aria-hidden="true"]')) return true; // the backdrop itself
    if (!includeLyricOptOuts && el.closest("[data-lyrics-ignore]")) return true; // e.g. the post TOC
    // NB: don't treat opacity:0 as hidden — content commonly fades IN from 0, and
    // measuring during that animation would let the backdrop land on it.
    return getComputedStyle(el).visibility === "hidden";
  };

  // every visible run of text, measured exactly via a Range
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!node.nodeValue || !node.nodeValue.trim()) continue;
    if (hidden(node.parentElement)) continue;
    range.selectNodeContents(node);
    push(range.getBoundingClientRect());
  }
  // interactive / media — may carry no text at all (icon buttons, images)
  document
    .querySelectorAll<HTMLElement>("button,a[href],input,textarea,select,img,[data-avoid-lyrics]")
    .forEach((el) => {
      if (!hidden(el)) push(el.getBoundingClientRect());
    });
  return boxes;
}

// The same foreground, mapped into the 1600×900 view-box space (inverting the
// slice mapping) and padded — the space the doodles and lyrics lay out in.
export function collectForeground(pad = 18): Box[] {
  if (typeof window === "undefined") return [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!vw || !vh) return [];
  const scale = Math.max(vw / VB_W, vh / VB_H); // slice = cover
  const offX = (vw - VB_W * scale) / 2;
  const offY = (vh - VB_H * scale) / 2;
  return collectForegroundRects().map((r) => ({
    x0: (r.x0 - offX) / scale - pad,
    y0: (r.y0 - offY) / scale - pad,
    x1: (r.x1 - offX) / scale + pad,
    y1: (r.y1 - offY) / scale + pad,
  }));
}
