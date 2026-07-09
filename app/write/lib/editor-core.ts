// Pure textarea editing helpers for the writing room.
//
// HARD RULE: every programmatic edit goes through insertText(), which uses
// document.execCommand("insertText") so the browser's NATIVE undo/redo stack
// survives. Rewriting textarea.value wholesale would wipe the owner's ⌘Z
// history — never do it for routine edits. (execCommand is deprecated-but-
// universal for this exact purpose; the fallback loses undo but never words.)

/** True when the platform's primary modifier (⌘ on mac, ctrl elsewhere) is down. */
export function isPlatformMod(e: { metaKey: boolean; ctrlKey: boolean }): boolean {
  const mac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  return mac ? e.metaKey : e.ctrlKey;
}

// React tracks the textarea's value via an instance property descriptor; a
// plain `ta.value = …` updates that tracker too, so the dispatched input event
// gets deduped and onChange never fires (the controlled component then reverts
// the edit on the next render). Writing through the PROTOTYPE setter bypasses
// the tracker, making the synthetic input event React-visible.
function setValueReactVisible(ta: HTMLTextAreaElement, next: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value"
  )?.set;
  if (setter) setter.call(ta, next);
  else ta.value = next;
}

export function insertText(ta: HTMLTextAreaElement, text: string) {
  ta.focus();
  let ok = false;
  // execCommand can't act on a hidden (display:none) textarea — focus() no-ops
  // there, so go straight to the fallback in that case (proof-mode uploads).
  if (document.activeElement === ta) {
    try {
      ok =
        text === ""
          ? document.execCommand("delete", false)
          : document.execCommand("insertText", false, text);
    } catch {
      ok = false;
    }
  }
  if (!ok) {
    const { selectionStart, selectionEnd, value } = ta;
    setValueReactVisible(
      ta,
      value.slice(0, selectionStart) + text + value.slice(selectionEnd)
    );
    const pos = selectionStart + text.length;
    ta.setSelectionRange(pos, pos);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

/** Replace a known token (e.g. an upload placeholder) without nuking undo. */
export function replaceToken(
  ta: HTMLTextAreaElement,
  token: string,
  replacement: string
): boolean {
  const idx = ta.value.indexOf(token);
  if (idx === -1) return false;
  const { selectionStart, selectionEnd } = ta;
  const prevActive = document.activeElement;
  const hadFocus = prevActive === ta;
  ta.setSelectionRange(idx, idx + token.length);
  insertText(ta, replacement);
  // put the caret back near where the writer was (or inside an empty alt,
  // so the next keystrokes become the handwritten caption — but only when
  // the pen was already on the sheet; never steal focus from elsewhere)
  const altSpot = hadFocus && replacement.startsWith("![](") ? idx + 2 : -1;
  if (altSpot >= 0) {
    ta.setSelectionRange(altSpot, altSpot);
  } else if (selectionStart > idx + token.length) {
    const delta = replacement.length - token.length;
    ta.setSelectionRange(selectionStart + delta, selectionEnd + delta);
  } else if (selectionStart <= idx) {
    ta.setSelectionRange(selectionStart, selectionEnd);
  }
  if (!hadFocus && prevActive instanceof HTMLElement) {
    prevActive.focus();
  }
  return true;
}

/** Wrap the selection in markdown marks; selects the inner text after. */
export function wrapSelection(
  ta: HTMLTextAreaElement,
  before: string,
  after: string = before,
  placeholder = ""
) {
  const { selectionStart: s, selectionEnd: e, value } = ta;
  const sel = value.slice(s, e) || placeholder;
  insertText(ta, before + sel + after);
  const innerStart = s + before.length;
  ta.setSelectionRange(innerStart, innerStart + sel.length);
}

const URL_RE = /^https?:\/\/\S+$/i;
export const isUrl = (text: string) => URL_RE.test(text.trim());
export const isSoundtrackUrl = (text: string) =>
  /(?:youtube\.com|youtu\.be|soundcloud\.com)\//i.test(text.trim());

export function insertLink(ta: HTMLTextAreaElement, clipboardUrl?: string) {
  const { selectionStart: s, selectionEnd: e, value } = ta;
  const sel = value.slice(s, e);
  const url = clipboardUrl && isUrl(clipboardUrl) ? clipboardUrl.trim() : "";
  if (sel && isUrl(sel)) {
    // the selection IS the url — give it a label slot instead
    insertText(ta, `[](${sel})`);
    ta.setSelectionRange(s + 1, s + 1);
    return;
  }
  insertText(ta, `[${sel || "link"}](${url})`);
  if (url) {
    const start = s + 1;
    ta.setSelectionRange(start, start + (sel || "link").length);
  } else {
    const parens = s + (sel || "link").length + 3;
    ta.setSelectionRange(parens, parens);
  }
}

// ---------------------------------------------------------------------------
// Enter: continue lists / quotes / checkboxes, close an opened code fence,
// and end a list when the item is empty (the marker un-writes itself).
// Returns true when it handled the key.
// ---------------------------------------------------------------------------
const LIST_RE = /^(\s*)((?:[-*+])\s+(?:\[[ xX]\]\s+)?|(\d+)([.)])\s+|>\s?)(.*)$/;

export function handleEnter(ta: HTMLTextAreaElement): boolean {
  const { value, selectionStart, selectionEnd } = ta;
  if (selectionStart !== selectionEnd) return false;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const line = value.slice(lineStart, selectionStart);
  const lineEndIdx = value.indexOf("\n", selectionStart);
  const afterCaret = value.slice(
    selectionStart,
    lineEndIdx === -1 ? value.length : lineEndIdx
  );
  const insideFence = fenceIsOpenAbove(value, lineStart);

  // opening a code fence: drop a closing fence in and park the pen between
  if (/^```[^`]*$/.test(line.trim()) && !insideFence) {
    if (!afterCaret.trim()) {
      insertText(ta, "\n\n```");
      const mid = selectionStart + 1;
      ta.setSelectionRange(mid, mid);
      return true;
    }
  }

  // inside a code block, "- " is code, not a list — leave Enter alone
  if (insideFence) return false;

  const m = line.match(LIST_RE);
  if (!m) return false;
  const [, indent, marker, num, numDelim, rest] = m;
  if (!rest.trim()) {
    // marker with text still after the caret = a line being split, not an
    // empty item — let the plain newline happen
    if (afterCaret.trim()) return false;
    // empty item — end the list by un-writing the marker
    ta.setSelectionRange(lineStart, selectionStart);
    insertText(ta, "");
    return true;
  }
  let next = marker;
  if (num) next = `${parseInt(num, 10) + 1}${numDelim} `;
  next = next.replace(/\[[xX]\]/, "[ ]");
  insertText(ta, `\n${indent}${next}`);
  return true;
}

/** True when the fences above lineStart leave us inside an open block. */
function fenceIsOpenAbove(value: string, lineStart: number): boolean {
  const above = value.slice(0, lineStart).split("\n");
  let open = false;
  for (const l of above) {
    if (/^```/.test(l.trim())) open = !open;
  }
  return open;
}

/**
 * True when `pos` sits inside code — a fenced block, or an odd number of
 * backticks earlier on the same line (inline code). Used to keep the smart
 * hands (footnote trigger, list continuation) off of code.
 */
export function isInsideCode(value: string, pos: number): boolean {
  const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
  if (fenceIsOpenAbove(value, lineStart)) return true;
  const before = value.slice(lineStart, pos);
  const ticks = (before.match(/`/g) || []).length;
  return ticks % 2 === 1;
}

/** Tab / shift-tab indents list items (single line only — keep it honest). */
export function handleTab(ta: HTMLTextAreaElement, outdent: boolean): boolean {
  const { value, selectionStart, selectionEnd } = ta;
  if (selectionStart !== selectionEnd) return false;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEnd0 = value.indexOf("\n", selectionStart);
  const lineEnd = lineEnd0 === -1 ? value.length : lineEnd0;
  const line = value.slice(lineStart, lineEnd);
  if (!LIST_RE.test(line)) return false;

  if (outdent) {
    const m = line.match(/^( {1,2})/);
    if (!m) return true; // already at the margin
    ta.setSelectionRange(lineStart, lineStart + m[1].length);
    insertText(ta, "");
    ta.setSelectionRange(
      Math.max(lineStart, selectionStart - m[1].length),
      Math.max(lineStart, selectionStart - m[1].length)
    );
  } else {
    ta.setSelectionRange(lineStart, lineStart);
    insertText(ta, "  ");
    ta.setSelectionRange(selectionStart + 2, selectionStart + 2);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Footnotes: typing "[^" auto-numbers the reference and drops the matching
// definition stub at the foot of the entry, then returns the pen.
// ---------------------------------------------------------------------------
export function insertFootnote(ta: HTMLTextAreaElement) {
  const { value, selectionStart } = ta;
  const used = Array.from(value.matchAll(/\[\^(\d+)\]/g)).map((m) =>
    parseInt(m[1], 10)
  );
  const n = used.length ? Math.max(...used) + 1 : 1;
  insertText(ta, `[^${n}]`);
  const back = selectionStart + `[^${n}]`.length;
  // stub at the very bottom
  const end = ta.value.length;
  ta.setSelectionRange(end, end);
  const sep = ta.value.endsWith("\n\n") ? "" : ta.value.endsWith("\n") ? "\n" : "\n\n";
  insertText(ta, `${sep}[^${n}]: `);
  ta.setSelectionRange(back, back);
}

// ---------------------------------------------------------------------------
// Outline: source headings (#, ##, ### — the same depths the reader's TOC
// shows), skipping code fences. `index` is the char offset of the line start.
// ---------------------------------------------------------------------------
export type OutlineEntry = {
  depth: number;
  text: string;
  index: number;
  caret: number; // where the pen should land (after the marks)
};

export function parseOutline(content: string): OutlineEntry[] {
  const lines = content.split("\n");
  const out: OutlineEntry[] = [];
  let inFence = false;
  let offset = 0;
  for (const l of lines) {
    if (/^```/.test(l.trim())) {
      inFence = !inFence;
    } else if (!inFence) {
      const m = l.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/);
      if (m) {
        out.push({
          depth: m[1].length,
          text: m[2],
          index: offset,
          caret: offset + m[1].length + 1,
        });
      }
    }
    offset += l.length + 1;
  }
  return out;
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Figures: embedded post-widgets live in the source as a single custom tag on
// its own line — <noise-frontier></noise-frontier>. The writing room treats
// those lines as first-class objects: it dresses them as inked plates, lists
// them in the outline, and inserts them cleanly. These helpers stay pure (they
// take the set of known tags, never the component catalog).
// ---------------------------------------------------------------------------

/** The char range [start,end) of the line that `index` sits on. */
export function lineBoundsAt(
  value: string,
  index: number
): { start: number; end: number } {
  const start = value.lastIndexOf("\n", index - 1) + 1;
  const nl = value.indexOf("\n", index);
  return { start, end: nl === -1 ? value.length : nl };
}

/**
 * If `line` is nothing but a single known figure tag — `<tag></tag>`, `<tag/>`,
 * or a bare `<tag>` — return the tag name, else null. Attributes disqualify it
 * (the figures take none), which keeps ordinary HTML/JSX in a post untouched.
 */
export function matchFigureTag(line: string, tags: Set<string>): string | null {
  const t = line.trim();
  const m =
    /^<([a-z][a-z0-9-]*)\s*>\s*<\/\1\s*>$/i.exec(t) || // <tag></tag>
    /^<([a-z][a-z0-9-]*)\s*\/>$/i.exec(t) || //           <tag/>
    /^<([a-z][a-z0-9-]*)\s*>$/i.exec(t); //               <tag>
  if (!m) return null;
  const tag = m[1].toLowerCase();
  return tags.has(tag) ? tag : null;
}

export type FigureEntry = {
  tag: string;
  /** char offset of the figure line's start (for sort + jump) */
  index: number;
  /** where the pen should land (line start) */
  caret: number;
};

/** Every standalone figure line in `content`, in document order (skips fences). */
export function parseFigures(
  content: string,
  tags: Set<string>
): FigureEntry[] {
  if (tags.size === 0) return [];
  const lines = content.split("\n");
  const out: FigureEntry[] = [];
  let inFence = false;
  let offset = 0;
  for (const l of lines) {
    if (/^```/.test(l.trim())) {
      inFence = !inFence;
    } else if (!inFence) {
      const tag = matchFigureTag(l, tags);
      if (tag) out.push({ tag, index: offset, caret: offset });
    }
    offset += l.length + 1;
  }
  return out;
}

/**
 * Drop a figure onto its own line at the caret, with a blank line above and
 * below — without stacking blanks against text that's already spaced. Goes
 * through insertText so the owner's undo stack survives.
 */
export function insertFigure(ta: HTMLTextAreaElement, tag: string) {
  ta.focus();
  const { selectionStart: s, selectionEnd: e, value } = ta;
  const before = value.slice(0, s);
  const after = value.slice(e);
  const block = `<${tag}></${tag}>`;
  const leadNL = /\n*$/.exec(before)?.[0].length ?? 0;
  const trailNL = /^\n*/.exec(after)?.[0].length ?? 0;
  const lead = before === "" ? "" : "\n".repeat(Math.max(0, 2 - leadNL));
  const trail = after === "" ? "" : "\n".repeat(Math.max(0, 2 - trailNL));
  insertText(ta, `${lead}${block}${trail}`);
  const caret = s + lead.length + block.length;
  ta.setSelectionRange(caret, caret);
}
