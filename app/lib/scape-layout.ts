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

// Measure the visible foreground content and map its screen rects into view-box
// space, so the backdrop can steer clear of it. We walk TEXT NODES (not elements)
// and measure each visible run with a Range — this captures text precisely no
// matter how it's nested, including mixed-content like <h1>pramit mazumder<span>.
// </span></h1> whose name lives in a bare text node an element scan would miss.
// Plus interactive/media (buttons, links, inputs, images) which may be icon-only.
// Backdrop content (aria-hidden) and opted-out chrome ([data-lyrics-ignore], e.g.
// the post TOC) are skipped; [data-avoid-lyrics] force-includes anything missed.
export function collectForeground(pad = 18): Box[] {
  if (typeof window === "undefined") return [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!vw || !vh) return [];
  const scale = Math.max(vw / VB_W, vh / VB_H); // slice = cover
  const offX = (vw - VB_W * scale) / 2;
  const offY = (vh - VB_H * scale) / 2;

  const boxes: Box[] = [];
  const push = (r: DOMRect) => {
    if (r.width < 6 || r.height < 6) return;
    if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) return; // offscreen
    boxes.push({
      x0: (r.left - offX) / scale - pad,
      y0: (r.top - offY) / scale - pad,
      x1: (r.right - offX) / scale + pad,
      y1: (r.bottom - offY) / scale + pad,
    });
  };
  const hidden = (el: Element | null): boolean => {
    if (!el) return true;
    if (el.closest('[aria-hidden="true"]')) return true; // the backdrop itself
    if (el.closest("[data-lyrics-ignore]")) return true; // e.g. the post TOC
    const cs = getComputedStyle(el);
    return cs.visibility === "hidden" || cs.opacity === "0";
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
