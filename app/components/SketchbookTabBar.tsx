"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Doodle, TornEdge } from "./sketchbook";

type Tone = "rust" | "purple" | "orange";

const toneVar: Record<Tone, string> = {
  rust: "--accent-rust",
  purple: "--accent-purple",
  orange: "--accent-orange",
};

// Each tab carries a hand-drawn glyph (single path, stroked like the doodles,
// "inked in" with a wash of its accent when active) plus a Caveat label.
type Item = {
  href: string;
  label: string;
  tone: Tone;
  d: string;
  rotate: number;
};

const ITEMS: Item[] = [
  // pencil resting on a writing line
  { href: "/", label: "writing", tone: "rust", rotate: 0,
    d: "M6 26c0-1 1-4 2-5L20 8l4 4L11 24c-1 1-4 2-5 2z M18 10l4 4 M6.5 28.5h7" },
  // beamed pair of eighth notes
  { href: "/music", label: "sound", tone: "purple", rotate: 0,
    d: "M11 24a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M24 20a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M11 24V9l13-4v15" },
  // two overlapping snapshot frames
  { href: "/collage", label: "collage", tone: "orange", rotate: -4,
    d: "M6 9h12v12H6z M13 13h13v13H13z" },
  // paper aeroplane mid-flight
  { href: "/connect", label: "connect", tone: "rust", rotate: 0,
    d: "M28 5L4 14l8 4 3 9 4-6 9 5z M12 18l9-9" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Glyph({
  d,
  rotate,
  color,
  active,
}: {
  d: string;
  rotate: number;
  color: string;
  active: boolean;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 32 32"
      className="h-[26px] w-[26px] overflow-visible"
      fill="none"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <path
        d={d}
        stroke={color}
        strokeWidth={active ? 2.4 : 2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
        fillRule="evenodd"
        fill={active ? color : "none"}
        fillOpacity={active ? 0.18 : 0}
        style={{ transition: "stroke 0.25s, fill-opacity 0.25s" }}
      />
    </svg>
  );
}

export default function SketchbookTabBar() {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 md:hidden"
    >
      <div
        className="relative border-t border-line bg-paper"
        style={{
          paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))",
          boxShadow: "0 -7px 20px -14px rgb(var(--fg) / 0.4)",
        }}
      >
        {/* the bar reads as a torn strip of paper taped over the screen edge */}
        <TornEdge position="top" color="rgb(var(--bg))" />

        <ul className="mx-auto flex max-w-md items-stretch justify-around px-1 pt-1.5">
          {ITEMS.map((it) => {
            const active = isActive(pathname, it.href);
            const accent = `rgb(var(${toneVar[it.tone]}))`;
            const color = active ? accent : "rgb(var(--fg-soft))";
            return (
              <li key={it.href} className="flex-1">
                <Link
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  className="group relative flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 transition-transform active:scale-90"
                >
                  <span className="relative flex h-9 w-9 items-center justify-center">
                    {/* a pen-scribbled ring loops around the current tab */}
                    <AnimatePresence>
                      {active && (
                        <motion.span
                          key="ring"
                          className="pointer-events-none absolute inset-0 flex items-center justify-center"
                          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.7, rotate: -8 }}
                          animate={{ opacity: 1, scale: 1, rotate: 0 }}
                          exit={{ opacity: 0, scale: 0.7 }}
                          transition={{ type: "spring", stiffness: 380, damping: 24 }}
                        >
                          <Doodle
                            name="circle"
                            tone={it.tone}
                            className="h-11 w-12"
                            strokeWidth={3}
                            draw={!reduce}
                          />
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <motion.span
                      animate={active && !reduce ? { y: -1 } : { y: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 22 }}
                    >
                      <Glyph d={it.d} rotate={it.rotate} color={color} active={active} />
                    </motion.span>
                  </span>
                  <span
                    className="font-hand text-[15px] leading-none transition-colors"
                    style={{ color }}
                  >
                    {it.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
