"use client";

// the ghost — the writing room's quiet companion.
//
// Two faces:
//   useGhostCompletion + GhostOverlay — when the pen rests at the end of the
//   text, a graphite continuation appears after the caret (tab takes it,
//   esc waves it off, typing dispels it).
//   GhostPalette — ⌘J summons a paper slip: draft / continue / rework the
//   selection / math (words → katex, previewed) / titles. The ghost only ever
//   OFFERS — nothing lands on the page without the owner's hand.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { HandNote, Stamp, Tape } from "@/app/components/sketchbook";
import { insertText } from "./lib/editor-core";
import type { Working } from "./lib/types";

// ---------------------------------------------------------------------------
// inline completion
// ---------------------------------------------------------------------------

type GhostState = {
  suggestion: string | null;
  thinking: boolean;
  /** accept the suggestion if one is showing — returns true if it did */
  acceptIfAny: () => boolean;
  dismissIfAny: () => boolean;
};

export function useGhostCompletion({
  enabled,
  bodyRef,
  workingRef,
  content,
  caretIndex,
  composingRef,
}: {
  enabled: boolean;
  bodyRef: React.RefObject<HTMLTextAreaElement | null>;
  workingRef: React.MutableRefObject<Working>;
  content: string;
  caretIndex: number;
  composingRef: React.MutableRefObject<boolean>;
}): GhostState {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const suggestionRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reqId = useRef(0);
  // after an accept, stay quiet until the owner writes something themselves —
  // otherwise every Tab chains straight into another paid request
  const restUntilChanged = useRef<string | null>(null);

  useEffect(() => {
    suggestionRef.current = suggestion;
  }, [suggestion]);

  useEffect(() => {
    setSuggestion(null);
    abortRef.current?.abort();
    abortRef.current = null;
    setThinking(false);
    if (!enabled || composingRef.current) return;
    // the ghost only writes at the very end of the text, where there's room
    if (caretIndex !== content.length) return;
    if (content.trim().length < 80) return;
    if (restUntilChanged.current === content) return;
    restUntilChanged.current = null;

    const timer = window.setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      const id = ++reqId.current;
      setThinking(true);
      try {
        const w = workingRef.current;
        const res = await fetch("/api/write/assist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            kind: "complete",
            title: w.title,
            type: w.type,
            tags: w.tags,
            before: content,
          }),
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (controller.signal.aborted) return;
        let text: string = (data?.text || "").replace(/\s+$/, "");
        if (!text) return;
        // seam: make sure exactly the right whitespace joins page and ghost —
        // but an intended paragraph break (leading newlines) is kept, not
        // collapsed into a space
        const last = content[content.length - 1];
        const leadNewlines = text.match(/^\n+/)?.[0].length ?? 0;
        const startsPunct = /^[,.;:!?)\]…—–]/.test(text.trimStart());
        if (leadNewlines > 0) {
          const keep = /\n$/.test(content) ? "" : "\n".repeat(Math.min(2, leadNewlines));
          text = keep + text.replace(/^\n+/, "").replace(/^[ \t]+/, "");
        } else if (/\s/.test(last || "")) {
          text = text.replace(/^[ \t]+/, "");
        } else if (startsPunct) {
          text = text.trimStart();
        } else if (!/^\s/.test(text)) {
          text = ` ${text}`;
        } else {
          text = text.replace(/^[ \t]+/, " ");
        }
        setSuggestion(text);
      } catch {
        /* aborted or offline — the ghost just stays quiet */
      } finally {
        // only the newest request gets to touch the lamp — an aborted
        // straggler resolving late must not flicker or strand it
        if (reqId.current === id) setThinking(false);
      }
    }, 900);

    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
      abortRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, caretIndex, enabled]);

  const acceptIfAny = useCallback(() => {
    const text = suggestionRef.current;
    const ta = bodyRef.current;
    if (!text || !ta) return false;
    ta.focus();
    const end = ta.value.length;
    ta.setSelectionRange(end, end);
    insertText(ta, text);
    restUntilChanged.current = ta.value; // rest until the owner's own ink
    setSuggestion(null);
    return true;
  }, [bodyRef]);

  const dismissIfAny = useCallback(() => {
    if (!suggestionRef.current) return false;
    setSuggestion(null);
    return true;
  }, []);

  return { suggestion, thinking, acceptIfAny, dismissIfAny };
}

/**
 * The graphite layer: an exact metric mirror of the body textarea with an
 * invisible copy of the text and the suggestion rendered after it — so the
 * ghost's words sit precisely where the pen would put them. Color/opacity
 * only; the typed text itself stays the textarea's own.
 */
export function GhostOverlay({
  content,
  suggestion,
}: {
  content: string;
  suggestion: string | null;
}) {
  if (!suggestion) return null;
  return (
    <div
      aria-hidden
      data-ghost-overlay
      className="pointer-events-none absolute left-0 top-0 w-full whitespace-pre-wrap break-words font-serif text-base leading-[1.75] tracking-[0.01em] md:text-lg md:leading-[1.8]"
    >
      <span className="invisible">{content}</span>
      <span className="text-ink-faint/90">{suggestion}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// the palette
// ---------------------------------------------------------------------------

type PaletteMode = "draft" | "continue" | "rework" | "math" | "titles" | "proofread";

const MODE_HINTS: Record<PaletteMode, string> = {
  draft: "what should it say?",
  continue: "any direction? (optional)",
  rework: "how should it change? — tighter, warmer, simpler…",
  math: "describe the math — 'softmax with temperature', '∂L/∂w for mse'…",
  titles: "any angle? (optional)",
  proofread: "anything to watch for? (optional)",
};

// one proofreader's mark — an exact find→replace the owner takes by hand
type Mark = {
  find: string;
  replace: string;
  note: string;
  state: "offered" | "taken" | "stale";
};

function stripMathDelims(text: string): { latex: string; display: boolean } {
  const t = text.trim();
  const display = /^\$\$/.test(t) || /\\begin\{/.test(t);
  const latex = t
    .replace(/^\$\$?/, "")
    .replace(/\$\$?$/, "")
    .trim();
  return { latex, display };
}

export function GhostPalette({
  open,
  onClose,
  selectionText,
  working,
  onInsert,
  onApplyFix,
  onSetTitle,
  keyboardInset = 0,
}: {
  open: boolean;
  onClose: () => void;
  selectionText: string;
  working: Working;
  onInsert: (text: string, replaceSelection: boolean) => void;
  /** land one proofreader's mark on the page — false if the page moved */
  onApplyFix: (find: string, replace: string) => boolean;
  onSetTitle: (title: string) => void;
  /** mobile: ride above the software keyboard + the room's bottom bar */
  keyboardInset?: number;
}) {
  const hasSelection = selectionText.trim().length > 0;
  const [mode, setMode] = useState<PaletteMode>("draft");
  const [instruction, setInstruction] = useState("");
  const [output, setOutput] = useState("");
  const [marks, setMarks] = useState<Mark[] | null>(null); // null = no pass yet
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // a fresh summons: sensible default mode, pen in the input
  useEffect(() => {
    if (!open) return;
    setMode(hasSelection ? "rework" : "draft");
    setOutput("");
    setMarks(null);
    setError(null);
    setInstruction("");
    window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const summon = useCallback(async () => {
    if (streaming) return;
    if (mode === "rework" && !hasSelection) {
      setError("select the passage to rework first ✎");
      return;
    }
    if ((mode === "draft" || mode === "math") && !instruction.trim() && !hasSelection) {
      setError(
        mode === "math" ? "tell the ghost what math you need ✎" : "tell the ghost what to draft ✎"
      );
      return;
    }
    setError(null);
    setOutput("");
    setMarks(null);
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    // ---- proofread: one structured pass, marks instead of prose ----------
    if (mode === "proofread") {
      try {
        const res = await fetch("/api/write/assist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            kind: "proofread",
            selection: selectionText,
            instruction,
            title: working.title,
            type: working.type,
            tags: working.tags,
            content: working.content,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "the ghost lost its train of thought — try again");
        }
        const offered: Mark[] = (Array.isArray(data.marks) ? data.marks : []).map(
          (m: { find: string; replace: string; note: string }) => ({
            ...m,
            state: "offered" as const,
          })
        );
        setMarks(offered);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "the ghost lost its train of thought — try again"
          );
        }
      } finally {
        setStreaming(false);
      }
      return;
    }

    try {
      const res = await fetch("/api/write/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          kind: "ask",
          mode,
          instruction,
          selection: selectionText,
          title: working.title,
          type: working.type,
          tags: working.tags,
          before: working.content,
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "the ghost lost its train of thought — try again");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setOutput(acc);
      }
      setOutput(acc.trim());
    } catch (err) {
      if (!controller.signal.aborted) {
        // a broken stream must not leave half an offering looking finished
        setOutput("");
        setError(
          err instanceof Error ? err.message : "the ghost lost its train of thought — try again"
        );
      }
    } finally {
      setStreaming(false);
    }
  }, [mode, instruction, selectionText, hasSelection, working, streaming]);

  const mathPreview = useMemo(() => {
    if (mode !== "math" || !output.trim()) return null;
    try {
      const { latex, display } = stripMathDelims(output);
      return katex.renderToString(latex, {
        displayMode: display,
        throwOnError: false,
      });
    } catch {
      return null;
    }
  }, [mode, output]);

  const titleOptions = useMemo(() => {
    if (mode !== "titles" || !output.trim()) return [];
    return output
      .split("\n")
      .map((l) => l.replace(/^[-*\d.)\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 8);
  }, [mode, output]);

  const take = useCallback(() => {
    if (!output.trim()) return;
    let text = output.trim();
    if (mode === "math") {
      const { latex, display } = stripMathDelims(text);
      text = display ? `\n\n$$\n${latex}\n$$\n\n` : `$${latex}$`;
    }
    onInsert(text, mode === "rework");
    onClose();
  }, [output, mode, onInsert, onClose]);

  // land one mark; "stale" means the page moved out from under it.
  // the apply happens OUTSIDE the state updater — updaters must stay pure
  // (strict mode double-invokes them, which would double-apply the fix).
  const takeMark = useCallback(
    (i: number) => {
      if (!marks || marks[i]?.state !== "offered") return;
      const ok = onApplyFix(marks[i].find, marks[i].replace);
      setMarks((ms) => {
        if (!ms || !ms[i]) return ms;
        const next = [...ms];
        next[i] = { ...next[i], state: ok ? "taken" : "stale" };
        return next;
      });
    },
    [marks, onApplyFix]
  );

  const takeAllMarks = useCallback(() => {
    if (!marks) return;
    const states = marks.map((m) =>
      m.state === "offered"
        ? onApplyFix(m.find, m.replace)
          ? ("taken" as const)
          : ("stale" as const)
        : m.state
    );
    setMarks((ms) => ms && ms.map((m, i) => ({ ...m, state: states[i] })));
  }, [marks, onApplyFix]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
          className="fixed inset-x-0 z-[55] flex justify-center px-3 bottom-[max(calc(env(safe-area-inset-bottom)+5.75rem),5.75rem)] md:bottom-8"
          // when the software keyboard is up, ride above it + the mobile bar
          style={
            keyboardInset > 0 ? { bottom: keyboardInset + 64 } : undefined
          }
        >
          {/* a still slip of paper — deliberately NOT .sketch-card: this is an
              input surface, it must not twitch or glow on hover */}
          <div className="relative w-[min(42rem,100%)] rounded-lg border-[1.5px] border-line/90 bg-card p-4 shadow-paper-lg sm:p-5">
            <Tape tone="ink" rotate={-4} className="-top-3 left-8" width={64} />

            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Stamp tone="ink" rotate={-3}>
                  the ghost
                </Stamp>
                {hasSelection && (
                  <span className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-ink-faint">
                    {selectionText.trim().split(/\s+/).length} words selected
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="font-hand text-lg text-ink-faint transition-colors hover:text-accent-rust"
              >
                rest ✦
              </button>
            </div>

            {/* mode chips */}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(
                [
                  ["draft", true],
                  ["continue", true],
                  ["rework", hasSelection],
                  ["math", true],
                  ["titles", true],
                  ["proofread", true],
                ] as [PaletteMode, boolean][]
              ).map(([m, available]) => (
                <button
                  key={m}
                  type="button"
                  disabled={!available}
                  onClick={() => setMode(m)}
                  className={`rounded-full border px-3 py-1 font-mono text-[0.65rem] lowercase tracking-[0.08em] transition-colors ${
                    mode === m
                      ? "border-ink bg-ink/10 text-ink"
                      : available
                        ? "border-line text-ink-soft hover:border-ink/40"
                        : "border-line/50 text-ink-faint/50"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void summon();
                  }
                }}
                placeholder={MODE_HINTS[mode]}
                className="w-full rounded-md border border-line bg-paper-2/60 px-3 py-2 font-serif text-sm text-ink placeholder:italic placeholder:text-ink-faint focus:border-ink/50 focus:outline-none focus-visible:ring-0"
              />
              <button
                type="button"
                onClick={() => void summon()}
                disabled={streaming}
                className="shrink-0 rounded-md border-[1.5px] border-ink px-4 py-2 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink transition-colors hover:bg-ink/10 disabled:opacity-40"
              >
                {streaming ? "writing…" : "ask ✦"}
              </button>
            </div>

            {error && (
              <p className="mt-2 font-hand text-lg text-accent-rust">{error}</p>
            )}

            {/* the proofreader's marks */}
            {mode === "proofread" && (streaming || marks !== null) && (
              <div className="mt-3 rounded-md border border-dashed border-ink/30 bg-ink/[0.03] p-3">
                {streaming ? (
                  <p className="font-hand text-lg text-ink-soft">
                    reading every line… <span className="animate-pulse">✎</span>
                  </p>
                ) : marks && marks.length === 0 ? (
                  <p className="font-hand text-lg text-ink-soft">
                    clean copy — the ghost found nothing to fix ✓
                  </p>
                ) : (
                  marks && (
                    <>
                      <p className="mb-2 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-ink-faint">
                        the proofreader&apos;s marks — {marks.length}
                      </p>
                      <div className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
                        {marks.map((m, i) => (
                          <div
                            key={`${i}-${m.find.slice(0, 24)}`}
                            className={`border-b border-dashed border-line/70 pb-2 last:border-b-0 ${
                              m.state === "taken" ? "opacity-50" : ""
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words font-serif text-sm leading-relaxed">
                              <span className="text-ink-faint line-through decoration-accent-rust/60">
                                {m.find}
                              </span>{" "}
                              <span className="text-ink-faint">→</span>{" "}
                              <span className="text-ink">{m.replace}</span>
                            </p>
                            <div className="mt-0.5 flex items-baseline gap-3">
                              <span className="font-mono text-[0.6rem] lowercase tracking-[0.08em] text-ink-faint">
                                {m.note}
                              </span>
                              {m.state === "offered" ? (
                                <button
                                  type="button"
                                  onClick={() => takeMark(i)}
                                  className="font-hand text-base text-accent-orange transition-colors hover:text-accent-rust"
                                >
                                  take ✎
                                </button>
                              ) : m.state === "taken" ? (
                                <span className="font-hand text-base text-ink-faint">
                                  taken ✓
                                </span>
                              ) : (
                                <span className="font-hand text-base text-accent-rust">
                                  the page moved — find it by hand
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center gap-4">
                        {marks.some((m) => m.state === "offered") && (
                          <button
                            type="button"
                            onClick={takeAllMarks}
                            className="font-hand text-lg text-accent-orange transition-colors hover:text-accent-rust"
                          >
                            take them all ✎
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void summon()}
                          className="font-hand text-lg text-ink-soft transition-colors hover:text-accent-orange"
                        >
                          look again?
                        </button>
                      </div>
                    </>
                  )
                )}
              </div>
            )}

            {/* the offering (proofread renders its own marks block above) */}
            {mode !== "proofread" && (output || streaming) && (
              <div className="mt-3 rounded-md border border-dashed border-ink/30 bg-ink/[0.03] p-3">
                <p className="mb-1.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-ink-faint">
                  the ghost offers —
                </p>

                {mode === "titles" && titleOptions.length > 0 && !streaming ? (
                  <div className="flex flex-col items-start gap-1">
                    {titleOptions.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          onSetTitle(t);
                          onClose();
                        }}
                        className="text-left font-serif text-base font-medium text-ink transition-colors hover:text-accent-orange"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="max-h-56 overflow-y-auto whitespace-pre-wrap font-serif text-sm leading-relaxed text-ink-soft">
                      {output}
                      {streaming && <span className="animate-pulse">✎</span>}
                    </div>
                    {mathPreview && (
                      <div
                        className="mt-2 overflow-x-auto border-t border-dashed border-line pt-2 text-ink"
                        dangerouslySetInnerHTML={{ __html: mathPreview }}
                      />
                    )}
                  </>
                )}

                {!streaming && output && mode !== "titles" && (
                  <div className="mt-3 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={take}
                      className="font-hand text-lg text-accent-orange transition-colors hover:text-accent-rust"
                    >
                      {mode === "rework" ? "swap it in ✎" : "take it ✎"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void summon()}
                      className="font-hand text-lg text-ink-soft transition-colors hover:text-accent-orange"
                    >
                      another?
                    </button>
                    <button
                      type="button"
                      onClick={() => setOutput("")}
                      className="font-hand text-lg text-ink-faint transition-colors hover:text-accent-rust"
                    >
                      leave it
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="mt-2.5 text-right">
              <HandNote tone="ink" rotate={-1} className="text-sm opacity-70">
                the ghost drafts; you decide. nothing lands without your hand.
              </HandNote>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
