"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Tape,
  PaperClip,
  Stamp,
  HandNote,
  Doodle,
  TornEdge,
} from "@/app/components/sketchbook";
import DoodleTile from "@/app/components/DoodleTile";

type Banner = {
  id: string;
  image_url: string;
  storage_path: string;
  sketch_count: number;
  prompt: string | null;
  created_at: string;
};

type SketchPreview = {
  id: string;
  prompt: string | null;
  snapshot_url: string | null;
  created_at: string;
  banner_id: string | null;
};

// Deterministic pseudo-random so card rotations are stable across renders.
function jitter(seed: string, spread: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  const norm = ((h % 1000) / 1000 + 1) % 1; // 0..1
  return (norm - 0.5) * 2 * spread;
}

export default function CollageExperience({
  banners,
  sketches,
}: {
  banners: Banner[];
  sketches: SketchPreview[];
}) {
  const total = banners.length;

  // Latest banner lives at the end of the array (oldest → newest).
  const [index, setIndex] = useState(() => Math.max(0, total - 1));
  const [direction, setDirection] = useState<1 | -1>(1);

  const goTo = useCallback(
    (next: number) => {
      if (total === 0) return;
      const clamped = (next + total) % total;
      setDirection(
        clamped > index || (index === total - 1 && clamped === 0) ? 1 : -1,
      );
      setIndex(clamped);
    },
    [index, total],
  );

  const goPrev = useCallback(() => {
    if (total === 0) return;
    setDirection(-1);
    setIndex((i) => (i - 1 + total) % total);
  }, [total]);

  const goNext = useCallback(() => {
    if (total === 0) return;
    setDirection(1);
    setIndex((i) => (i + 1) % total);
  }, [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  const currentBannerId = total > 0 ? banners[index].id : null;

  // Each sketch is attributed to the first banner that consumed it via
  // turtle_drawings.banner_id, so this filter is now exact.
  const visibleSketches = useMemo(() => {
    if (!currentBannerId) return [];
    return sketches.filter(
      (s) => s.snapshot_url && s.banner_id === currentBannerId,
    );
  }, [sketches, currentBannerId]);

  if (total === 0) {
    return <EmptyState />;
  }

  const current = banners[index];
  const isLatest = index === total - 1;
  const dateLong = new Date(current.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="relative min-h-screen pb-28 md:pb-16">
      {/* warm scrapbook wall wash */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgb(var(--accent-purple)/0.06),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_78%,rgb(var(--accent-orange)/0.06),transparent_55%)]" />

      <section className="relative z-10 max-w-5xl mx-auto px-6 md:px-8 pt-16 md:pt-24">
        {/* ── handwritten header, scribbled at the top of the wall ── */}
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative mb-16 md:mb-24 text-center"
        >
          <Doodle
            name="scribble"
            tone="purple"
            className="absolute -left-2 -top-6 h-10 w-10 opacity-70 md:left-8"
            strokeWidth={2.5}
          />
          <Doodle
            name="star"
            tone="orange"
            className="absolute right-2 -top-4 h-6 w-6 md:right-10"
            strokeWidth={2}
          />
          <span className="mb-1 block -rotate-2 font-hand text-2xl text-accent-rust">
            pinned to the wall —
          </span>
          <h1 className="relative inline-block font-serif text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight text-ink">
            the collage<span className="text-accent-orange">.</span>
            <Doodle
              name="underline"
              tone="orange"
              className="absolute -bottom-3 left-0 h-4 w-full"
              strokeWidth={3}
              draw
            />
          </h1>
          <p className="mt-7 font-hand text-2xl md:text-3xl -rotate-1 text-ink-soft max-w-md mx-auto leading-snug">
            every night, your doodles become one painting.
          </p>
        </motion.header>

        {/* ── the framed nightly artwork, taped to the page ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="relative"
        >
          {/* warm wash bleeding through the paper behind the frame */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-6 -top-6 -bottom-10 bg-[radial-gradient(ellipse_at_30%_30%,rgb(var(--accent-purple)/0.12),transparent_60%),radial-gradient(ellipse_at_75%_75%,rgb(var(--accent-orange)/0.1),transparent_60%)] blur-2xl"
          />

          <div className="relative">
            {/* Side chevrons floating just outside the frame on desktop */}
            {total > 1 && (
              <>
                <NavButton
                  onClick={goPrev}
                  direction="left"
                  className="absolute left-0 top-1/2 z-30 hidden -translate-x-[calc(100%+1.5rem)] -translate-y-1/2 md:flex"
                />
                <NavButton
                  onClick={goNext}
                  direction="right"
                  className="absolute right-0 top-1/2 z-30 hidden translate-x-[calc(100%+1.5rem)] -translate-y-1/2 md:flex"
                />
              </>
            )}

            {/* the taped polaroid-style frame */}
            <div className="relative mx-auto max-w-3xl -rotate-[0.8deg] bg-card p-3 pb-5 shadow-paper-lg sm:p-4 sm:pb-6 [border:1px_solid_rgb(var(--line))] transition-transform duration-300 hover:rotate-0">
              {/* tape at the corners */}
              <Tape tone="orange" rotate={-8} className="-top-3 left-8 sm:left-12" width={92} />
              <Tape tone="purple" rotate={7} className="-top-3 right-8 sm:right-12" width={92} />
              <PaperClip className="-top-5 left-1/2 -translate-x-1/2" rotate={4} tone="ink" />

              <div className="relative aspect-[3/2] w-full overflow-hidden border border-ink/15 bg-paper-2">
                <AnimatePresence mode="popLayout" custom={direction}>
                  <motion.div
                    key={current.id}
                    custom={direction}
                    variants={{
                      enter: (d: number) => ({
                        opacity: 0,
                        x: d > 0 ? 30 : -30,
                      }),
                      center: { opacity: 1, x: 0 },
                      exit: (d: number) => ({
                        opacity: 0,
                        x: d > 0 ? -30 : 30,
                      }),
                    }}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
                    className="absolute inset-0"
                  >
                    <Image
                      src={current.image_url}
                      alt={`collage from ${dateLong}`}
                      fill
                      priority={isLatest}
                      sizes="(min-width: 1024px) 1024px, 100vw"
                      className="object-cover"
                    />
                  </motion.div>
                </AnimatePresence>

                {/* Faint inner edge for depth */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-ink/10"
                />

                {/* Mobile tap zones */}
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={total < 2}
                  aria-label="previous"
                  className="absolute inset-y-0 left-0 z-10 w-1/3 md:hidden"
                />
                <button
                  type="button"
                  onClick={goNext}
                  disabled={total < 2}
                  aria-label="next"
                  className="absolute inset-y-0 right-0 z-10 w-1/3 md:hidden"
                />
              </div>

              {/* hand caption written under the frame */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.4 }}
                  className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1"
                >
                  <span className="font-hand text-2xl text-ink-soft">
                    {isLatest ? "tonight's painting" : dateLong}
                  </span>
                  <span className="flex items-baseline gap-2 font-hand text-xl text-ink-faint">
                    <span className="text-accent-orange tabular-nums">
                      {current.sketch_count}
                    </span>
                    hands
                    {isLatest && (
                      <Stamp tone="orange" rotate={-5} className="ml-1">
                        latest
                      </Stamp>
                    )}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* counter, scrawled below */}
            {total > 1 && (
              <div className="mt-5 text-center">
                <HandNote tone="rust" rotate={-2} className="text-xl tabular-nums">
                  {String(index + 1).padStart(2, "0")} of{" "}
                  {String(total).padStart(2, "0")} nights
                </HandNote>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── thumbnail strip: small pinned snapshots ── */}
        {total > 1 && (
          <ThumbnailStrip
            banners={banners}
            currentIndex={index}
            onSelect={goTo}
          />
        )}

        {/* ── the wall of contributor sketches ── */}
        {visibleSketches.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative mt-24 md:mt-32"
          >
            <div className="mb-10 text-center">
              <div className="mb-3 flex items-center justify-center gap-3" aria-hidden>
                <Doodle name="squiggle" tone="purple" className="h-4 w-24" strokeWidth={2.5} />
              </div>
              <h2 className="font-serif text-2xl md:text-3xl font-medium text-ink">
                the doodles that made it
              </h2>
              <p className="mt-1 font-hand text-xl -rotate-1 text-accent-rust tabular-nums">
                {visibleSketches.length}{" "}
                {visibleSketches.length === 1 ? "hand" : "hands"} on the wall
              </p>
            </div>
            <SketchWall key={current.id} sketches={visibleSketches} />
          </motion.section>
        )}

        {/* ── leave a sketch CTA, torn note ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="relative mx-auto mt-28 md:mt-36 max-w-md"
        >
          <div className="relative rounded-[3px] border border-line bg-card px-7 py-9 text-center shadow-paper">
            <TornEdge position="top" />
            <TornEdge position="bottom" />
            <PaperClip className="-top-4 right-7" rotate={11} tone="rust" />
            <Doodle
              name="arrow"
              tone="orange"
              className="absolute -left-3 top-6 h-7 w-12 -rotate-12 md:-left-10"
              strokeWidth={2.5}
            />
            <p className="font-serif text-base italic text-ink-soft mb-6 leading-relaxed">
              leave a sketch in the booth. if the council lets it through, it
              lands in tomorrow&apos;s painting.
            </p>
            <Link href="/connect" className="btn-sketch btn-sketch-solid group">
              leave a sketch
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </motion.div>
      </section>
    </main>
  );
}

function NavButton({
  onClick,
  direction,
  className,
}: {
  onClick: () => void;
  direction: "left" | "right";
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "left" ? "previous" : "next"}
      className={`flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-line bg-card/80 text-ink-soft backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-orange/60 hover:bg-card hover:text-accent-orange ${className ?? ""}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4 h-4"
        aria-hidden
      >
        {direction === "left" ? (
          <path d="M15 18l-6-6 6-6" />
        ) : (
          <path d="M9 6l6 6-6 6" />
        )}
      </svg>
    </button>
  );
}

function ThumbnailStrip({
  banners,
  currentIndex,
  onSelect,
}: {
  banners: Banner[];
  currentIndex: number;
  onSelect: (index: number) => void;
}) {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const node = itemRefs.current[currentIndex];
    if (!node) return;
    node.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [currentIndex]);

  return (
    <div className="mt-16 md:mt-20">
      <p className="mb-4 text-center font-hand text-xl -rotate-1 text-ink-faint">
        every night, flip through —
      </p>
      <div className="scrollbar-hide ios-momentum-scroll -mx-6 md:-mx-8 flex snap-x items-start gap-4 overflow-x-auto px-6 md:px-8 py-4">
        {banners.map((banner, i) => {
          const isActive = i === currentIndex;
          const rot = jitter(banner.id, 3.5);
          return (
            <button
              key={banner.id}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              onClick={() => onSelect(i)}
              aria-label={`view collage ${i + 1}`}
              aria-current={isActive ? "true" : undefined}
              className="group relative shrink-0 snap-center text-left"
              style={{ transform: `rotate(${isActive ? 0 : rot}deg)` }}
            >
              {/* a small pin of tape over each pinned thumbnail */}
              <Tape
                tone={isActive ? "orange" : "ink"}
                rotate={isActive ? -6 : 8}
                width={40}
                className="-top-2 left-1/2 -translate-x-1/2"
                style={{ opacity: isActive ? 0.95 : 0.55 }}
              />
              <div
                className={`relative aspect-[3/2] w-24 sm:w-28 overflow-hidden bg-card p-1.5 transition-all duration-300 ${
                  isActive
                    ? "shadow-[3px_4px_0_rgb(var(--accent-orange)/0.4)] [border:1.5px_solid_rgb(var(--accent-orange))]"
                    : "opacity-70 group-hover:opacity-100 [border:1px_solid_rgb(var(--line))] group-hover:[border-color:rgb(var(--fg)/0.4)]"
                }`}
              >
                {/* dog-ear on the active thumbnail */}
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute right-0 top-0 z-10 h-0 w-0 border-l-[14px] border-l-transparent border-t-[14px]"
                    style={{ borderTopColor: "rgb(var(--accent-orange))" }}
                  />
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={banner.image_url}
                  alt={`collage ${i + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>
              <span
                className={`mt-2 block text-center tabular-nums transition-colors duration-300 ${
                  isActive
                    ? "font-hand text-base text-accent-orange"
                    : "font-hand text-sm text-ink-faint group-hover:text-ink-soft"
                }`}
              >
                {formatShortDate(banner.created_at)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SketchWall({ sketches }: { sketches: SketchPreview[] }) {
  return (
    <div className="relative flex flex-wrap items-start justify-center gap-x-6 gap-y-10 px-1 sm:gap-x-8 sm:gap-y-12">
      {sketches.map((sketch) => (
        <SketchCard key={sketch.id} sketch={sketch} />
      ))}
    </div>
  );
}

const PIN_TONES = ["orange", "purple", "rust"] as const;

function SketchCard({ sketch }: { sketch: SketchPreview }) {
  const rot = jitter(sketch.id, 5);
  const tone = PIN_TONES[Math.abs(Math.round(jitter(sketch.id + "t", 100))) % 3];

  return (
    <figure
      className="group relative w-32 shrink-0 bg-card p-2 pb-1 shadow-paper transition-transform duration-300 hover:!rotate-0 hover:-translate-y-1 sm:w-40 [border:1px_solid_rgb(var(--line))]"
      style={{ transform: `rotate(${rot}deg)` }}
    >
      <Tape
        tone={tone}
        rotate={rot < 0 ? 6 : -6}
        width={48}
        className="-top-2.5 left-1/2 -translate-x-1/2"
      />
      <DoodleTile
        snapshotUrl={sketch.snapshot_url}
        prompt={sketch.prompt}
        className="border border-ink/10"
      />
      {sketch.prompt && (
        <figcaption
          title={sketch.prompt}
          className="mt-1.5 px-0.5 text-center font-hand text-base leading-tight text-ink-soft line-clamp-2"
        >
          {sketch.prompt}
        </figcaption>
      )}
    </figure>
  );
}

function EmptyState() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 pb-28 text-center md:pb-16">
      <div className="relative rounded-[3px] border border-line bg-card px-10 py-12 shadow-paper-lg -rotate-1">
        <TornEdge position="top" />
        <TornEdge position="bottom" />
        <Tape tone="orange" rotate={-7} className="-top-3 left-10" width={90} />
        <Tape tone="purple" rotate={6} className="-top-3 right-10" width={90} />
        <span className="mb-2 inline-block -rotate-2 font-hand text-2xl text-accent-rust">
          pinned to the wall —
        </span>
        <h1 className="font-serif text-5xl md:text-7xl font-medium tracking-tight mb-5 text-ink">
          the collage<span className="text-accent-orange">.</span>
        </h1>
        <p className="font-hand text-2xl text-ink-soft mb-10 max-w-md">
          the wall is bare. be the first to pin something up.
        </p>
        <Link href="/connect" className="btn-sketch btn-sketch-solid group">
          leave the first sketch
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1"
            aria-hidden
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
    </main>
  );
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
