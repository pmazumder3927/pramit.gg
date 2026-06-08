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

// Measure the visible foreground text/controls and map their screen rects into
// view-box space, so the backdrop can steer clear of them. Backdrop elements
// (aria-hidden) and opted-out chrome ([data-lyrics-ignore], e.g. the post TOC)
// are skipped; [data-avoid-lyrics] force-includes anything the selector misses.
export function collectForeground(pad = 18): Box[] {
  if (typeof window === "undefined") return [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!vw || !vh) return [];
  const scale = Math.max(vw / VB_W, vh / VB_H); // slice = cover
  const offX = (vw - VB_W * scale) / 2;
  const offY = (vh - VB_H * scale) / 2;
  const boxes: Box[] = [];
  const els = document.querySelectorAll<HTMLElement>(
    "h1,h2,h3,h4,h5,p,li,blockquote,figure,nav,header,button,a[href],input,textarea,img,[data-avoid-lyrics]"
  );
  els.forEach((el) => {
    if (el.closest('[aria-hidden="true"]')) return;
    if (el.closest("[data-lyrics-ignore]")) return;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;
    if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) return; // offscreen
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.opacity === "0") return;
    boxes.push({
      x0: (r.left - offX) / scale - pad,
      y0: (r.top - offY) / scale - pad,
      x1: (r.right - offX) / scale + pad,
      y1: (r.bottom - offY) / scale + pad,
    });
  });
  return boxes;
}
