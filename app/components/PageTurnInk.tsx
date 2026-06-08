"use client";

import { usePathname } from "next/navigation";

// The site's pages live in a notebook with a faint rust margin rule down the
// left gutter (see PaperBackground). On each navigation a pen "rules" that
// margin afresh: a hand-drawn hair draws head→tail down the spine in the
// destination section's accent ink, then fades back to the resting rule.
//
// It's a transient flourish, not a loader — content lands instantly via
// .page-reveal, and this stroke lives in the empty gutter so it never veils or
// delays anything. Re-keyed by pathname so the draw replays on every route.

type Tone = "rust" | "purple" | "orange";

const toneVar: Record<Tone, string> = {
  rust: "--accent-rust",
  purple: "--accent-purple",
  orange: "--accent-orange",
};

function toneFor(pathname: string): Tone {
  if (pathname.startsWith("/music")) return "purple";
  if (pathname.startsWith("/collage")) return "orange";
  // writing (/, /post), connect, dashboard, everything else → rust
  return "rust";
}

export default function PageTurnInk() {
  const pathname = usePathname();
  const ink = `rgb(var(${toneVar[toneFor(pathname)]}))`;

  return (
    // Pinned over the left margin rule (left-[54px], w-px). Desktop only —
    // the gutter doesn't exist on mobile. Sits just above the paper backdrop
    // but below content, and never intercepts pointers.
    <div
      key={pathname}
      aria-hidden
      className="spine-ink-fade pointer-events-none fixed inset-y-0 left-[54px] z-[1] hidden w-3 -translate-x-1/2 sm:block"
    >
      <svg
        className="h-full w-full overflow-visible"
        viewBox="0 0 12 1000"
        preserveAspectRatio="none"
        fill="none"
      >
        {/* a single hair with a little hand-wobble, drawn top→bottom */}
        <path
          className="ink-write"
          d="M6 2 C 8 130 4 250 6 380 S 9 620 5 780 S 4 910 6 998"
          pathLength={1}
          stroke={ink}
          strokeWidth={1.5}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ ["--wdur" as string]: "0.62s" }}
        />
      </svg>
    </div>
  );
}
