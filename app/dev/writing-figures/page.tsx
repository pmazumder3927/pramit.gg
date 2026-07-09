"use client";

// Dev-only harness for the writing room's figure treatment: the same body
// markup the real room uses (relative wrapper + identical-metric textarea +
// PlateOverlay), so plate alignment and the picker can be eyeballed without
// auth. Not linked anywhere.

import { useEffect, useMemo, useRef, useState } from "react";
import { PlateOverlay, PlatePicker } from "@/app/write/Figures";
import { insertFigure, lineBoundsAt } from "@/app/write/lib/editor-core";

const SAMPLE = `# the itch

every aim trainer on the market hands you a number and a shrug. you run a scenario, you get a score, and then you guess what to do about it.

<noise-frontier></noise-frontier>

four completely different problems. same score. opposite fixes. the number can't tell them apart, and neither can you.

<capability-radar></capability-radar>

## the loop

telemetry feeds diagnosis, which updates the model and feeds the coach.

<loop-fig></loop-fig>

and the sensitivity engine runs continuously off the same signal:

<sens-spectrum></sens-spectrum>

that's the whole idea.
`;

export default function Page() {
  const [content, setContent] = useState(SAMPLE);
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  // minimal autogrow so every line shows (the real room does this too)
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [content]);

  const reveal = useMemo(
    () => (focused ? lineBoundsAt(content, caret).start : -1),
    [focused, content, caret]
  );

  return (
    <main className="mx-auto max-w-[46rem] px-5 py-16">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl text-ink">writing room — figures</h1>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-accent-purple px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-accent-purple hover:bg-accent-purple/10"
        >
          press a figure ✦
        </button>
      </div>

      <div className="relative rounded-[3px] border border-line bg-card px-6 py-10 shadow-paper-lg md:px-14">
        <div className="relative">
          <textarea
            ref={ref}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setCaret(e.target.selectionStart);
            }}
            onSelect={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            spellCheck={false}
            className="relative block min-h-[40vh] w-full resize-none overflow-hidden bg-transparent font-serif text-base leading-[1.75] tracking-[0.01em] text-ink-soft focus:outline-none md:text-lg md:leading-[1.8]"
            style={{ caretColor: "rgb(var(--accent-rust))" }}
          />
          <PlateOverlay content={content} revealLineStart={reveal} />
        </div>
      </div>

      <p className="mt-4 font-hand text-lg text-ink-faint">
        click into a figure line to reveal its raw tag · press a figure to add one
      </p>

      <PlatePicker
        open={open}
        onClose={() => setOpen(false)}
        onInsert={(tag) => {
          const ta = ref.current;
          if (ta) {
            insertFigure(ta, tag);
            setContent(ta.value);
            setCaret(ta.selectionStart);
          }
          setOpen(false);
        }}
      />
    </main>
  );
}
