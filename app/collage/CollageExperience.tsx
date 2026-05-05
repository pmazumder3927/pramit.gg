"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";

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
};

const PALETTE = {
  "--ink": "rgba(237, 229, 211, 0.92)",
  "--ink-dim": "rgba(237, 229, 211, 0.55)",
  "--ink-faint": "rgba(237, 229, 211, 0.32)",
  "--ink-trace": "rgba(237, 229, 211, 0.14)",
  "--gilt": "rgba(244, 220, 168, 0.92)",
  "--gilt-soft": "rgba(244, 220, 168, 0.55)",
  "--void": "#000105",
} as CSSProperties;

export default function CollageExperience({
  banner,
  sketches,
}: {
  banner: Banner | null;
  sketches: SketchPreview[];
}) {
  const reduce = useReducedMotion();

  if (!banner) {
    return <EmptyExhibit />;
  }

  const exhibitNumber = String(Math.max(1, banner.sketch_count))
    .padStart(3, "0");
  const dateLong = new Date(banner.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const updatedLabel = formatRelative(banner.created_at);
  const visibleSketches = sketches.filter((s) => s.snapshot_url);

  return (
    <main
      className="relative min-h-screen overflow-x-hidden text-[var(--ink)]"
      style={PALETTE}
    >
      {/* Faint stellar grain over everything */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.07] mix-blend-screen"
        style={{
          backgroundImage:
            "radial-gradient(circle at 18% 22%, rgba(244,220,168,0.45), transparent 55%), radial-gradient(circle at 82% 78%, rgba(124,119,198,0.35), transparent 60%)",
        }}
      />

      <section className="relative mx-auto w-full max-w-[110rem] px-5 pt-24 sm:px-8 md:pt-28 lg:px-14">
        {/* Top exhibit ribbon */}
        <header className="mb-10 grid grid-cols-12 items-start gap-4 text-[10px] font-light uppercase text-[var(--ink-dim)] [font-family:var(--font-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace)] md:mb-14">
          <div className="col-span-6 flex flex-col gap-1 md:col-span-3">
            <span className="tracking-[0.32em] text-[var(--ink-faint)]">
              exhibit №
            </span>
            <span className="text-2xl font-extralight tracking-[0.14em] text-[var(--gilt)] tabular-nums">
              {exhibitNumber}
            </span>
          </div>
          <div className="col-span-12 hidden flex-col items-center gap-2 text-center md:col-span-6 md:flex">
            <span className="h-px w-12 bg-[var(--ink-faint)]" />
            <span className="tracking-[0.5em] text-[var(--ink-dim)]">
              painted nocturne
            </span>
            <span className="tracking-[0.32em] text-[var(--ink-faint)]">
              the collective dream
            </span>
          </div>
          <div className="col-span-6 flex flex-col items-end gap-1 text-right md:col-span-3">
            <span className="tracking-[0.32em] text-[var(--ink)]">
              {updatedLabel}
            </span>
            <span className="tracking-[0.32em] text-[var(--ink-faint)]">
              by gpt-image-2
            </span>
          </div>
        </header>

        {/* The painting */}
        <figure className="relative">
          {/* Corner brackets — tiny gallery hardware */}
          <Bracket className="-left-2 -top-2 border-l border-t md:-left-3 md:-top-3" />
          <Bracket className="-right-2 -top-2 border-r border-t md:-right-3 md:-top-3" />
          <Bracket className="-bottom-2 -left-2 border-b border-l md:-bottom-3 md:-left-3" />
          <Bracket className="-bottom-2 -right-2 border-b border-r md:-bottom-3 md:-right-3" />

          {/* The actual frame: a cinematic letterbox */}
          <motion.div
            initial={{ opacity: 0, scale: 1.05, filter: "blur(24px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative aspect-[3/2] w-full overflow-hidden"
          >
            <motion.div
              animate={
                reduce
                  ? undefined
                  : {
                      scale: [1, 1.06, 1],
                      x: ["0%", "-1%", "0%"],
                      y: ["0%", "0.8%", "0%"],
                    }
              }
              transition={{
                duration: 64,
                ease: "easeInOut",
                repeat: Infinity,
              }}
              className="absolute inset-0"
            >
              <Image
                src={banner.image_url}
                alt="painted nocturne composed of confessional sketches"
                fill
                priority
                sizes="(min-width: 1280px) 1280px, 100vw"
                className="object-cover"
              />
            </motion.div>

            {/* Vignette + moonlight gleam */}
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(0,1,5,0.55)_88%,rgba(0,1,5,0.95)_100%)]"
            />
            <div
              aria-hidden
              className="absolute -top-1/4 left-1/3 h-2/3 w-1/2 rounded-full bg-[radial-gradient(circle,rgba(244,220,168,0.18),transparent_70%)] blur-3xl"
            />

            {/* Tiny floating "exhibit lighting" particles */}
            {!reduce && (
              <div aria-hidden className="absolute inset-0">
                {[...Array(7)].map((_, i) => (
                  <motion.span
                    key={i}
                    className="absolute block h-[3px] w-[3px] rounded-full bg-[var(--gilt)]"
                    style={{
                      left: `${(i * 137) % 100}%`,
                      top: `${(i * 73) % 100}%`,
                      filter: "blur(0.4px)",
                    }}
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: [0, 0.6, 0],
                      y: [0, -12, -24],
                    }}
                    transition={{
                      duration: 8 + i * 1.3,
                      repeat: Infinity,
                      delay: i * 1.7,
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </div>
            )}
          </motion.div>

          {/* The little brass plaque under the frame */}
          <figcaption className="mt-5 flex items-center justify-between text-[10px] font-light uppercase tracking-[0.32em] text-[var(--ink-faint)] [font-family:var(--font-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace)]">
            <span>{banner.sketch_count} sketches woven into one scene</span>
            <span className="hidden md:inline">·</span>
            <span className="text-[var(--ink-dim)]">
              <time dateTime={banner.created_at}>{dateLong}</time>
            </span>
          </figcaption>
        </figure>

        {/* Editorial spread — title + dossier */}
        <div className="mt-20 grid grid-cols-12 gap-y-12 md:mt-28 md:gap-x-16">
          <div className="col-span-12 md:col-span-7">
            <p className="mb-6 flex items-center gap-3 text-[10px] font-light uppercase tracking-[0.32em] text-[var(--ink-faint)] [font-family:var(--font-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace)]">
              <span className="inline-block h-px w-10 bg-[var(--ink-faint)]" />
              the confessional booth
            </p>
            <h1
              className="font-normal leading-[0.82] tracking-[-0.025em] text-[var(--ink)] [font-family:var(--font-instrument-serif),ui-serif,Georgia,serif]"
              style={{ fontSize: "clamp(4rem, 13vw, 11rem)" }}
            >
              <motion.span
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.2 }}
                className="block"
              >
                the
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.45 }}
                className="block italic text-[var(--gilt)]"
              >
                collage<span className="text-[var(--gilt-soft)]">.</span>
              </motion.span>
            </h1>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.65 }}
            className="col-span-12 md:col-span-5 md:pt-10"
          >
            <p className="max-w-md text-base font-light leading-[1.75] text-[var(--ink-dim)] md:text-[17px]">
              every confession comes with a sketch. they wash up here,
              <em className="not-italic text-[var(--ink)]"> painted nightly </em>
              into one cohesive nocturne — a moonlit landscape composed
              entirely of strangers' marks.
            </p>

            <dl className="mt-10 grid max-w-sm grid-cols-[7rem_1fr] gap-y-4 border-t border-[var(--ink-trace)] pt-7 text-[10px] font-light uppercase tracking-[0.28em] [font-family:var(--font-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace)]">
              <dt className="text-[var(--ink-faint)]">sketches</dt>
              <dd className="text-[var(--gilt)] tabular-nums">
                {banner.sketch_count}
              </dd>
              <dt className="text-[var(--ink-faint)]">painted</dt>
              <dd className="text-[var(--ink)]">{dateLong}</dd>
              <dt className="text-[var(--ink-faint)]">medium</dt>
              <dd className="text-[var(--ink)]">ink + watercolor wash</dd>
              <dt className="text-[var(--ink-faint)]">cadence</dt>
              <dd className="text-[var(--ink)]">renewed nightly</dd>
            </dl>
          </motion.div>
        </div>
      </section>

      {/* The credit roll — every contributor's actual mark */}
      {visibleSketches.length > 0 && (
        <section className="relative mt-28 border-y border-[var(--ink-trace)] bg-[rgba(0,0,0,0.35)] py-12 md:mt-36">
          <div className="mb-8 flex items-end justify-between gap-6 px-5 text-[10px] font-light uppercase tracking-[0.32em] text-[var(--ink-faint)] sm:px-8 lg:px-14 [font-family:var(--font-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace)]">
            <div className="flex items-center gap-3">
              <span className="inline-block h-px w-10 bg-[var(--ink-faint)]" />
              <span>the contributors</span>
            </div>
            <span className="text-[var(--ink-dim)] tabular-nums">
              {visibleSketches.length} on view
            </span>
          </div>

          <SketchRiver sketches={visibleSketches} reduce={!!reduce} />

          <p className="mt-8 px-5 text-center text-[10px] font-light uppercase tracking-[0.36em] text-[var(--ink-faint)] sm:px-8 lg:px-14 [font-family:var(--font-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace)]">
            hover to pause · each mark left by a different hand
          </p>
        </section>
      )}

      {/* Guestbook CTA */}
      <section className="relative px-5 py-32 text-center sm:px-8 lg:px-14 md:py-40">
        <div className="mx-auto max-w-2xl">
          <p className="flex items-center justify-center gap-3 text-[10px] font-light uppercase tracking-[0.36em] text-[var(--ink-faint)] [font-family:var(--font-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace)]">
            <span className="inline-block h-px w-8 bg-[var(--ink-faint)]" />
            visitors&rsquo; book
            <span className="inline-block h-px w-8 bg-[var(--ink-faint)]" />
          </p>
          <h2
            className="mt-6 font-normal leading-[0.95] tracking-[-0.015em] text-[var(--ink)] [font-family:var(--font-instrument-serif),ui-serif,Georgia,serif]"
            style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)" }}
          >
            sign the next <em className="text-[var(--gilt)]">painting</em>.
          </h2>
          <p className="mx-auto mt-6 max-w-md text-sm font-light leading-[1.7] text-[var(--ink-dim)] md:text-base">
            leave a sketch in the booth. when enough hands have passed
            through, a new nocturne paints itself overnight.
          </p>

          <Link
            href="/connect"
            className="group relative mt-12 inline-flex items-center gap-4 text-[11px] font-light uppercase tracking-[0.36em] text-[var(--gilt)] transition-colors duration-300 hover:text-[var(--ink)] [font-family:var(--font-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace)]"
          >
            <span className="relative pb-2">
              enter the booth
              <span className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-100 bg-[var(--gilt)]/40 transition-all duration-500 group-hover:bg-[var(--ink)]" />
            </span>
            <span
              aria-hidden
              className="inline-block transition-transform duration-500 group-hover:translate-x-2"
            >
              ⟶
            </span>
          </Link>
        </div>
      </section>

      <footer className="border-t border-[var(--ink-trace)] px-5 py-10 text-center text-[9px] font-light uppercase tracking-[0.4em] text-[var(--ink-faint)] sm:px-8 lg:px-14 [font-family:var(--font-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace)]">
        ⌬ a hall that changes when you visit it
      </footer>
    </main>
  );
}

function Bracket({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute z-10 h-4 w-4 border-[var(--ink-faint)] md:h-6 md:w-6 ${className}`}
    />
  );
}

function SketchRiver({
  sketches,
  reduce,
}: {
  sketches: SketchPreview[];
  reduce: boolean;
}) {
  const items = [...sketches, ...sketches];

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[var(--void)] to-transparent sm:w-40" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[var(--void)] to-transparent sm:w-40" />

      <div
        className={`flex w-max items-end gap-7 ${
          reduce ? "" : "animate-collage-marquee hover:[animation-play-state:paused]"
        }`}
        style={{ willChange: "transform" }}
      >
        {items.map((sketch, i) => (
          <SketchTile
            key={`${sketch.id}-${i}`}
            sketch={sketch}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}

function SketchTile({
  sketch,
  index,
}: {
  sketch: SketchPreview;
  index: number;
}) {
  // Deterministic gentle tilt + lift per item
  const seed = sketch.id.charCodeAt(0) + sketch.id.charCodeAt(2) + index;
  const tilt = ((seed % 9) - 4) * 0.7;
  const lift = (seed % 5) * 4;

  return (
    <figure
      className="group relative shrink-0 w-[150px] sm:w-[180px] md:w-[210px]"
      style={{
        transform: `translateY(-${lift}px) rotate(${tilt}deg)`,
      }}
    >
      <div className="relative aspect-[3/2] overflow-hidden border border-[var(--ink-trace)] bg-[#05050a] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)] transition-all duration-500 group-hover:scale-[1.06] group-hover:border-[var(--gilt-soft)] group-hover:shadow-[0_30px_80px_-30px_rgba(244,220,168,0.35)]">
        {sketch.snapshot_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sketch.snapshot_url}
            alt={sketch.prompt ?? "sketch"}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_center,rgba(244,220,168,0.05),transparent_70%)]" />
        )}
        {/* Top-right "filed" stamp */}
        <span className="absolute right-1.5 top-1.5 text-[8px] font-light uppercase tracking-[0.22em] text-[var(--ink-faint)] mix-blend-screen [font-family:var(--font-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace)]">
          №{String((seed * 13) % 999).padStart(3, "0")}
        </span>
      </div>
      <figcaption className="mt-2.5 flex items-baseline justify-between gap-2 text-[10px] font-light uppercase tracking-[0.18em] text-[var(--ink-faint)] [font-family:var(--font-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace)]">
        <span className="truncate text-[var(--ink-dim)]">
          {sketch.prompt?.trim() || "untitled"}
        </span>
        <span className="shrink-0 tabular-nums text-[var(--ink-faint)]">
          {formatShortDate(sketch.created_at)}
        </span>
      </figcaption>
    </figure>
  );
}

function EmptyExhibit() {
  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center"
      style={PALETTE}
    >
      <p className="text-[10px] font-light uppercase tracking-[0.36em] text-[var(--ink-faint)] [font-family:var(--font-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace)]">
        exhibit closed
      </p>
      <h1
        className="mt-6 font-normal italic text-[var(--ink)] [font-family:var(--font-instrument-serif),ui-serif,Georgia,serif]"
        style={{ fontSize: "clamp(3rem, 9vw, 6rem)" }}
      >
        the room is empty.
      </h1>
      <p className="mt-6 max-w-md text-sm font-light leading-relaxed text-[var(--ink-dim)]">
        no nocturne has been painted yet. once a few sketches land in
        the booth, this hall fills itself.
      </p>
      <Link
        href="/connect"
        className="mt-10 inline-flex items-center gap-3 text-[11px] font-light uppercase tracking-[0.36em] text-[var(--gilt)] [font-family:var(--font-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace)]"
      >
        <span className="border-b border-[var(--gilt)]/40 pb-1">
          be the first to leave a mark
        </span>
        <span aria-hidden>⟶</span>
      </Link>
    </main>
  );
}

function formatRelative(dateString: string) {
  const then = new Date(dateString).getTime();
  if (!Number.isFinite(then)) return "";
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just painted";
  if (minutes < 60) return `painted ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `painted ${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `painted ${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `painted ${months}mo ago`;
  const years = Math.round(months / 12);
  return `painted ${years}y ago`;
}

function formatShortDate(dateString: string) {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
