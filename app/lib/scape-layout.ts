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
// space, so the backdrop can steer clear of it. Rather than a brittle tag list,
// we capture every element that DIRECTLY holds visible text (a "text leaf" — no
// element children of its own, so we get the innermost <span>/<h3>/<p>/… and not
// their big wrappers), plus interactive/media (buttons, links, inputs, images)
// which may be icon-only. Backdrop elements (aria-hidden) and opted-out chrome
// ([data-lyrics-ignore], e.g. the post TOC) are skipped; [data-avoid-lyrics]
// force-includes anything otherwise missed.
export function collectForeground(pad = 18): Box[] {
  if (typeof window === "undefined") return [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!vw || !vh) return [];
  const scale = Math.max(vw / VB_W, vh / VB_H); // slice = cover
  const offX = (vw - VB_W * scale) / 2;
  const offY = (vh - VB_H * scale) / 2;

  const boxes: Box[] = [];
  const seen = new Set<Element>();
  const add = (el: Element) => {
    if (seen.has(el)) return;
    if (el.closest('[aria-hidden="true"]')) return;
    if (el.closest("[data-lyrics-ignore]")) return;
    const r = el.getBoundingClientRect();
    if (r.width < 6 || r.height < 6) return;
    if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) return; // offscreen
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.opacity === "0") return;
    seen.add(el);
    boxes.push({
      x0: (r.left - offX) / scale - pad,
      y0: (r.top - offY) / scale - pad,
      x1: (r.right - offX) / scale + pad,
      y1: (r.bottom - offY) / scale + pad,
    });
  };

  // text leaves: innermost elements that directly hold visible text (any tag)
  document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
    if (el.childElementCount === 0 && (el.textContent ?? "").trim().length > 0) add(el);
  });
  // interactive / media — may have children or carry no text at all
  document
    .querySelectorAll<HTMLElement>("button,a[href],input,textarea,select,img,[data-avoid-lyrics]")
    .forEach(add);
  return boxes;
}
