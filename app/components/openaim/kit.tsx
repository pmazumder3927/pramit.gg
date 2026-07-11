"use client";

// Shared kit for the OpenAim interactive widgets embedded in the essay.
// Everything is theme-aware via the site's CSS-var tokens (paper light / indigo
// dark) and styled to match the sketchbook look. Instrument text stays on the
// readable sans/mono stacks; handwriting is reserved for the editorial caption.

import React, { useCallback, useRef } from "react";

/** Theme-aware colors, pulled straight from the site's RGB-triplet CSS vars so
 *  every widget flips correctly between light and dark. `hit` is a data-viz
 *  green kept legible on both grounds. */
export const C = {
  acc: "rgb(var(--accent-orange))",
  accA: (a: number) => `rgb(var(--accent-orange) / ${a})`,
  pur: "rgb(var(--accent-purple))",
  purA: (a: number) => `rgb(var(--accent-purple) / ${a})`,
  rust: "rgb(var(--accent-rust))",
  rustA: (a: number) => `rgb(var(--accent-rust) / ${a})`,
  ink: "rgb(var(--fg))",
  soft: "rgb(var(--fg-soft))",
  faint: "rgb(var(--fg-faint))",
  line: "rgb(var(--line))",
  lineA: (a: number) => `rgb(var(--line) / ${a})`,
  hit: "#3aa76d",
  hitA: (a: number) => `rgba(58,167,109,${a})`,
} as const;

/** Card shell that matches the essay's figures — a sketch-card with a titled
 *  header, a hint chip, and a hand-written caption underneath. */
export function VizCard({
  title,
  hint,
  children,
  caption,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  caption?: React.ReactNode;
}) {
  return (
    <div className="not-prose my-10 md:my-12">
      <div className="sketch-card overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line/70 px-5 py-3">
          <h4 className="font-serif text-base font-medium text-ink">{title}</h4>
          {hint ? (
            <span className="font-mono text-xs font-medium text-accent-purple">
              {hint}
            </span>
          ) : null}
        </div>
        <div className="p-4 font-sans sm:p-5">{children}</div>
      </div>
      {caption ? (
        <p className="mx-auto mt-3 max-w-prose px-1 text-center font-hand text-lg leading-snug text-ink-faint">
          {caption}
        </p>
      ) : null}
    </div>
  );
}

/** Labelled range slider with a live mono read-out, tinted to a series color. */
export function Ctl({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  fmt,
  accent = C.acc,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
  accent?: string;
}) {
  return (
    <label className="block select-none">
      <div className="flex items-baseline justify-between">
        <span className="font-sans text-sm font-medium text-ink-soft">{label}</span>
        <span className="font-mono text-sm text-ink" style={{ color: accent }}>
          {fmt ? fmt(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-full"
        style={{
          accentColor: accent,
          background: `linear-gradient(90deg, ${accent} ${((value - min) / (max - min)) * 100}%, rgb(var(--line)) ${((value - min) / (max - min)) * 100}%)`,
        }}
      />
    </label>
  );
}

/** A small stat read-out: big mono number + compact sans label. */
export function Stat({
  value,
  label,
  color = C.ink,
}: {
  value: string;
  label: string;
  color?: string;
}) {
  return (
    <div className="min-w-0">
      <div
        className="font-mono text-xl leading-none tabular-nums sm:text-2xl"
        style={{ color }}
      >
        {value}
      </div>
      <div className="mt-1 font-sans text-xs font-medium leading-snug text-ink-faint">
        {label}
      </div>
    </div>
  );
}

/** Pill toggle button in the sketchbook style. */
export function Toggle({
  on,
  onClick,
  children,
  accent = C.acc,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="min-h-8 rounded-full border px-3.5 py-1.5 font-sans text-sm font-medium leading-none transition-colors"
      style={{
        borderColor: on ? accent : C.lineA(0.9),
        color: on ? accent : C.faint,
        background: on ? C.accA(0.12) : "transparent",
      }}
    >
      {children}
    </button>
  );
}

/** Solid action button. */
export function Btn({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-8 rounded-full border border-accent-orange/40 bg-accent-orange/15 px-4 py-1.5 font-sans text-sm font-medium leading-none text-accent-orange transition-colors hover:bg-accent-orange/25"
    >
      {children}
    </button>
  );
}

/** Map a pointer event on an <svg> to a 0..1 fraction along its x axis, using
 *  a plotting window [x0,x1] in the svg's own viewBox coordinates. Handles both
 *  mouse and touch via pointer events. */
export function useSvgDragX(
  x0: number,
  x1: number,
  onFrac: (f: number) => void,
) {
  const ref = useRef<SVGSVGElement>(null);
  const compute = useCallback(
    (clientX: number) => {
      const svg = ref.current;
      if (!svg) return;
      const r = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      // px → viewBox x
      const vx = vb.x + ((clientX - r.left) / r.width) * vb.width;
      const f = Math.min(1, Math.max(0, (vx - x0) / (x1 - x0)));
      onFrac(f);
    },
    [x0, x1, onFrac],
  );
  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      (e.target as Element).setPointerCapture?.(e.pointerId);
      compute(e.clientX);
    },
    [compute],
  );
  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.buttons === 0) return;
      compute(e.clientX);
    },
    [compute],
  );
  return { ref, onPointerDown, onPointerMove };
}

/** sigmoid — used by several widgets. */
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
