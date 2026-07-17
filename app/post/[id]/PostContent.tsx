"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Post, analyzeContent } from "@/app/lib/supabase";
import { POST_TYPE_META } from "@/app/lib/postTypes";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { useViewCount, ViewCount } from "./ViewCountTracker";
import OwnerEditLink from "@/app/components/OwnerEditLink";
import { Doodle, Stamp, TornEdge, PaperClip, Tape } from "@/app/components/sketchbook";
import { chaosFor, paperTextureStyle } from "@/app/lib/chaos";

// Lazy load ReactPlayer - only loads when actually needed
const ReactPlayer = dynamic(() => import("react-player/lazy"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-40 bg-paper-2/60 rounded-xl animate-pulse flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-line border-t-accent-orange rounded-full animate-spin" />
    </div>
  ),
});

type Tone = "orange" | "purple" | "rust" | "ink";
type Heading = { id: string; text: string; depth: number };
export type PostNav = Pick<Post, "slug" | "title" | "type">;

interface PostContentProps {
  post: Post;
  /** the rendered post body (a <PostMarkdown/>). Passed in — never rendered
   *  here — so server pages keep the markdown pipeline out of this bundle,
   *  while the writing room can hand in a live client-rendered proof. */
  body: React.ReactNode;
  /** precomputed by server pages so the raw markdown needn't ship as a prop;
   *  the writing room omits it and it's derived from the live draft instead */
  readingTime?: number;
  prev?: PostNav | null; // a newer entry
  next?: PostNav | null; // an older entry
  /** the writing room's proof: no view tracking, no owner edit link */
  preview?: boolean;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ============================================================================
export default function PostContent({
  post,
  body,
  readingTime: readingTimeProp,
  prev,
  next,
  preview = false,
}: PostContentProps) {
  const tone: Tone = (POST_TYPE_META[post.type] ?? POST_TYPE_META.note).tone;
  const isAudio = !!post.media_url && /soundcloud\.com/.test(post.media_url);
  const views = useViewCount(post.id, post.view_count || 0, !preview);
  const readingTime =
    readingTimeProp ?? analyzeContent(post.content || "").readingTime;

  const sheetRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const nibRef = useRef<SVGSVGElement>(null);
  const hairRef = useRef<HTMLDivElement>(null);

  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [endSeen, setEndSeen] = useState(false);

  const hasToc = headings.length >= 3;
  const minDepth = headings.length
    ? Math.min(...headings.map((h) => h.depth))
    : 1;

  // Pull heading anchors straight from the rendered DOM (rehype-slug set ids) —
  // no re-slugging, so the TOC links can never drift from the real anchors.
  useEffect(() => {
    const root = sheetRef.current;
    if (!root) return;
    const nodes = Array.from(
      root.querySelectorAll<HTMLElement>(".prose :is(h2,h3,h4)[id]"),
    );
    const hs = nodes.map((n) => ({
      id: n.id,
      text: n.textContent || "",
      depth: Number(n.tagName.charAt(1)),
    }));
    setHeadings(hs);
    setActiveId(hs[0]?.id ?? null);
  }, [post.content]);

  // Open the inline (mobile/tablet) TOC by default on tablets only.
  useEffect(() => {
    if (detailsRef.current) {
      detailsRef.current.open = window.matchMedia(
        "(min-width: 640px) and (max-width: 1279px)",
      ).matches;
    }
  }, [headings.length]);

  // Reading progress. A rAF loop eases a 0..1 scalar toward the true scroll
  // position each frame so the nib glides (and trails like wet ink) instead of
  // teleporting between discrete scroll events. The scalar is painted straight
  // onto the three moving marks (ink fill, nib, sub-xl hairline) as inline
  // transforms — not as a CSS variable on <html>, which would invalidate styles
  // for the entire document every frame and made the marks stutter on phones.
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    let raf = 0;
    let running = false;
    let current = 0;
    let railH = 0;

    const targetOf = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const scrollable = rect.height - vh;
      if (scrollable <= 0) return rect.top <= 0 ? 1 : 0;
      return Math.min(1, Math.max(0, -rect.top / scrollable));
    };

    // the nib travels the margin rule, which is inset 24px (inset-y-6) top &
    // bottom of the sheet — ride it on a GPU transform instead of animating
    // `top`.
    const measureRail = () => {
      railH = Math.max(0, el.clientHeight - 48);
    };

    const paint = (v: number) => {
      const s = v.toFixed(4);
      if (fillRef.current)
        fillRef.current.style.transform = `scaleY(${s})`;
      if (nibRef.current)
        // -5.5px centers the 11px nib on its position along the rail
        nibRef.current.style.transform = `translate3d(0, ${(v * railH - 5.5).toFixed(1)}px, 0)`;
      if (hairRef.current)
        hairRef.current.style.transform = `scaleX(${s})`;
    };

    const tick = () => {
      const target = targetOf();
      // ease toward target; snap instantly when motion is unwelcome
      current += (target - current) * (reduce ? 1 : 0.18);
      const settled = Math.abs(target - current) < 0.0006;
      if (settled) current = target;
      paint(current);
      if (settled) {
        running = false;
        raf = 0;
      } else {
        raf = requestAnimationFrame(tick);
      }
    };

    const start = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };

    const onResize = () => {
      measureRail();
      start();
    };

    measureRail();
    current = targetOf();
    paint(current);
    window.addEventListener("scroll", start, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", start);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [post.content]);

  // Scroll-spy: light the current section in the TOC.
  useEffect(() => {
    if (headings.length < 3) return;
    const root = sheetRef.current;
    if (!root) return;
    const nodes = Array.from(
      root.querySelectorAll<HTMLElement>(".prose :is(h2,h3,h4)[id]"),
    );
    if (!nodes.length) return;
    const visible = new Set<string>();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).id;
          if (e.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        const firstVisible = nodes.find((n) => visible.has(n.id));
        if (firstVisible) setActiveId(firstVisible.id);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );
    nodes.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, [headings]);

  // Ink the closing flourish when the reader reaches the end.
  useEffect(() => {
    const el = endRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setEndSeen(true);
          obs.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const onNavigate = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
      if (typeof history !== "undefined")
        history.replaceState(null, "", `#${id}`);
    },
    [],
  );

  return (
    <>
      {/* no hairline in the proof — the writing room has no header to ride */}
      {hasToc && !preview && <ProgressHairline barRef={hairRef} />}

      <div className="mx-auto w-full max-w-[40rem] px-4 sm:max-w-[44rem] sm:px-6 xl:grid xl:max-w-[84rem] xl:grid-cols-[minmax(0,1fr)_minmax(0,46rem)_minmax(0,1fr)] xl:items-start xl:gap-x-12 xl:px-8 2xl:max-w-[92rem] 2xl:gap-x-16">
        {/* ---------- LEFT MARGIN: back-link + table of contents ---------- */}
        <aside className="hidden self-start xl:sticky xl:top-20 xl:block">
          <div className="rise d1">
            <BackLink />
            {hasToc && (
              <MarginTOC
                headings={headings}
                activeId={activeId}
                minDepth={minDepth}
                onNavigate={onNavigate}
              />
            )}
          </div>
        </aside>

        {/* ---------- CENTER: the journal sheet ---------- */}
        <div className="min-w-0">
          <div className="xl:hidden">
            <BackLink />
          </div>

          <div
            ref={sheetRef}
            className="relative rounded-[3px] border border-line bg-card px-6 py-11 shadow-paper-lg sm:px-10 md:px-16 md:py-14"
          >
            <TornEdge position="top" />
            <TornEdge position="bottom" />
            <PaperClip className="-top-5 right-8 md:right-12" rotate={9} tone="ink" />

            {/* left margin rule — fills with wet ink as you read */}
            <InkRule fillRef={fillRef} nibRef={nibRef} />

            {/* Header */}
            <header className="mb-11 md:mb-12">
              <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2.5">
                <Stamp tone={tone} rotate={-4}>
                  {post.type}
                </Stamp>
                <Stamp tone="ink" rotate={3}>
                  {format(new Date(post.created_at), "dd MMM ''yy")}
                </Stamp>
                <span className="font-hand text-lg text-ink-faint">
                  {formatDistanceToNow(new Date(post.created_at), {
                    addSuffix: true,
                  })}
                </span>
                {/* reading-time + reads live in the right margin on lg+ */}
                <span className="font-hand text-lg text-ink-faint xl:hidden">
                  ~ {readingTime} min
                </span>
                <span className="xl:hidden">
                  <ViewCount count={views} />
                </span>
                {!preview && (
                  <span className="xl:hidden">
                    <OwnerEditLink postId={post.id} />
                  </span>
                )}
              </div>

              <span className="font-hand text-2xl -rotate-1 text-accent-purple">
                from the journal —
              </span>
              <h1 className="mt-1 font-serif text-3xl font-medium leading-[1.04] tracking-tight text-ink sm:text-4xl md:text-5xl lg:text-6xl">
                {post.title}
              </h1>

              {post.tags.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="font-hand text-xl text-accent-purple"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </header>

            {/* Media — taped into the page */}
            {post.media_url && (
              <div className="relative mb-12 rounded-md border border-line bg-paper-2/70 p-3 shadow-paper md:mb-14">
                <Tape tone={tone} rotate={-5} className="-top-3 left-8" />
                <Tape tone={tone} rotate={5} className="-top-3 right-8" />
                {isAudio ? (
                  <ReactPlayer
                    url={post.media_url}
                    width="100%"
                    height="160px"
                    controls
                    config={{
                      soundcloud: {
                        options: {
                          show_artwork: true,
                          show_playcount: true,
                          show_user: true,
                        },
                      },
                    }}
                  />
                ) : (
                  <div className="relative aspect-video overflow-hidden rounded">
                    <ReactPlayer
                      url={post.media_url}
                      width="100%"
                      height="100%"
                      controls
                      playing={false}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Inline contents — mobile + tablet only */}
            {hasToc && (
              <TocDetails
                detailsRef={detailsRef}
                headings={headings}
                activeId={activeId}
                minDepth={minDepth}
                onNavigate={onNavigate}
              />
            )}

            {/* Content */}
            <div className="prose prose-lg max-w-none font-serif">
              {body}
            </div>
          </div>
        </div>

        {/* ---------- RIGHT MARGIN: field notes ---------- */}
        <aside className="hidden self-start xl:sticky xl:top-20 xl:block">
          <MarginMeta
            tone={tone}
            readingTime={readingTime}
            views={views}
            title={post.title}
            showShare={!preview}
            editSlot={!preview ? <OwnerEditLink postId={post.id} /> : null}
          />
        </aside>
      </div>

      {/* ---------- closing flourish + onward ---------- */}
      <footer className="mx-auto mt-12 w-full max-w-[40rem] px-4 sm:max-w-[44rem] sm:px-6 xl:mt-16 xl:max-w-[84rem] xl:px-8 2xl:max-w-[92rem]">
        <div ref={endRef} className="flex flex-col items-center gap-3 text-center">
          <Doodle
            name="divider"
            tone="rust"
            className="h-5 w-56"
            strokeWidth={2.5}
            draw={endSeen}
          />
          <p className="font-hand text-2xl text-ink">
            that&apos;s the end. thanks for reading{" "}
            <span className="text-accent-orange">✦</span>
          </p>
          <p className="font-hand text-lg text-ink-faint">
            — pramit <span className="text-accent-purple">✦</span> mazumder
          </p>

          {/* a proof's location is the writing room — nothing to share yet */}
          {!preview && (
            <div className="mt-6">
              <ShareControls title={post.title} />
            </div>
          )}
        </div>

        {(prev || next) && (
          <div className="mx-auto mt-10 grid max-w-3xl gap-6 sm:grid-cols-2">
            {prev ? (
              <NavCard post={prev} dir="newer" />
            ) : (
              <span className="hidden sm:block" />
            )}
            {next ? (
              <NavCard post={next} dir="older" />
            ) : (
              <span className="hidden sm:block" />
            )}
          </div>
        )}

        <div className="mt-9 flex justify-center">
          <Link href="/" className="btn-sketch">
            <Doodle
              name="arrow"
              tone="ink"
              className="h-4 w-7 rotate-180"
              strokeWidth={3}
            />
            back to the table
          </Link>
        </div>
      </footer>
    </>
  );
}

// ---------------------------------------------------------------------------
function BackLink() {
  return (
    <Link
      href="/"
      className="group mb-6 inline-flex items-center gap-2 font-hand text-2xl text-accent-rust transition-colors hover:text-accent-orange"
    >
      <Doodle
        name="arrow"
        tone="rust"
        className="h-5 w-9 rotate-180 transition-transform group-hover:-translate-x-1"
        strokeWidth={3}
      />
      back to the table
    </Link>
  );
}

// The left margin rule of the sheet, drawn in wet ink as you read. The nib
// only rides it from md up — on a phone the rule sits too close to the text
// for an arrow to sail past it gracefully.
function InkRule({
  fillRef,
  nibRef,
}: {
  fillRef: React.RefObject<HTMLDivElement | null>;
  nibRef: React.RefObject<SVGSVGElement | null>;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-6 left-4 w-px sm:left-7 md:left-9"
    >
      <div className="absolute inset-0 bg-accent-rust/25" />
      <div
        ref={fillRef}
        className="absolute inset-x-0 top-0 h-full origin-top will-change-transform"
        style={{
          transform: "scaleY(0)",
          background:
            "linear-gradient(rgb(var(--accent-orange)), rgb(var(--accent-rust)))",
        }}
      />
      <svg
        ref={nibRef}
        className="ink-nib absolute -left-[5px] top-0 hidden h-[11px] w-[11px] text-accent-rust will-change-transform md:block"
        viewBox="0 0 12 12"
        fill="none"
        style={{ transform: "translate3d(0, -5.5px, 0)" }}
      >
        <path d="M2 2 L10 2 L6 11 Z" fill="currentColor" />
      </svg>
    </div>
  );
}

// Below xl there's no margin to write progress into, so an inked line rides
// the nav's own bottom hairline instead — flush against the header border,
// never floating over the sheet.
function ProgressHairline({
  barRef,
}: {
  barRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div aria-hidden className="fixed inset-x-0 top-14 z-30 h-[2px] xl:hidden">
      <div
        ref={barRef}
        className="h-full origin-left bg-accent-orange will-change-transform"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
type TocProps = {
  headings: Heading[];
  activeId: string | null;
  minDepth: number;
  onNavigate: (e: React.MouseEvent<HTMLAnchorElement>, id: string) => void;
};

function TocList({ headings, activeId, minDepth, onNavigate }: TocProps) {
  return (
    <ul className="space-y-1.5">
      {headings.map((h) => {
        const level = Math.min(h.depth - minDepth, 2);
        const active = h.id === activeId;
        return (
          <li key={h.id} style={{ paddingLeft: `${level * 0.85}rem` }}>
            <a
              href={`#${h.id}`}
              onClick={(e) => onNavigate(e, h.id)}
              aria-current={active ? "location" : undefined}
              className={`group/li relative inline-block font-hand leading-snug transition-colors ${
                level === 0 ? "text-base" : "text-sm"
              } ${
                active
                  ? "text-ink"
                  : level >= 2
                    ? "text-ink-faint hover:text-ink"
                    : "text-ink-soft hover:text-ink"
              }`}
            >
              {h.text}
              <Doodle
                name="underline"
                tone="rust"
                className={`block h-1.5 w-full transition-opacity duration-200 ${
                  active ? "opacity-100" : "opacity-0 group-hover/li:opacity-40"
                }`}
                strokeWidth={3}
              />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function MarginTOC(props: TocProps) {
  return (
    <nav
      aria-label="On this page"
      data-lyrics-ignore
      className="relative mt-8 max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-hide pl-4"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-1 left-0 w-px bg-accent-rust/25"
      />
      <p className="mb-3 font-hand text-xl -rotate-1 text-accent-purple">
        in this entry —
      </p>
      <TocList {...props} />
    </nav>
  );
}

function TocDetails({
  detailsRef,
  ...props
}: TocProps & { detailsRef: React.RefObject<HTMLDetailsElement | null> }) {
  return (
    <details
      ref={detailsRef}
      data-lyrics-ignore
      className="group mb-10 rounded-md border border-dashed border-line bg-paper-2/40 px-5 py-3 xl:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between font-hand text-xl text-accent-purple [&::-webkit-details-marker]:hidden">
        in this entry —
        <svg
          className="toc-chevron h-4 w-4 text-ink-faint"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </summary>
      <div className="mt-3">
        <TocList {...props} />
      </div>
    </details>
  );
}

function MarginMeta({
  tone,
  readingTime,
  views,
  title,
  showShare = true,
  editSlot,
}: {
  tone: Tone;
  readingTime: number;
  views: number;
  title: string;
  showShare?: boolean;
  editSlot?: React.ReactNode;
}) {
  const toTop = () =>
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  return (
    <div className="rise d2 mt-8 space-y-5 text-right">
      <div className="space-y-1">
        <p className="font-hand text-lg text-ink-faint">
          ~ {readingTime} min read
        </p>
        <ViewCount count={views} />
      </div>
      <div className="flex justify-end">
        <Doodle
          name="squiggle"
          tone={tone}
          className="h-4 w-20 opacity-60"
          strokeWidth={2.5}
        />
      </div>
      {showShare && <ShareControls title={title} variant="margin" />}
      <div className="flex justify-end">
        <Doodle
          name="squiggle"
          tone={tone}
          className="h-4 w-20 opacity-60"
          strokeWidth={2.5}
        />
      </div>
      <button
        type="button"
        onClick={toTop}
        className="font-hand text-lg text-ink-faint transition-colors hover:text-accent-rust"
      >
        ↑ back to the top
      </button>
      {editSlot ? <div className="flex justify-end">{editSlot}</div> : null}
    </div>
  );
}

function NavCard({ post, dir }: { post: PostNav; dir: "newer" | "older" }) {
  const c = chaosFor(post.slug);
  return (
    <Link
      href={`/post/${post.slug}`}
      className="sketch-card group/nav relative block p-5"
      style={{ transform: `rotate(${c.rotate}deg)`, ...paperTextureStyle(c.paper) }}
    >
      <span className="font-hand text-lg text-accent-rust">
        {dir === "newer" ? "← a newer entry" : "an older entry →"}
      </span>
      <p className="mt-1 font-serif text-lg font-medium leading-snug text-ink line-clamp-2">
        {post.title}
      </p>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Share controls — copy the permalink, hand it to the OS share sheet, or post
// to X. Styled as hand-inked links to keep the journal voice.
// ---------------------------------------------------------------------------
// Hand-inked glyphs — drawn in currentColor so they ride the same hover/active
// color transitions as the label, with round caps + a touch of wobble to match
// the sketchbook doodles.
function ShareGlyph({ name }: { name: "link" | "check" | "share" | "x" }) {
  const common = {
    className: "h-[1.05em] w-[1.05em] shrink-0",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.1,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "link":
      return (
        <svg {...common}>
          <path d="M9.6 14.4 a3.6 3.6 0 0 0 5.1 0 l2.7 -2.7 a3.6 3.6 0 0 0 -5.1 -5.1 l-1.3 1.3" />
          <path d="M14.4 9.6 a3.6 3.6 0 0 0 -5.1 0 l-2.7 2.7 a3.6 3.6 0 0 0 5.1 5.1 l1.3 -1.3" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="M4.5 13 c1.7 1 2.9 2.3 3.7 3.9 c2 -4.6 5 -8.1 9.3 -10.6" />
        </svg>
      );
    case "share":
      return (
        <svg {...common}>
          <path d="M12 3.4 v11" />
          <path d="M8 7 l4 -3.6 l4 3.6" />
          <path d="M6.4 12 v6.4 a1.3 1.3 0 0 0 1.3 1.3 h8.6 a1.3 1.3 0 0 0 1.3 -1.3 v-6.4" />
        </svg>
      );
    case "x":
      return (
        <svg {...common}>
          <path d="M5.2 5 L18.8 19" />
          <path d="M18.8 5 L5.2 19" />
        </svg>
      );
  }
}

function ShareItem({
  label,
  glyph,
  onClick,
  href,
  tone = "rust",
  active = false,
  ariaLabel,
}: {
  label: string;
  glyph: "link" | "check" | "share" | "x";
  onClick?: () => void;
  href?: string;
  tone?: Tone;
  active?: boolean;
  ariaLabel?: string;
}) {
  const cls =
    "group/sh relative inline-flex items-center gap-1.5 font-hand text-xl leading-none transition-colors";
  const color = active
    ? "text-accent-orange"
    : "text-ink-soft hover:text-accent-rust focus-visible:text-accent-rust";
  const inner = (
    <>
      <ShareGlyph name={glyph} />
      {label}
      <Doodle
        name="underline"
        tone={tone}
        className={`absolute -bottom-2 left-0 h-1.5 w-full transition-opacity duration-200 ${
          active ? "opacity-100" : "opacity-0 group-hover/sh:opacity-50 group-focus-visible/sh:opacity-50"
        }`}
        strokeWidth={3}
      />
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel}
        className={`${cls} ${color}`}
      >
        {inner}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`${cls} ${color}`}
    >
      {inner}
    </button>
  );
}

function ShareControls({
  title,
  variant = "inline",
}: {
  title: string;
  variant?: "inline" | "margin";
}) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setUrl(window.location.href.split("#")[0]);
    setCanShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    );
  }, []);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  const nativeShare = async () => {
    if (!url) return;
    try {
      await navigator.share({ title, url });
    } catch {
      /* user dismissed, or share unsupported */
    }
  };

  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    title,
  )}&url=${encodeURIComponent(url)}`;

  const items = (
    <>
      <ShareItem
        label={copied ? "copied" : "copy link"}
        glyph={copied ? "check" : "link"}
        onClick={copy}
        tone="orange"
        active={copied}
        ariaLabel={copied ? "Link copied to clipboard" : "Copy link to this entry"}
      />
      {canShare && (
        <ShareItem
          label="share"
          glyph="share"
          onClick={nativeShare}
          tone="purple"
          ariaLabel="Share this entry"
        />
      )}
      <ShareItem
        label="on X"
        glyph="x"
        href={xHref}
        tone="rust"
        ariaLabel="Share on X"
      />
    </>
  );

  const status = (
    <span role="status" aria-live="polite" className="sr-only">
      {copied ? "Link copied to clipboard" : ""}
    </span>
  );

  if (variant === "margin") {
    return (
      <div className="space-y-3 text-right">
        <p className="font-hand text-lg -rotate-1 text-accent-purple">share —</p>
        <div className="flex flex-col items-end gap-3">{items}</div>
        {status}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="font-hand text-xl -rotate-1 text-accent-purple">
        liked this? pass it on —
      </span>
      <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
        {items}
      </div>
      {status}
    </div>
  );
}

// ---------------------------------------------------------------------------
function CodeCard({
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
