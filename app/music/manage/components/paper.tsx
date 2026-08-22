"use client";

import Image from "next/image";
import type { ReactNode } from "react";

/**
 * The manager's building blocks, in the site's own materials.
 *
 * The rule that governs all of them: content sits on OPAQUE paper. The site
 * paints a live ink scape behind every page, so the old manager's translucent
 * `bg-white/[0.02]` panels left their own text competing with someone's doodle
 * of a cat. Sheets are solid; only the gaps between them show the scape.
 */

export function Sheet({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "aside";
}) {
  return (
    <Tag
      className={`rounded-lg border border-line bg-card shadow-paper ${className}`}
    >
      {children}
    </Tag>
  );
}

/** Small-caps mono label — the manager's field-name voice. */
export function Label({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint ${className}`}
    >
      {children}
    </span>
  );
}

/** Caveat aside — the hand in the margin. */
export function Margin({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`font-hand text-[15px] text-accent-rust ${className}`}>
      {children}
    </span>
  );
}

export function Rule({ className = "" }: { className?: string }) {
  return <div className={`h-px w-full bg-line ${className}`} />;
}

export function Tag({
  children,
  tone = "quiet",
  className = "",
}: {
  children: ReactNode;
  tone?: "quiet" | "warm" | "cool" | "solid";
  className?: string;
}) {
  const tones = {
    quiet: "border-line text-ink-faint",
    warm: "border-accent-orange/45 text-accent-orange",
    cool: "border-accent-purple/45 text-accent-purple",
    solid: "border-ink bg-ink text-paper",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** A keyboard hint drawn as a key. */
export function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.35rem] items-center justify-center rounded border border-line bg-paper-2 px-1 py-px font-mono text-[10px] text-ink-soft">
      {children}
    </kbd>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  tone = "plain",
  className = "",
  title,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "plain" | "ink" | "warm" | "danger";
  className?: string;
  title?: string;
  type?: "button" | "submit";
}) {
  const tones = {
    plain: "border-line text-ink-soft hover:border-ink/40 hover:text-ink",
    ink: "border-ink bg-ink text-paper hover:bg-accent-orange hover:border-accent-orange",
    warm: "border-accent-orange/60 text-accent-orange hover:bg-accent-orange/10",
    danger: "border-accent-rust/50 text-accent-rust hover:bg-accent-rust/10",
  };
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[11px] tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

/** Album art with the site's paper-edge treatment, or a ruled placeholder. */
export function Art({
  src,
  alt,
  size,
  className = "",
}: {
  src: string | null;
  alt: string;
  size: number;
  className?: string;
}) {
  return (
    <div
      className={`relative flex-none overflow-hidden rounded border border-line bg-paper-2 ${className}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image src={src} alt={alt} fill sizes={`${size}px`} className="object-cover" />
      ) : (
        <div
          className="h-full w-full opacity-40"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgb(var(--line)) 0 1px, transparent 1px 6px)",
          }}
        />
      )}
    </div>
  );
}

/** A count with its name underneath — the desk's ledger figure. */
export function Figure({
  value,
  name,
  tone,
}: {
  value: number | string;
  name: string;
  tone?: "warm" | "cool";
}) {
  const color =
    tone === "warm" ? "text-accent-orange" : tone === "cool" ? "text-accent-purple" : "text-ink";
  return (
    <div>
      <p className={`font-serif text-2xl leading-none tabular-nums ${color}`}>{value}</p>
      <Label className="mt-1.5 block">{name}</Label>
    </div>
  );
}

/** Horizontal bar, drawn as ink on the sheet rather than a filled pill. */
export function Meter({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-[3px] w-full rounded-full bg-line/70">
      <div
        className="h-full rounded-full bg-accent-orange transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="py-16 text-center">
      <Margin>{children}</Margin>
    </div>
  );
}

export function formatAgo(value: string | null | undefined): string {
  if (!value) return "never";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (!ms) return "—";
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export const fetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || "Could not load");
  return json as T;
};
