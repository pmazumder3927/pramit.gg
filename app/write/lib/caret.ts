// Caret comfort: never write in the gutter. A hidden mirror of the textarea
// measures where the caret actually is in pixels; when it sinks below ~70% of
// the visible viewport (keyboard-aware on mobile), the page scrolls so the pen
// rides at ~45%. Measurement only — the textarea itself is untouched.

let mirror: HTMLDivElement | null = null;

const MIRROR_PROPS = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "textTransform",
  "textIndent",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderLeftWidth",
  "borderRightWidth",
  "boxSizing",
] as const;

/** y-offset (px) of the caret's line within the textarea's content box. */
export function caretTopWithin(ta: HTMLTextAreaElement): number {
  if (typeof document === "undefined") return 0;
  if (!mirror) {
    mirror = document.createElement("div");
    mirror.setAttribute("aria-hidden", "true");
    mirror.style.position = "absolute";
    mirror.style.visibility = "hidden";
    mirror.style.left = "-99999px";
    mirror.style.top = "0";
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.wordBreak = "break-word";
    mirror.style.overflowWrap = "break-word";
    document.body.appendChild(mirror);
  }
  const cs = window.getComputedStyle(ta);
  for (const p of MIRROR_PROPS) {
    mirror.style[p as "fontSize"] = cs[p as "fontSize"];
  }
  mirror.style.width = `${ta.clientWidth}px`;
  mirror.textContent = ta.value.slice(0, ta.selectionEnd ?? ta.value.length);
  const marker = document.createElement("span");
  marker.textContent = "​";
  mirror.appendChild(marker);
  return marker.offsetTop;
}

/** Visible viewport height — the keyboard steals from this on mobile. */
export function visibleViewportHeight(): number {
  if (typeof window === "undefined") return 0;
  return window.visualViewport?.height ?? window.innerHeight;
}

export function keepCaretComfortable(ta: HTMLTextAreaElement) {
  const vh = visibleViewportHeight();
  if (!vh) return;
  const lineHeight = parseFloat(window.getComputedStyle(ta).lineHeight) || 28;
  const caretY =
    ta.getBoundingClientRect().top + caretTopWithin(ta) + lineHeight;
  const offsetTop = window.visualViewport?.offsetTop ?? 0;
  const lowWater = offsetTop + vh * 0.7;
  const highWater = offsetTop + Math.max(72, vh * 0.18);
  if (caretY > lowWater) {
    window.scrollBy({ top: caretY - (offsetTop + vh * 0.45) });
  } else if (caretY < highWater) {
    window.scrollBy({ top: caretY - (offsetTop + vh * 0.3) });
  }
}

/** Pixel inset the on-screen keyboard takes from the layout viewport. */
export function keyboardInset(): number {
  if (typeof window === "undefined" || !window.visualViewport) return 0;
  const vv = window.visualViewport;
  return Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
}
