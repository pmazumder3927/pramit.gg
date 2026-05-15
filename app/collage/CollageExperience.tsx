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
    <main className="relative min-h-screen">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(120,119,198,0.04),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_75%,rgba(255,107,61,0.03),transparent_55%)]" />

      <section className="relative z-10 max-w-5xl mx-auto px-6 md:px-8 pt-16 md:pt-24 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 md:mb-16"
        >
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-extralight tracking-tight mb-5">
            <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
              collage
            </span>
          </h1>
          <p className="text-base md:text-lg text-white/40 font-light max-w-md mx-auto leading-relaxed">
            every sketch left in the booth gets painted into one image
            overnight.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="relative"
        >
          {/* Candlelit glow — purple velvet & gold flame, picked from the council scene */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-6 -top-6 -bottom-10 bg-[radial-gradient(ellipse_at_30%_30%,rgba(122,76,214,0.14),transparent_60%),radial-gradient(ellipse_at_75%_75%,rgba(255,211,109,0.08),transparent_60%)] blur-2xl"
          />

          <div className="relative">
            {/* Side chevrons floating just outside the frame on desktop */}
            {total > 1 && (
              <>
                <NavButton
                  onClick={goPrev}
                  direction="left"
                  className="absolute left-0 top-1/2 z-20 hidden -translate-x-[calc(100%+1.25rem)] -translate-y-1/2 md:flex"
                />
                <NavButton
                  onClick={goNext}
                  direction="right"
                  className="absolute right-0 top-1/2 z-20 hidden translate-x-[calc(100%+1.25rem)] -translate-y-1/2 md:flex"
                />
              </>
            )}

            <div className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] shadow-[0_30px_120px_-40px_rgba(122,76,214,0.4)]">
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
                className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.04]"
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

            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.4 }}
                className="mt-5 flex items-center justify-between gap-4"
              >
                <div className="flex items-baseline gap-3 text-sm font-light">
                  <span className="text-white/70 tabular-nums">
                    {current.sketch_count}
                  </span>
                  <span className="text-white/40">sketches</span>
                  <span className="h-1 w-1 rounded-full bg-white/20" />
                  <span className="text-white/40">{dateLong}</span>
                  {isLatest && (
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[#ffd36d]/80 font-light">
                      latest
                    </span>
                  )}
                </div>
                {total > 1 && (
                  <span className="text-xs font-light tabular-nums text-white/30">
                    {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

        {total > 1 && (
          <ThumbnailStrip
            banners={banners}
            currentIndex={index}
            onSelect={goTo}
          />
        )}

        {visibleSketches.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-24 md:mt-32"
          >
            <SectionDivider />
            <div className="text-center mb-8 mt-12">
              <h2 className="text-2xl md:text-3xl font-extralight text-white/80 mb-2">
                the sketches behind it
              </h2>
              <p className="text-white/40 font-light text-sm tabular-nums">
                {visibleSketches.length} hands
              </p>
            </div>
            <SketchRiver key={current.id} sketches={visibleSketches} />
          </motion.section>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-28 md:mt-36 text-center"
        >
          <p className="text-white/40 font-light text-sm mb-6 max-w-sm mx-auto leading-relaxed">
            leave a sketch in the booth. if the council lets it through it
            lands in tomorrow&apos;s.
          </p>
          <Link
            href="/connect"
            className="group inline-flex items-center gap-3 px-7 py-3.5 bg-white/[0.04] border border-white/10 rounded-full text-white/80 text-sm font-light hover:bg-white/[0.08] hover:border-white/25 hover:text-white transition-all duration-300"
          >
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
      className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-black/40 text-white/50 backdrop-blur-md transition-all duration-300 hover:border-white/25 hover:bg-black/70 hover:text-white ${className ?? ""}`}
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

function SectionDivider() {
  return (
    <div className="flex items-center justify-center gap-3" aria-hidden>
      <span className="h-px w-16 bg-gradient-to-r from-transparent to-white/15" />
      <span className="h-1.5 w-1.5 rounded-full bg-[#ffd36d]/50" />
      <span className="h-px w-16 bg-gradient-to-l from-transparent to-white/15" />
    </div>
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
    <div className="mt-12 md:mt-14">
      <div className="scrollbar-hide ios-momentum-scroll -mx-6 md:-mx-8 flex snap-x gap-3 overflow-x-auto px-6 md:px-8 py-3">
        {banners.map((banner, i) => {
          const isActive = i === currentIndex;
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
            >
              <div
                className={`relative aspect-[3/2] w-24 sm:w-28 overflow-hidden rounded-lg border transition-all duration-300 ${
                  isActive
                    ? "border-[#ffd36d]/60 opacity-100 shadow-[0_10px_30px_-12px_rgba(255,211,109,0.45)]"
                    : "border-white/[0.06] opacity-50 group-hover:opacity-90 group-hover:border-white/20"
                }`}
              >
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
                className={`mt-2 block text-center text-[10px] font-light tabular-nums transition-colors duration-300 ${
                  isActive ? "text-[#ffd36d]/80" : "text-white/25 group-hover:text-white/40"
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

function SketchRiver({ sketches }: { sketches: SketchPreview[] }) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 sm:w-16 bg-gradient-to-r from-[#000105] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 sm:w-16 bg-gradient-to-l from-[#000105] to-transparent" />

      <div className="scrollbar-hide ios-momentum-scroll -mx-6 md:-mx-8 flex gap-3 overflow-x-auto px-6 md:px-8 py-2">
        {sketches.map((sketch) => (
          <SketchTile key={sketch.id} sketch={sketch} />
        ))}
      </div>
    </div>
  );
}

function SketchTile({ sketch }: { sketch: SketchPreview }) {
  return (
    <figure className="shrink-0 w-32 sm:w-40">
      <div className="relative aspect-[3/2] overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02] transition-all duration-300 hover:border-white/20 hover:scale-[1.02]">
        {sketch.snapshot_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sketch.snapshot_url}
            alt={sketch.prompt ?? "sketch"}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        )}
      </div>
    </figure>
  );
}

function EmptyState() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-5xl md:text-7xl font-extralight tracking-tight mb-5">
        <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
          collage
        </span>
      </h1>
      <p className="text-white/40 font-light mb-10 max-w-md">
        no sketches yet. be the first.
      </p>
      <Link
        href="/connect"
        className="group inline-flex items-center gap-3 px-7 py-3.5 bg-white/[0.04] border border-white/10 rounded-full text-white/80 text-sm font-light hover:bg-white/[0.08] hover:border-white/25 hover:text-white transition-all duration-300"
      >
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
    </main>
  );
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
