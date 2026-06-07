"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import { Post, analyzeContent } from "@/app/lib/supabase";
import { POST_TYPE_META } from "@/app/lib/postTypes";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { useViewCount, ViewCount } from "./ViewCountTracker";
import PlotlyGraph from "@/app/components/PlotlyGraph";
import { Doodle, Stamp, TornEdge, PaperClip, Tape } from "@/app/components/sketchbook";
import { chaosFor, paperTextureStyle } from "@/app/lib/chaos";

// Lazy load heavy CSS - only loads when component mounts
import "katex/dist/katex.min.css";
// syntax-highlighting colors are defined as theme-aware tokens in globals.css

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
  prev?: PostNav | null; // a newer entry
  next?: PostNav | null; // an older entry
}

// --- hast helpers (for code blocks) -----------------------------------------
function hastText(node: any): string {
  if (!node) return "";
  if (node.type === "text") return node.value || "";
  if (Array.isArray(node.children)) return node.children.map(hastText).join("");
  return "";
}
function getLang(codeNode: any): string {
  const cls = codeNode?.properties?.className;
  const arr = Array.isArray(cls)
    ? cls
    : typeof cls === "string"
      ? cls.split(/\s+/)
      : [];
  const m = arr.find((c: string) => c.startsWith("language-"));
  return m ? m.replace("language-", "") : "";
}
const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ============================================================================
export default function PostContent({ post, prev, next }: PostContentProps) {
  const tone: Tone = (POST_TYPE_META[post.type] ?? POST_TYPE_META.note).tone;
  const isAudio = !!post.media_url && /soundcloud\.com/.test(post.media_url);
  const views = useViewCount(post.id, post.view_count || 0);
  const { readingTime } = analyzeContent(post.content || "");

  const sheetRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

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

  // Reading progress → a single --read scalar (0..1) on <html>, read by the
  // ink-fill margin rule + the nib + the sub-lg hairline. A rAF loop eases the
  // value toward the true scroll position each frame so the nib glides (and
  // trails like wet ink) instead of teleporting between discrete scroll events.
  // No React re-render per frame, so the long essay never janks.
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const root = document.documentElement;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    let raf = 0;
    let running = false;
    let current = 0;

    const targetOf = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const scrollable = rect.height - vh;
      if (scrollable <= 0) return rect.top <= 0 ? 1 : 0;
      return Math.min(1, Math.max(0, -rect.top / scrollable));
    };

    // the nib travels the margin rule, which is inset 24px (inset-y-6) top &
    // bottom of the sheet — expose its pixel height so the nib can ride it on a
    // GPU transform instead of animating `top`.
    const measureRail = () => {
      root.style.setProperty(
        "--rail-h",
        `${Math.max(0, el.clientHeight - 48)}px`
      );
    };

    const tick = () => {
      const target = targetOf();
      // ease toward target; snap instantly when motion is unwelcome
      current += (target - current) * (reduce ? 1 : 0.18);
      const settled = Math.abs(target - current) < 0.0006;
      if (settled) current = target;
      root.style.setProperty("--read", current.toFixed(4));
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
    root.style.setProperty("--read", current.toFixed(4));
    window.addEventListener("scroll", start, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", start);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
      root.style.removeProperty("--read");
      root.style.removeProperty("--rail-h");
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
      {hasToc && <ProgressHairline />}

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
            <InkRule />

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
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[
                  rehypeKatex,
                  rehypeHighlight,
                  rehypeRaw,
                  rehypeSlug,
                ]}
                components={{
                  ...({} as any),
                  // Markdown headings are demoted one level (# -> h2, ## -> h3,
                  // ...) so the post title stays the page's only <h1>; the
                  // visual scale is preserved via classNames.
                  h1: ({ children, id }: any) => (
                    <h2
                      id={id}
                      className="scroll-mt-24 break-words font-serif text-2xl md:text-3xl font-medium mt-16 mb-6 text-ink tracking-tight first:mt-0 lg:scroll-mt-28"
                    >
                      {children}
                    </h2>
                  ),
                  h2: ({ children, id }: any) => (
                    <h3
                      id={id}
                      className="scroll-mt-24 break-words font-serif text-xl md:text-2xl font-medium mt-14 mb-5 text-ink tracking-tight first:mt-0 lg:scroll-mt-28"
                    >
                      {children}
                    </h3>
                  ),
                  h3: ({ children, id }: any) => (
                    <h4
                      id={id}
                      className="scroll-mt-24 break-words font-serif text-lg md:text-xl font-medium mt-10 mb-4 text-ink first:mt-0 lg:scroll-mt-28"
                    >
                      {children}
                    </h4>
                  ),
                  h4: ({ children, id }: any) => (
                    <h5
                      id={id}
                      className="scroll-mt-24 break-words font-serif text-base md:text-lg font-semibold mt-8 mb-3 text-ink first:mt-0 lg:scroll-mt-28"
                    >
                      {children}
                    </h5>
                  ),
                  p: ({ children, node }: any) => {
                    const blockTags = [
                      "div",
                      "video",
                      "figure",
                      "table",
                      "pre",
                      "ul",
                      "ol",
                      "blockquote",
                      "plotly-graph",
                    ];
                    if (node?.children) {
                      const hasBlockElement = node.children.some((child: any) =>
                        child.type === "element"
                          ? blockTags.includes(child.tagName)
                          : false,
                      );
                      if (hasBlockElement) return <>{children}</>;
                    }
                    return (
                      <p className="text-ink-soft text-base md:text-lg leading-[1.75] md:leading-[1.8] mb-7 tracking-[0.01em] break-words">
                        {children}
                      </p>
                    );
                  },
                  img: (props) => {
                    const { src, alt } = props;
                    return (
                      <span className="my-10 block md:my-12">
                        <span className="block rounded-md border border-line bg-card p-3 shadow-paper dark:shadow-paper-lg">
                          <span className="block overflow-hidden rounded bg-paper-2 dark:[box-shadow:inset_0_1px_0_rgb(var(--fg)/0.06)]">
                            {/* author images come from arbitrary hosts; a plain
                                lazy <img> avoids next/image remotePatterns 500s */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={typeof src === "string" ? src : ""}
                              alt={typeof alt === "string" ? alt : ""}
                              loading="lazy"
                              decoding="async"
                              className="block h-auto w-full object-cover"
                            />
                          </span>
                        </span>
                        {alt ? (
                          <span className="mt-2.5 block text-center font-hand text-lg text-ink-faint">
                            {alt}
                          </span>
                        ) : null}
                      </span>
                    );
                  },
                  video: ({ children, ...props }) => {
                    const { node, ...videoProps } = props as any;
                    return (
                      <div className="my-10 block rounded-md border border-line bg-card p-3 shadow-paper dark:shadow-paper-lg md:my-12">
                        <div className="overflow-hidden rounded bg-paper-2 dark:[box-shadow:inset_0_1px_0_rgb(var(--fg)/0.06)]">
                          <video
                            {...videoProps}
                            className="block h-auto w-full"
                            controls
                            preload="metadata"
                            suppressHydrationWarning
                          >
                            {children}
                          </video>
                        </div>
                      </div>
                    );
                  },
                  a: ({ href, children }) => {
                    const h = typeof href === "string" ? href : "";
                    if (h.startsWith("#")) {
                      return (
                        <a
                          href={h}
                          className="break-words text-accent-orange underline decoration-accent-orange/40 underline-offset-2 transition-colors duration-200 hover:text-accent-purple hover:decoration-accent-purple/60"
                        >
                          {children}
                        </a>
                      );
                    }
                    return (
                      <a
                        href={h}
                        className="break-words text-accent-orange underline decoration-accent-orange/40 underline-offset-2 transition-colors duration-200 hover:text-accent-purple hover:decoration-accent-purple/60"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {children}
                      </a>
                    );
                  },
                  code: ({ className, children }: any) => {
                    const text = String(children ?? "");
                    const isBlock =
                      /(^|\s)language-/.test(className || "") ||
                      text.includes("\n");
                    if (isBlock) {
                      return (
                        <code className={`font-mono ${className || ""}`}>
                          {children}
                        </code>
                      );
                    }
                    return (
                      <code className="rounded bg-ink/[0.06] px-1.5 py-0.5 font-mono text-[0.9em] text-accent-rust break-words">
                        {children}
                      </code>
                    );
                  },
                  pre: ({ children, node }: any) => {
                    const codeNode = node?.children?.find(
                      (c: any) => c.tagName === "code",
                    );
                    return (
                      <CodeCard
                        lang={getLang(codeNode)}
                        code={codeNode ? hastText(codeNode) : ""}
                      >
                        {children}
                      </CodeCard>
                    );
                  },
                  blockquote: ({ children }) => (
                    <blockquote className="relative my-10 -rotate-[0.6deg] rounded-md border border-dashed border-accent-purple/50 bg-accent-purple/[0.06] py-5 pl-7 pr-6 text-ink-soft text-base italic leading-[1.7] md:text-lg">
                      <span
                        aria-hidden
                        className="absolute left-3 top-3 font-serif text-3xl leading-none text-accent-purple/50"
                      >
                        &ldquo;
                      </span>
                      {children}
                    </blockquote>
                  ),
                  ul: ({ children }) => (
                    <ul className="my-8 ml-5 space-y-3 md:my-10 [&>li]:relative [&>li]:pl-2 [&>li]:before:absolute [&>li]:before:-left-4 [&>li]:before:top-[0.6em] [&>li]:before:h-1.5 [&>li]:before:w-1.5 [&>li]:before:rounded-full [&>li]:before:bg-accent-orange/80 [&>li]:before:content-['']">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="my-8 list-decimal space-y-3 pl-6 marker:font-semibold marker:text-accent-orange/80 md:my-10">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-ink-soft text-base leading-[1.75] md:text-lg break-words">
                      {children}
                    </li>
                  ),
                  table: ({ children }) => (
                    <div className="my-10 overflow-x-auto rounded-md border border-line bg-card/70 md:my-12">
                      <table className="w-full min-w-[34rem] text-sm">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => <thead>{children}</thead>,
                  tbody: ({ children }) => <tbody>{children}</tbody>,
                  tr: ({ children }) => <tr>{children}</tr>,
                  th: ({ children }) => (
                    <th className="px-5 py-4 text-left font-mono text-xs font-semibold uppercase tracking-wider text-ink-soft md:px-6">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-5 py-4 text-ink-soft md:px-6">
                      {children}
                    </td>
                  ),
                  sup: ({ children }) => (
                    <sup className="ml-0.5 cursor-pointer text-xs text-accent-orange transition-colors hover:text-accent-purple">
                      {children}
                    </sup>
                  ),
                  section: ({ children, ...props }) => {
                    if (props.className?.includes("footnotes")) {
                      return (
                        <section className="mt-16 border-t border-line pt-10">
                          {children}
                        </section>
                      );
                    }
                    return <section {...props}>{children}</section>;
                  },
                  hr: () => (
                    <div className="my-12 flex justify-center md:my-16">
                      <Doodle
                        name="divider"
                        tone="rust"
                        className="h-5 w-56"
                        strokeWidth={2.5}
                      />
                    </div>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-ink">{children}</strong>
                  ),
                  em: ({ children }) => (
                    <em className="italic text-ink">{children}</em>
                  ),
                  "plotly-graph": (props: any) => {
                    const { src, title, height } = props;
                    return (
                      <div className="my-10 md:my-12">
                        <PlotlyGraph src={src} title={title} height={height} />
                      </div>
                    );
                  },
                }}
              >
                {post.content}
              </ReactMarkdown>
            </div>
          </div>
        </div>

        {/* ---------- RIGHT MARGIN: field notes ---------- */}
        <aside className="hidden self-start xl:sticky xl:top-20 xl:block">
          <MarginMeta tone={tone} readingTime={readingTime} views={views} />
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

// The left margin rule of the sheet, drawn in wet ink as you read.
function InkRule() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-6 left-4 w-px sm:left-7 md:left-9"
    >
      <div className="absolute inset-0 bg-accent-rust/25" />
      <div
        className="absolute inset-x-0 top-0 h-full origin-top will-change-transform"
        style={{
          transform: "scaleY(var(--read,0))",
          background:
            "linear-gradient(rgb(var(--accent-orange)), rgb(var(--accent-rust)))",
        }}
      />
      <svg
        className="ink-nib absolute -left-[5px] top-0 h-[11px] w-[11px] text-accent-rust will-change-transform"
        viewBox="0 0 12 12"
        fill="none"
        style={{
          transform:
            "translate3d(0, calc(var(--read,0) * var(--rail-h,0px) - 50%), 0)",
        }}
      >
        <path d="M2 2 L10 2 L6 11 Z" fill="currentColor" />
      </svg>
    </div>
  );
}

function ProgressHairline() {
  return (
    <div
      aria-hidden
      className="fixed inset-x-0 top-[88px] z-30 h-[3px] bg-line/40 md:top-14 xl:hidden"
    >
      <div
        className="h-full origin-left bg-accent-orange will-change-transform"
        style={{ transform: "scaleX(var(--read,0))" }}
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
}: {
  tone: Tone;
  readingTime: number;
  views: number;
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
      <button
        type="button"
        onClick={toTop}
        className="font-hand text-lg text-ink-faint transition-colors hover:text-accent-rust"
      >
        ↑ back to the top
      </button>
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
