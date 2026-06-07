// ============================================================================
// Sketchbook design language — reusable motif primitives.
// Presentational only (no hooks), safe to use in server or client components.
// Everything is theme-aware via the CSS-variable tokens in globals.css.
// ============================================================================
import { ReactNode, CSSProperties } from "react";
import { chaosFor, paperTextureStyle, type Chaos, type TapePos } from "@/app/lib/chaos";

type Tone = "orange" | "purple" | "rust" | "ink";

const toneVar: Record<Tone, string> = {
  orange: "--accent-orange",
  purple: "--accent-purple",
  rust: "--accent-rust",
  ink: "--fg",
};

const rgb = (tone: Tone, a = 1) => `rgb(var(${toneVar[tone]}) / ${a})`;

// ---------------------------------------------------------------------------
// Washi tape — a strip of translucent tape. Position via `className` (absolute).
// ---------------------------------------------------------------------------
export function Tape({
  rotate = -4,
  tone = "orange",
  className = "",
  width = 84,
  style,
}: {
  rotate?: number;
  tone?: Tone;
  className?: string;
  width?: number;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute z-20 block h-6 ${className}`}
      style={{
        width,
        transform: `rotate(${rotate}deg)`,
        background: `repeating-linear-gradient(45deg, ${rgb(tone, 0.26)} 0 6px, ${rgb(tone, 0.16)} 6px 12px)`,
        borderLeft: `1px dashed ${rgb(tone, 0.45)}`,
        borderRight: `1px dashed ${rgb(tone, 0.45)}`,
        boxShadow: "0 1px 3px rgb(var(--fg) / 0.12)",
        ...style,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Paper clip — SVG, clipped over a corner. Position via `className`.
// ---------------------------------------------------------------------------
export function PaperClip({
  className = "",
  tone = "ink",
  size = 38,
  rotate = 0,
}: {
  className?: string;
  tone?: Tone;
  size?: number;
  rotate?: number;
}) {
  return (
    <svg
      aria-hidden
      className={`pointer-events-none absolute z-20 ${className}`}
      width={size}
      height={size * 1.7}
      viewBox="0 0 40 68"
      fill="none"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <path
        d="M27 12v34a9 9 0 1 1-18 0V14a6 6 0 0 1 12 0v30a3 3 0 1 1-6 0V18"
        stroke={rgb(tone, 0.55)}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Ink stamp — a rubber-stamp style label (dates, types, "draft", etc.).
// ---------------------------------------------------------------------------
export function Stamp({
  children,
  tone = "rust",
  rotate = -5,
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  rotate?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[5px] border-[1.5px] px-2.5 py-1 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.18em] ${className}`}
      style={{
        transform: `rotate(${rotate}deg)`,
        color: rgb(tone, 0.92),
        borderColor: rgb(tone, 0.5),
        background: rgb(tone, 0.07),
      }}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Handwritten note / caption (Caveat).
// ---------------------------------------------------------------------------
export function HandNote({
  children,
  tone = "rust",
  rotate = -3,
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  rotate?: number;
  className?: string;
}) {
  return (
    <span
      className={`font-hand leading-tight ${className}`}
      style={{ color: rgb(tone), transform: `rotate(${rotate}deg)`, display: "inline-block" }}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Doodles — small hand-drawn SVG marks. `name` selects the shape.
// `draw` animates the stroke in (uses the .ink-draw helper).
// ---------------------------------------------------------------------------
type DoodleName = "underline" | "circle" | "arrow" | "star" | "squiggle" | "divider" | "scribble";

const DOODLES: Record<DoodleName, { vb: string; d: string; w?: number; fill?: boolean }> = {
  underline: { vb: "0 0 200 16", d: "M3 10 C44 4 70 13 104 8 C140 3 168 12 197 6" },
  circle: { vb: "0 0 200 90", d: "M40 14 C92 2 168 6 188 38 C202 64 150 84 96 82 C40 80 4 64 10 40 C14 22 44 12 78 12" },
  arrow: { vb: "0 0 80 40", d: "M4 30 C24 8 50 8 72 16 M72 16 L60 8 M72 16 L60 26" },
  star: { vb: "0 0 40 40", d: "M20 3 L24 16 L38 16 L27 24 L31 37 L20 29 L9 37 L13 24 L2 16 L16 16 Z", fill: true },
  squiggle: { vb: "0 0 120 20", d: "M2 10 C12 2 18 18 30 10 C42 2 48 18 60 10 C72 2 78 18 90 10 C102 2 108 18 118 10" },
  divider: { vb: "0 0 320 24", d: "M4 12 C60 4 90 18 150 12 C200 7 230 18 280 11 C296 9 308 13 316 12" },
  scribble: { vb: "0 0 60 60", d: "M8 30 C20 10 40 10 50 28 C56 40 44 52 30 50 C18 48 12 40 16 32" },
};

export function Doodle({
  name,
  tone = "orange",
  className = "",
  strokeWidth = 3,
  draw = false,
}: {
  name: DoodleName;
  tone?: Tone;
  className?: string;
  strokeWidth?: number;
  draw?: boolean;
}) {
  const d = DOODLES[name];
  return (
    <svg
      aria-hidden
      className={`pointer-events-none overflow-visible ${className}`}
      viewBox={d.vb}
      preserveAspectRatio="none"
      fill="none"
    >
      <path
        className={draw ? "ink-draw" : ""}
        d={d.d}
        stroke={rgb(tone)}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={d.fill ? rgb(tone) : "none"}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Torn / deckled paper edge — place at the top or bottom of a paper panel.
// ---------------------------------------------------------------------------
export function TornEdge({
  position = "bottom",
  className = "",
  color = "rgb(var(--surface))",
}: {
  position?: "top" | "bottom";
  className?: string;
  color?: string;
}) {
  const flip = position === "top";
  return (
    <svg
      aria-hidden
      className={`pointer-events-none absolute left-0 ${position === "top" ? "top-0 -translate-y-[98%]" : "bottom-0 translate-y-[98%]"} w-full ${className}`}
      style={{ transform: flip ? "scaleY(-1)" : undefined, height: 14 }}
      viewBox="0 0 1200 14"
      preserveAspectRatio="none"
    >
      <path
        d="M0 0 L0 6 L20 9 L40 4 L62 10 L84 5 L108 11 L130 5 L156 10 L182 4 L210 9 L240 5 L270 11 L300 5 L334 10 L368 4 L404 9 L440 5 L478 11 L516 5 L556 10 L596 4 L640 9 L684 5 L728 11 L772 5 L818 10 L864 4 L912 9 L960 5 L1010 11 L1060 5 L1112 10 L1160 5 L1200 8 L1200 0 Z"
        fill={color}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Ruled / grid / dotted paper surface.
// ---------------------------------------------------------------------------
export function RuledPaper({
  children,
  variant = "ruled",
  margin = false,
  className = "",
  style,
}: {
  children?: ReactNode;
  variant?: "ruled" | "grid" | "dotted" | "none";
  margin?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const line = "rgb(var(--accent-purple) / 0.10)";
  let bg: string | undefined;
  let bgSize: string | undefined;
  if (variant === "ruled") {
    bg = `repeating-linear-gradient(transparent 0 31px, ${line} 31px 32px)`;
  } else if (variant === "grid") {
    bg = `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`;
    bgSize = "26px 26px";
  } else if (variant === "dotted") {
    bg = `radial-gradient(rgb(var(--accent-purple) / 0.16) 1.2px, transparent 1.3px)`;
    bgSize = "22px 22px";
  }
  return (
    <div
      className={`relative ${className}`}
      style={{ backgroundImage: bg, backgroundSize: bgSize, ...style }}
    >
      {margin && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-10 w-px sm:left-14"
          style={{ background: "rgb(var(--accent-rust) / 0.30)" }}
        />
      )}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Polaroid — a framed photo with optional caption + tape, slightly rotated.
// ---------------------------------------------------------------------------
export function Polaroid({
  src,
  alt = "",
  caption,
  rotate = -2,
  tone = "purple",
  className = "",
  children,
}: {
  src?: string;
  alt?: string;
  caption?: ReactNode;
  rotate?: number;
  tone?: Tone;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`relative inline-block bg-card p-2.5 pb-1 shadow-paper ${className}`}
      style={{
        transform: `rotate(${rotate}deg)`,
        border: "1px solid rgb(var(--line))",
      }}
    >
      <Tape tone={tone} rotate={rotate < 0 ? 4 : -4} className="-top-3 left-1/2 -translate-x-1/2" />
      <div className="overflow-hidden border border-ink/10 bg-paper-2">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className="block h-full w-full object-cover" loading="lazy" />
        ) : (
          children
        )}
      </div>
      {caption && (
        <div className="px-1 pt-1.5 pb-0.5 text-center font-hand text-lg leading-none text-ink-soft">
          {caption}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chaos decorations — drop-in seeded variety for any positioned card.
// Usage:
//   <div className="sketch-card relative" style={chaosCardStyle(post.id)}>
//     <ChaosDecor seed={post.id} />
//     ...content...
//   </div>
// ---------------------------------------------------------------------------
const TAPE_POS: Record<TapePos, string> = {
  tl: "-top-3 left-5",
  tr: "-top-3 right-5",
  tc: "-top-3 left-1/2 -translate-x-1/2",
  none: "",
};

export function ChaosDecor({ seed, chaos }: { seed?: string | number; chaos?: Chaos }) {
  const c = chaos ?? chaosFor(seed ?? 0);
  return (
    <>
      {c.tape !== "none" && (
        <Tape
          tone={c.tapeTone}
          rotate={c.tape === "tl" ? 5 : c.tape === "tr" ? -5 : -2}
          className={TAPE_POS[c.tape]}
          width={68}
        />
      )}
      {c.clip && <PaperClip className="-top-4 right-7" rotate={9} tone="ink" size={28} />}
      {c.sticker !== "none" && (
        <Doodle
          name={c.sticker}
          tone={c.tone}
          className="absolute -bottom-2.5 -right-1.5 h-7 w-7 opacity-80"
          strokeWidth={2.5}
        />
      )}
    </>
  );
}

/** Wrapper style (rotation + paper texture) for a chaos card. */
export function chaosCardStyle(seed: string | number): CSSProperties {
  const c = chaosFor(seed);
  return { transform: `rotate(${c.rotate}deg)`, ...paperTextureStyle(c.paper) };
}

export const sketchRgb = rgb;
