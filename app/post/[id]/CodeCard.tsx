"use client";

import { useState } from "react";

// The framed code block with its copy button. Client-side only for the
// clipboard state — the highlighted code itself arrives already rendered.
export default function CodeCard({
  lang,
  code,
  children,
}: {
  lang: string;
  code: string;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="group relative my-10 md:my-12">
      <div className="overflow-hidden rounded-md border border-line bg-paper-2 shadow-paper">
        <div className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-2">
          <span className="font-mono text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-ink-faint">
            {lang || "code"}
          </span>
          <span role="status" aria-live="polite" className="sr-only">
            {copied ? "Code copied to clipboard" : ""}
          </span>
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? "Code copied to clipboard" : "Copy code"}
            className="font-hand text-base leading-none text-ink-faint transition-colors hover:text-accent-orange focus-visible:text-accent-orange lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
            style={
              copied ? { color: "rgb(var(--accent-orange))", opacity: 1 } : undefined
            }
          >
            {copied ? "copied ✓" : "copy"}
          </button>
        </div>
        <pre className="ios-momentum-scroll overflow-x-auto p-5 text-sm leading-relaxed md:p-6">
          {children}
        </pre>
      </div>
    </div>
  );
}
