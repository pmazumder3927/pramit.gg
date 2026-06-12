"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Post, analyzeContent } from "@/app/lib/supabase";
import { POST_TYPE_META, POST_TYPE_FILTERS } from "@/app/lib/postTypes";
import { useNowPlayingContext } from "@/app/components/NowPlayingContext";
import { ChaosDecor, Tape, Stamp, Doodle } from "@/app/components/sketchbook";
import { chaosFor, paperTextureStyle } from "@/app/lib/chaos";

// evergreen, owner-editable
const CURRENTLY = [
  "rebuilding this site (again)",
  "climbing plastic",
  "learning guitar",
];

function fmtDate(iso: string) {
  try {
    return format(new Date(iso), "MMM ''yy").toLowerCase();
  } catch {
    return "";
  }
}

function NowSpinningCard() {
  const { track } = useNowPlayingContext();
  const playing = track?.isPlaying;
  // not playing, but the last song is still replaying through the scape
  const echoing = !playing && !!track?.playedAtMs && !!track?.duration;

  return (
    <Link
      href="/music"
      className="group relative block rounded-xl border border-line bg-card p-4 shadow-paper transition-transform duration-300 hover:-translate-y-1"
      style={{ rotate: "1.2deg" }}
    >
      <Tape tone="orange" rotate={-6} className="-top-3 left-6" width={64} />
      <div className="mb-3 flex items-center justify-between">
        <span
          className="font-hand text-xl"
          style={{ color: "rgb(var(--album-rgb))" }}
        >
          {playing ? "now spinning" : echoing ? "still echoing" : "last tune"}
        </span>
        <span className="eq-bars">
          <span
            className="h-1.5"
            style={{
              animationDelay: "0s",
              background: "rgb(var(--album-rgb))",
            }}
          />
          <span
            className="h-3"
            style={{
              animationDelay: ".18s",
              background: "rgb(var(--album-rgb))",
            }}
          />
          <span
            className="h-2"
            style={{
              animationDelay: ".36s",
              background: "rgb(var(--album-rgb))",
            }}
          />
          <span
            className="h-3.5"
            style={{
              animationDelay: ".5s",
              background: "rgb(var(--album-rgb))",
            }}
          />
        </span>
      </div>
      <div className="flex items-center gap-3.5">
        <div
          className="relative h-14 w-14 flex-none overflow-hidden rounded-lg border border-ink/15 bg-gradient-to-br from-accent-purple/40 to-accent-orange/30"
          style={{ boxShadow: "0 0 0 2px rgb(var(--album-rgb) / 0.4)" }}
        >
          {track?.albumImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={track.albumImageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="truncate font-serif text-[1.05rem] font-medium leading-tight text-ink">
            {track?.title ?? "An Ocean In Between the Waves"}
          </div>
          <div className="truncate text-sm text-ink-faint">
            {track?.artist ?? "The War on Drugs"}
          </div>
          <div className="truncate font-serif text-xs italic text-accent-purple">
            {track?.album ?? "Lost in the Dream"}
          </div>
        </div>
      </div>
      <span className="mt-3 flex items-center justify-end gap-1 font-hand text-base text-ink-faint transition-colors group-hover:text-accent-rust">
        wander into the music →
      </span>
    </Link>
  );
}

function CollageCard({
  bannerImage,
  sketchCount,
}: {
  bannerImage: string | null;
  sketchCount: number;
}) {
  return (
    <Link
      href="/collage"
      className="group relative block rounded-xl border border-line bg-card p-4 shadow-paper transition-transform duration-300 hover:-translate-y-1"
      style={{ rotate: "-1.4deg" }}
    >
      <Tape tone="purple" rotate={6} className="-top-3 right-6" width={64} />
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="font-hand text-xl text-accent-orange">
          tonight&apos;s collage
        </span>
        <Stamp tone="orange" rotate={-4}>
          {sketchCount > 0 ? `${sketchCount} contributions` : "open"}
        </Stamp>
      </div>
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-ink/15 bg-paper-2">
        {bannerImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bannerImage}
              alt="last night's collage"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
            <span className="absolute bottom-1.5 left-1.5 rounded-full bg-paper/85 px-2.5 py-0.5 font-hand text-sm text-ink backdrop-blur-sm">
              last painting
            </span>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-hand text-xl -rotate-3 text-ink-faint">
              your sketch here ✎
            </span>
          </div>
        )}
      </div>
      <p className="mt-2.5 font-serif text-sm italic leading-snug text-ink-soft">
        leave a little drawing if you please{" "}
        <span className="text-accent-rust transition-colors group-hover:text-accent-orange">
          add yours →
        </span>
      </p>
    </Link>
  );
}

export default function SketchbookHome({
  posts,
  bannerImage,
  sketchCount,
}: {
  posts: Post[];
  bannerImage: string | null;
  sketchCount: number;
}) {
  const [filter, setFilter] = useState<"all" | Post["type"]>("all");

  const shown = useMemo(
    () => (filter === "all" ? posts : posts.filter((p) => p.type === filter)),
    [posts, filter],
  );

  return (
    <main className="relative mx-auto max-w-6xl px-6 pb-24 pt-10 sm:px-10 md:pt-16">
      {/* ===================== TITLE PAGE ===================== */}
      <section className="grid gap-12 md:grid-cols-[1.55fr_0.9fr] md:items-start md:gap-16">
        {/* identity */}
        <div className="rise d1">
          <div className="flex items-center gap-2">
            <span className="font-hand text-2xl -rotate-2 text-accent-rust">
              welcome to the sketchbook
            </span>
            <Doodle
              name="star"
              tone="orange"
              className="h-5 w-5"
              strokeWidth={2}
            />
          </div>
          <h1 className="mt-2 font-serif text-[clamp(2.6rem,6.5vw,4.4rem)] font-medium leading-[0.96] tracking-tight text-ink">
            pramit mazumder<span className="text-accent-rust">.</span>
          </h1>
          <p className="mt-5 font-serif text-[clamp(1.35rem,3vw,2rem)] font-light leading-[1.12] text-ink-soft">
            a journal of interests, projects, &amp;{" "}
            <span className="relative inline-block">
              lived
              <svg
                className="absolute -bottom-2 left-0 h-3 w-[calc(100%+8px)] overflow-visible"
                viewBox="0 0 200 18"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path
                  className="ink-draw"
                  d="M3 11 C44 4 70 14 104 8 C140 2 168 13 197 6"
                  fill="none"
                  stroke="rgb(var(--accent-orange))"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>{" "}
            <em className="italic text-accent-purple">experiences.</em>
          </p>
          <p className="mt-6 max-w-md text-base leading-relaxed text-ink-faint">
            the sights, songs, and ramblings of a life in progress
          </p>

          <div className="mt-7 flex flex-wrap gap-3.5">
            <a href="#table" className="btn-sketch btn-sketch-solid">
              read latest post →
            </a>
            <Link href="/connect" className="btn-sketch">
              say hello
            </Link>
          </div>

          {/* currently — a little personality */}
          <div className="mt-10 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-dashed border-line pt-5">
            <span className="font-hand text-xl text-accent-purple">
              currently —
            </span>
            {CURRENTLY.map((item, i) => (
              <span key={item} className="text-sm text-ink-soft">
                {item}
                {i < CURRENTLY.length - 1 && (
                  <span className="px-1.5 text-ink-faint">·</span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* the desk — pinned cards */}
        <aside className="rise d2 flex flex-col gap-7 sm:flex-row md:flex-col">
          <div className="flex-1">
            <NowSpinningCard />
          </div>
          <div className="flex-1">
            <CollageCard bannerImage={bannerImage} sketchCount={sketchCount} />
          </div>
        </aside>
      </section>

      {/* ===================== THE TABLE (feed) ===================== */}
      <section id="table" className="mt-20 scroll-mt-20 md:mt-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="font-serif text-3xl font-medium text-ink">
              from the archives
            </h2>
            <span className="font-hand text-xl -rotate-2 text-accent-purple">
              — {posts.length} {posts.length === 1 ? "page" : "pages"}
            </span>
          </div>
          {/* filter chips */}
          <div className="flex flex-wrap gap-2.5">
            {POST_TYPE_FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition-all duration-200 ${
                    active
                      ? "border-ink bg-ink text-paper"
                      : "border-line text-ink-soft hover:border-ink/40 hover:text-ink"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="mt-10 font-hand text-2xl text-ink-faint">
            nothing here yet — check back soon ✎
          </p>
        ) : (
          <div className="mt-9 grid grid-cols-1 gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((post) => {
              const meta = POST_TYPE_META[post.type] ?? POST_TYPE_META.note;
              const { readingTime, previewText } = analyzeContent(
                post.content || "",
              );
              const preview = post.description || previewText;
              const c = chaosFor(post.id);
              return (
                <div
                  key={post.id}
                  className="relative"
                  style={{ transform: `rotate(${c.rotate}deg)` }}
                >
                  <Link
                    href={`/post/${post.slug}`}
                    className="sketch-card relative block overflow-visible p-5 pt-6"
                    style={paperTextureStyle(c.paper)}
                  >
                    <ChaosDecor chaos={c} />
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${meta.badge}`}
                      >
                        {meta.label}
                      </span>
                      <span className="font-hand text-lg text-ink-faint">
                        {fmtDate(post.created_at)}
                      </span>
                    </div>
                    <h3 className="relative inline font-serif text-[1.2rem] font-medium leading-snug text-ink">
                      {c.highlight && (
                        <span
                          aria-hidden
                          className="absolute -inset-x-1 bottom-0 -z-0 h-[0.55em] -rotate-1"
                          style={{
                            background: `rgb(var(--accent-${c.tone}) / 0.22)`,
                          }}
                        />
                      )}
                      <span className="relative">{post.title}</span>
                    </h3>
                    {preview ? (
                      <p className="mt-2 line-clamp-2 font-serif text-[0.92rem] italic leading-relaxed text-ink-soft">
                        {preview}
                      </p>
                    ) : null}
                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-dashed border-line pt-3">
                      <div className="flex flex-wrap gap-2">
                        {(post.tags || []).slice(0, 2).map((t) => (
                          <span
                            key={t}
                            className="text-xs font-medium text-accent-purple"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                      <span className="whitespace-nowrap text-xs text-ink-faint">
                        ~ {readingTime} min
                      </span>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="mt-24 flex flex-wrap items-center justify-between gap-5 border-t-2 border-ink/80 pt-7">
        <div>
          <div className="font-hand text-2xl text-ink">— pramit ✦mazumder</div>
          <div className="font-serif text-sm italic text-ink-faint">
            made by hand, mostly.
          </div>
        </div>
        <div className="flex flex-wrap gap-5 text-sm text-ink-soft">
          <Link
            href="/music"
            className="transition-colors hover:text-accent-rust"
          >
            music
          </Link>
          <Link
            href="/collage"
            className="transition-colors hover:text-accent-rust"
          >
            collage
          </Link>
          <Link
            href="/connect"
            className="transition-colors hover:text-accent-rust"
          >
            connect
          </Link>
        </div>
      </footer>
    </main>
  );
}
