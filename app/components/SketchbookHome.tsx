"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { HomePost } from "@/app/lib/homePosts";
import { isFreshPost } from "@/app/lib/rankPosts";
import { POST_TYPE_META, POST_TYPE_FILTERS } from "@/app/lib/postTypes";
import { useNowPlayingContext } from "@/app/components/NowPlayingContext";
import {
  ChaosDecor,
  Tape,
  Stamp,
  Doodle,
  PaperClip,
} from "@/app/components/sketchbook";
import { chaosFor, paperTextureStyle } from "@/app/lib/chaos";

// evergreen, owner-editable
const CURRENTLY = [
  "rebuilding this site (again)",
  "climbing plastic",
  "learning guitar",
];

// "jun '26" — same output date-fns' format(…, "MMM ''yy") gave, without the lib
const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];
function fmtDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${MONTHS[d.getMonth()]} '${String(d.getFullYear() % 100).padStart(2, "0")}`;
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
          {playing ? "now spinning" : echoing ? "last tune · echoing" : "last tune"}
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
        painted nightly from visitors&apos; drawings — the same ones drifting
        in the background{" "}
        <span className="text-accent-rust transition-colors group-hover:text-accent-orange">
          add yours →
        </span>
      </p>
    </Link>
  );
}

// The open journal page: the freshest post at reading size, the thing the
// sketchbook fell open to.
const IMAGE_URL_RE = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i;

function FeaturedSheet({ post }: { post: HomePost }) {
  const meta = POST_TYPE_META[post.type] ?? POST_TYPE_META.note;
  const { readingTime } = post;
  const preview = post.description || post.previewLong;
  const fresh = isFreshPost(post, Date.now());
  // the headline plate: the owner-picked cover, else the post's first
  // image, else media_url when it's clearly an image (it can be video)
  const headline =
    post.meta_image ||
    post.firstImage ||
    (post.media_url && IMAGE_URL_RE.test(post.media_url)
      ? post.media_url
      : null);

  return (
    <Link
      href={`/post/${post.slug}`}
      data-avoid-lyrics
      className="group relative block rounded-lg border border-line bg-card p-6 shadow-paper-lg transition-transform duration-300 hover:-translate-y-1 sm:p-9 sm:pt-8"
      style={{ rotate: "-0.4deg" }}
    >
      <PaperClip className="-top-4 left-8" rotate={-4} tone="ink" />
      <div className="mb-3.5 flex flex-wrap items-center gap-3">
        {fresh ? (
          <Stamp tone="orange" rotate={-3}>
            fresh ink
          </Stamp>
        ) : post.is_pinned ? (
          <Stamp tone="rust" rotate={-3}>
            pinned
          </Stamp>
        ) : null}
        <span
          className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${meta.badge}`}
        >
          {meta.label}
        </span>
        <span className="font-hand text-lg text-ink-faint">
          {fmtDate(post.created_at)}
        </span>
      </div>
      <h2 className="font-serif text-[clamp(1.8rem,3.6vw,2.7rem)] font-medium leading-[1.06] tracking-tight text-ink">
        {post.title}
      </h2>
      {headline ? (
        <div className="relative mt-5">
          <Tape
            tone="purple"
            rotate={-6}
            className="-top-2.5 left-8 z-10"
            width={56}
          />
          <div className="overflow-hidden rounded-lg border border-ink/15">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={headline}
              alt=""
              className="aspect-[2/1] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              loading="lazy"
            />
          </div>
        </div>
      ) : null}
      {preview ? (
        <p className="mt-4 font-serif text-[1.04rem] font-light leading-relaxed text-ink-soft first-letter:float-left first-letter:pr-2.5 first-letter:pt-1 first-letter:text-[2.9em] first-letter:font-medium first-letter:leading-[0.78] first-letter:text-accent-rust">
          {preview}
        </p>
      ) : null}
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-dashed border-line pt-4">
        <span className="text-xs text-ink-faint">~ {readingTime} min read</span>
        <span className="font-hand text-xl text-accent-rust transition-transform duration-200 group-hover:translate-x-1">
          keep reading →
        </span>
      </div>
    </Link>
  );
}

// The chaos card — one page of the feed (also used for the pair under the
// featured sheet).
function PostCard({ post }: { post: HomePost }) {
  const meta = POST_TYPE_META[post.type] ?? POST_TYPE_META.note;
  const { readingTime, previewText } = post;
  const preview = post.description || previewText;
  const c = chaosFor(post.id);
  const fresh = isFreshPost(post, Date.now());

  return (
    <div className="relative" style={{ transform: `rotate(${c.rotate}deg)` }}>
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
          <span className="flex items-center gap-2">
            {fresh ? (
              <Stamp tone="orange" rotate={4}>
                fresh ink
              </Stamp>
            ) : post.is_pinned ? (
              <Stamp tone="rust" rotate={-3}>
                pinned
              </Stamp>
            ) : null}
            <span className="font-hand text-lg text-ink-faint">
              {fmtDate(post.created_at)}
            </span>
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
              <span key={t} className="text-xs font-medium text-accent-purple">
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
}

// The "also on the table" stack — the next few pages as a quick list.
function FreshStack({ posts }: { posts: HomePost[] }) {
  return (
    <div
      className="relative rounded-lg border border-line bg-card px-5 pb-3 pt-4 shadow-paper"
      style={{ rotate: "0.6deg" }}
    >
      <span className="inline-block -rotate-1 font-hand text-xl text-accent-rust">
        also on the table —
      </span>
      <ol>
        {posts.map((post, i) => {
          const meta = POST_TYPE_META[post.type] ?? POST_TYPE_META.note;
          const { readingTime } = post;
          return (
            <li
              key={post.id}
              className={i > 0 ? "border-t border-dashed border-line" : ""}
            >
              <Link
                href={`/post/${post.slug}`}
                className="group block py-3 transition-transform duration-200 hover:translate-x-1"
              >
                <span className="font-serif text-[1.05rem] font-medium leading-snug text-ink transition-colors group-hover:text-accent-rust">
                  {post.title}
                </span>
                <span className="mt-1.5 flex items-baseline gap-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] ${meta.badge}`}
                  >
                    {meta.label}
                  </span>
                  <span className="font-hand text-base text-ink-faint">
                    {fmtDate(post.created_at)}
                  </span>
                  <span className="text-xs text-ink-faint">
                    ~ {readingTime} min
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      <a
        href="#feed"
        className="mb-1 inline-block font-hand text-lg text-accent-purple transition-transform duration-200 hover:translate-x-1"
      >
        every page, below ↓
      </a>
    </div>
  );
}

export default function SketchbookHome({
  posts,
  bannerImage,
  sketchCount,
}: {
  posts: HomePost[];
  bannerImage: string | null;
  sketchCount: number;
}) {
  const [filter, setFilter] = useState<"all" | HomePost["type"]>("all");

  // The table seats the first six pages: one featured, two beside it,
  // three in the rail's stack. The feed below holds the rest.
  const featured = posts[0];
  const pair = posts.slice(1, 3);
  const stack = posts.slice(3, 6);
  const rest = posts.slice(6);

  const shown = useMemo(
    () => (filter === "all" ? rest : posts.filter((p) => p.type === filter)),
    [posts, rest, filter],
  );

  return (
    <main className="relative mx-auto max-w-6xl px-6 pb-24 pt-8 sm:px-10 md:pt-12">
      {/* ============ THE SPREAD: identity + pages | the desk's edge ============
          one grid, so the rail (music → stack → collage) flows in a single
          column with even gaps beside the name and the open pages. */}
      <section className="grid gap-10 md:grid-cols-[1.55fr_0.85fr] md:items-start md:gap-14">
        {/* left: identity, then the open pages */}
        <div>
          <header data-avoid-lyrics className="rise d1">
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
            <h1 className="mt-1 font-serif text-[clamp(2.3rem,4.5vw,4.15rem)] font-medium leading-[0.95] tracking-tight text-ink md:whitespace-nowrap">
              pramit mazumder<span className="text-accent-rust">.</span>
            </h1>
            <svg
              className="mt-1.5 h-3.5 w-[min(34rem,86%)] overflow-visible"
              viewBox="0 0 340 13"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                className="ink-draw"
                d="M3 9 C90 3 190 12 264 6 C300 3 322 8 337 7"
                fill="none"
                stroke="rgb(var(--accent-orange))"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            </svg>
            <p className="mt-3 max-w-[32ch] font-serif text-[clamp(1.1rem,1.9vw,1.4rem)] font-light italic leading-snug text-ink-soft">
              a journal of interests, projects &amp;{" "}
              <em className="text-accent-purple">lived experiences</em>
            </p>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
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
          </header>

          {featured ? (
            <div className="rise d2 mt-10" data-avoid-lyrics>
              <FeaturedSheet post={featured} />
              {pair.length > 0 && (
                <div className="mt-8 grid gap-x-7 gap-y-9 sm:grid-cols-2">
                  {pair.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-12 font-hand text-2xl text-ink-faint">
              nothing here yet — check back soon ✎
            </p>
          )}
        </div>

        {/* right: the desk's edge, one continuous rail */}
        <aside className="rise d2 flex flex-col gap-8 md:pt-4">
          <NowSpinningCard />
          {stack.length > 0 && <FreshStack posts={stack} />}
          <CollageCard bannerImage={bannerImage} sketchCount={sketchCount} />
        </aside>
      </section>

      {/* ===================== EVERY PAGE (feed) ===================== */}
      {posts.length > 0 && (
        <section id="feed" className="mt-16 scroll-mt-20 md:mt-20">
          <div className="mb-8 flex items-center justify-center gap-3">
            <Doodle name="star" tone="orange" className="h-4 w-4" strokeWidth={2} />
            <Doodle
              name="divider"
              tone="purple"
              className="h-5 w-40 md:w-56"
              strokeWidth={2.5}
            />
            <Doodle name="star" tone="purple" className="h-4 w-4" strokeWidth={2} />
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 className="font-serif text-3xl font-medium text-ink">
                every page
              </h2>
              <span className="font-hand text-xl -rotate-2 text-accent-purple">
                — {posts.length} in the book
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
            <p className="mt-9 font-hand text-2xl text-ink-faint">
              {filter === "all"
                ? "that's the whole book so far ✎"
                : "no pages of that kind yet ✎"}
            </p>
          ) : (
            <div
              data-avoid-lyrics
              className="mt-9 grid grid-cols-1 gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-3"
            >
              {shown.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ===================== COLOPHON ===================== */}
      <footer className="mt-24 flex flex-wrap items-center justify-center gap-3 border-t border-line pt-7 text-center">
        <span className="font-hand text-xl text-ink-faint">
          made by hand, mostly.
        </span>
        <span aria-hidden className="text-accent-orange">
          ✦
        </span>
        <span className="text-xs tracking-wide text-ink-faint">2026</span>
      </footer>
    </main>
  );
}
