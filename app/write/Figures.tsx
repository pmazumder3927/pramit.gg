"use client";

// Figures, made first-class in the writing room.
//
// A figure is an embedded post-widget: one custom tag on its own line, e.g.
// <noise-frontier></noise-frontier>. Two faces here:
//
//   PlateOverlay — a metric-mirror of the body textarea (same trick the ghost
//   uses) that dresses every standalone figure line as an inked plate, so a
//   raw tag reads as the object it is instead of markup noise. The line the pen
//   is resting on stays raw, so it's always directly editable.
//
//   PlatePicker — "the press": browse the catalog (grouped interactive /
//   diagram), watch a live preview, and press one onto the page at the caret.

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { HandNote, Stamp, Tape } from "@/app/components/sketchbook";
import {
  postWidgetByTag,
  postWidgetCatalog,
  postWidgetTags,
  type FigureDef,
} from "@/app/components/post-widgets";
import { matchFigureTag } from "./lib/editor-core";

const TAG_SET = new Set(postWidgetTags);

// ---------------------------------------------------------------------------
// the plate (the dressed figure line)
// ---------------------------------------------------------------------------

function Glyph({ interactive }: { interactive: boolean }) {
  // a tiny drawn diamond — filled for a live widget, hollow for a static fig
  return (
    <svg
      viewBox="0 0 12 12"
      className="h-[0.7em] w-[0.7em] shrink-0 text-accent-purple"
      aria-hidden
    >
      <path
        d="M6 1 L11 6 L6 11 L1 6 Z"
        fill={interactive ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Plate({ raw, def }: { raw: string; def: FigureDef | undefined }) {
  const interactive = def?.kind === "interactive";
  const label = def?.label ?? raw.replace(/[<>/]/g, "").trim();
  return (
    <span className="relative inline-block min-w-[13rem] rounded-[3px] bg-card align-baseline ring-1 ring-inset ring-accent-purple/35">
      {/* sizer: the raw tag itself, invisible — so the plate covers at least the
          span the markup occupies and nothing shifts on the lines around it
          (min-width only ever widens it, so coverage is guaranteed) */}
      <span className="select-none opacity-0">{raw}</span>
      <span className="absolute inset-0 flex items-center gap-1.5 overflow-hidden whitespace-nowrap pl-1.5 pr-2">
        <Glyph interactive={interactive} />
        <span className="min-w-0 truncate font-hand leading-none text-ink-soft [font-size:0.85em]">
          {label}
        </span>
        <span className="ml-auto shrink-0 font-mono uppercase leading-none tracking-[0.14em] text-ink-faint [font-size:0.5em]">
          {interactive ? "live" : "fig"}
        </span>
      </span>
    </span>
  );
}

/**
 * The mirror. Renders the body's exact text metrics with figure lines dressed
 * as plates; the reveal line (where the pen rests) is left raw. Everything else
 * is invisible so the textarea's own text shows through untouched.
 */
export function PlateOverlay({
  content,
  revealLineStart,
}: {
  content: string;
  /** char offset of the caret line to leave raw, or -1 to dress them all */
  revealLineStart: number;
}) {
  const lines = useMemo(() => {
    const raw = content.split("\n");
    const out: { text: string; tag: string | null; offset: number }[] = [];
    let inFence = false;
    let offset = 0;
    for (const l of raw) {
      let tag: string | null = null;
      if (/^```/.test(l.trim())) inFence = !inFence;
      else if (!inFence) tag = matchFigureTag(l, TAG_SET);
      out.push({ text: l, tag, offset });
      offset += l.length + 1;
    }
    return out;
  }, [content]);

  const anyPlate = lines.some(
    (li) => li.tag && li.offset !== revealLineStart
  );
  if (!anyPlate) return null;

  return (
    <div
      aria-hidden
      data-plate-overlay
      className="pointer-events-none absolute left-0 top-0 w-full whitespace-pre-wrap break-words font-serif text-base leading-[1.75] tracking-[0.01em] md:text-lg md:leading-[1.8]"
    >
      {lines.map((li, i) => {
        const nl = i > 0 ? "\n" : "";
        const dressed = li.tag && li.offset !== revealLineStart;
        if (!dressed) {
          return (
            <span key={i} className="invisible">
              {nl}
              {li.text}
            </span>
          );
        }
        return (
          <span key={i}>
            {nl}
            <Plate raw={li.text} def={postWidgetByTag[li.tag!]} />
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// the press (the picker)
// ---------------------------------------------------------------------------

const GROUPS: { kind: FigureDef["kind"]; heading: string; note: string }[] = [
  { kind: "interactive", heading: "playable", note: "the reader touches it" },
  { kind: "diagram", heading: "figures", note: "static, theme-aware" },
];

export function PlatePicker({
  open,
  onClose,
  onInsert,
  keyboardInset = 0,
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (tag: string) => void;
  keyboardInset?: number;
}) {
  const [selected, setSelected] = useState<string>(
    postWidgetCatalog[0]?.tag ?? ""
  );
  const listRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(postWidgetCatalog[0]?.tag ?? "");
    // take focus so ↑↓/↵ walk the drawer straight away (the body had it)
    const t = window.setTimeout(() => shellRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [open]);

  const def = postWidgetByTag[selected];
  const Preview = def?.component;

  // arrow keys walk the flat catalog; enter presses the selection in
  const move = (dir: 1 | -1) => {
    const idx = postWidgetCatalog.findIndex((d) => d.tag === selected);
    const next =
      (idx + dir + postWidgetCatalog.length) % postWidgetCatalog.length;
    setSelected(postWidgetCatalog[next].tag);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
          className="fixed inset-x-0 z-[55] flex justify-center px-3 bottom-[max(calc(env(safe-area-inset-bottom)+5.75rem),5.75rem)] md:bottom-8"
          style={keyboardInset > 0 ? { bottom: keyboardInset + 64 } : undefined}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              move(1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              move(-1);
            } else if (e.key === "Enter" && selected) {
              e.preventDefault();
              onInsert(selected);
            }
          }}
        >
          <div
            ref={shellRef}
            tabIndex={-1}
            className="relative w-[min(46rem,100%)] rounded-lg border-[1.5px] border-line/90 bg-card p-4 shadow-paper-lg outline-none sm:p-5"
          >
            <Tape tone="purple" rotate={-4} className="-top-3 left-8" width={64} />

            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Stamp tone="purple" rotate={-3}>
                  the press
                </Stamp>
                <span className="hidden font-hand text-lg text-ink-faint sm:inline">
                  press a figure into the page —
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="font-hand text-lg text-ink-faint transition-colors hover:text-accent-rust"
              >
                shut the drawer ✦
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
              {/* the drawer of plates */}
              <div
                ref={listRef}
                className="max-h-[38vh] space-y-3 overflow-y-auto pr-1 scrollbar-hide sm:max-h-[46vh]"
              >
                {GROUPS.map((g) => {
                  const items = postWidgetCatalog.filter(
                    (d) => d.kind === g.kind
                  );
                  if (!items.length) return null;
                  return (
                    <div key={g.kind}>
                      <p className="mb-1.5 flex items-baseline gap-2 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-ink-faint">
                        {g.heading}
                        <span className="font-hand text-sm normal-case tracking-normal text-ink-faint/70">
                          {g.note}
                        </span>
                      </p>
                      <div className="space-y-1">
                        {items.map((d) => {
                          const on = d.tag === selected;
                          return (
                            <button
                              key={d.tag}
                              type="button"
                              onMouseEnter={() => setSelected(d.tag)}
                              onFocus={() => setSelected(d.tag)}
                              onClick={() => onInsert(d.tag)}
                              className={`block w-full rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                                on
                                  ? "border-accent-purple/50 bg-accent-purple/[0.07]"
                                  : "border-transparent hover:bg-ink/[0.04]"
                              }`}
                            >
                              <span className="flex items-center gap-1.5">
                                <Glyph
                                  interactive={d.kind === "interactive"}
                                />
                                <span className="truncate font-serif text-sm font-medium text-ink">
                                  {d.label}
                                </span>
                              </span>
                              <span className="mt-0.5 block truncate font-hand text-[0.95rem] leading-tight text-ink-faint">
                                {d.blurb}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* the live proof + the press */}
              <div className="flex min-w-0 flex-col">
                <p className="mb-1.5 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-ink-faint">
                  on the plate —
                </p>
                <div className="relative min-h-[8rem] flex-1 overflow-hidden rounded-md border border-dashed border-line bg-paper-2/40 px-3">
                  {/* the real component, live but untouchable — a true proof */}
                  <div className="pointer-events-none max-h-[34vh] overflow-hidden [&_.my-10]:my-3 [&_.my-12]:my-3">
                    {Preview ? <Preview key={selected} /> : null}
                  </div>
                  {/* the fade tells the eye it continues in proof */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-paper-2/80 to-transparent"
                  />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="font-mono text-[0.58rem] lowercase tracking-[0.1em] text-ink-faint">
                    ↑↓ to leaf · ↵ to press
                  </span>
                  <button
                    type="button"
                    onClick={() => selected && onInsert(selected)}
                    className="rounded-md border-[1.5px] border-accent-purple px-4 py-2 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-accent-purple transition-colors hover:bg-accent-purple/10"
                  >
                    press it in ✎
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-2.5 text-right">
              <HandNote tone="purple" rotate={-1} className="text-sm opacity-70">
                it lands on its own line — edit it later like any other line.
              </HandNote>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
