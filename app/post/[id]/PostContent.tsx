"use client";

import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { Post } from "@/app/lib/supabase";
import { POST_TYPE_META } from "@/app/lib/postTypes";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import Image from "next/image";
import ViewCountTracker from "./ViewCountTracker";
import PlotlyGraph from "@/app/components/PlotlyGraph";
import rehypeRaw from "rehype-raw";
import { Doodle, Stamp, TornEdge, PaperClip, Tape } from "@/app/components/sketchbook";

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

interface PostContentProps {
  post: Post;
}

export default function PostContent({ post }: PostContentProps) {
  const tone = (POST_TYPE_META[post.type] ?? POST_TYPE_META.note).tone;
  const isAudio = !!post.media_url && /soundcloud\.com/.test(post.media_url);

  return (
    <div>
      {/* doodled back link */}
      <Link
        href="/"
        className="group mb-6 inline-flex items-center gap-2 font-hand text-2xl text-accent-rust transition-colors hover:text-accent-orange"
      >
        <Doodle name="arrow" tone="rust" className="h-5 w-9 rotate-180 transition-transform group-hover:-translate-x-1" strokeWidth={3} />
        back to the table
      </Link>

      {/* the journal sheet */}
      <div className="relative rounded-[3px] border border-line bg-card px-6 py-11 shadow-paper-lg sm:px-10 md:px-16 md:py-14">
        <TornEdge position="top" />
        <TornEdge position="bottom" />
        <PaperClip className="-top-5 right-8 md:right-12" rotate={9} tone="ink" />
        {/* left margin rule */}
        <div aria-hidden className="pointer-events-none absolute inset-y-6 left-4 w-px bg-accent-rust/25 sm:left-7 md:left-9" />

        {/* Header */}
        <header className="mb-12">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Stamp tone={tone} rotate={-4}>{post.type}</Stamp>
            <Stamp tone="ink" rotate={3}>
              {format(new Date(post.created_at), "dd MMM ''yy")}
            </Stamp>
            <span className="font-hand text-lg text-ink-faint">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </span>
            <ViewCountTracker postId={post.id} initialViewCount={post.view_count || 0} />
          </div>

          <span className="font-hand text-2xl -rotate-1 text-accent-purple">from the journal —</span>
          <h1 className="mt-1 font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-medium leading-[1.04] tracking-tight text-ink">
            {post.title}
          </h1>

          {post.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
              {post.tags.map((tag) => (
                <span key={tag} className="font-hand text-xl text-accent-purple">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Media — taped into the page */}
        {post.media_url && (
          <div className="relative mb-14 rounded-md border border-line bg-paper-2/70 p-3 shadow-paper">
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
                    options: { show_artwork: true, show_playcount: true, show_user: true },
                  },
                }}
              />
            ) : (
              <div className="relative aspect-video overflow-hidden rounded">
                <ReactPlayer url={post.media_url} width="100%" height="100%" controls playing={false} />
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="prose prose-lg max-w-none font-serif">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex, rehypeHighlight, rehypeRaw]}
            components={{
              ...({} as any),
              h1: ({ children }) => (
                <h1 className="font-serif text-2xl md:text-3xl font-medium mt-16 mb-6 text-ink tracking-tight first:mt-0">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="font-serif text-xl md:text-2xl font-medium mt-14 mb-5 text-ink tracking-tight first:mt-0">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="font-serif text-lg md:text-xl font-medium mt-10 mb-4 text-ink first:mt-0">
                  {children}
                </h3>
              ),
              h4: ({ children }) => (
                <h4 className="font-serif text-base md:text-lg font-semibold mt-8 mb-3 text-ink first:mt-0">
                  {children}
                </h4>
              ),
              p: ({ children, node }: any) => {
                const blockTags = ["div", "video", "figure", "table", "pre", "ul", "ol", "blockquote", "plotly-graph"];
                if (node?.children) {
                  const hasBlockElement = node.children.some((child: any) =>
                    child.type === "element" ? blockTags.includes(child.tagName) : false
                  );
                  if (hasBlockElement) return <>{children}</>;
                }
                return (
                  <p className="text-ink-soft text-base md:text-lg leading-[1.75] md:leading-[1.8] mb-7 tracking-[0.01em]">
                    {children}
                  </p>
                );
              },
              img: (props) => {
                const { src, alt } = props;
                return (
                  <span className="relative my-10 block rounded-md border border-line bg-paper-2/70 p-3 shadow-paper md:my-12">
                    <Image
                      src={typeof src === "string" ? src : ""}
                      alt={typeof alt === "string" ? alt : ""}
                      width={800}
                      height={600}
                      className="h-auto w-full rounded object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 800px"
                    />
                    {alt ? (
                      <span className="mt-2 block text-center font-hand text-lg text-ink-faint">{alt}</span>
                    ) : null}
                  </span>
                );
              },
              video: ({ children, ...props }) => {
                const { node, ...videoProps } = props as any;
                return (
                  <div className="relative my-10 block overflow-hidden rounded-md border border-line bg-paper-2/70 p-3 shadow-paper md:my-12">
                    <video {...videoProps} className="h-auto w-full rounded" controls preload="metadata" suppressHydrationWarning>
                      {children}
                    </video>
                  </div>
                );
              },
              a: ({ href, children }) => (
                <a
                  href={href}
                  className="text-accent-orange underline decoration-accent-orange/40 underline-offset-2 transition-colors duration-200 hover:text-accent-purple hover:decoration-accent-purple/60"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              ),
              code: (props: any) =>
                props.inline ? (
                  <code className="rounded bg-accent-orange/10 px-1.5 py-0.5 font-mono text-[0.9em] text-accent-orange">
                    {props.children}
                  </code>
                ) : (
                  <code className="font-mono">{props.children}</code>
                ),
              pre: ({ children }) => (
                <pre className="my-10 overflow-x-auto rounded-md border border-line bg-paper-2 p-5 text-sm leading-relaxed md:p-6">
                  {children}
                </pre>
              ),
              blockquote: ({ children }) => (
                <blockquote className="relative my-10 -rotate-[0.6deg] rounded-md border border-dashed border-accent-purple/50 bg-accent-purple/[0.06] py-5 pl-7 pr-6 text-ink-soft text-base italic leading-[1.7] md:text-lg">
                  <span aria-hidden className="absolute left-3 top-3 font-serif text-3xl leading-none text-accent-purple/50">&ldquo;</span>
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
                <li className="text-ink-soft text-base leading-[1.75] md:text-lg">{children}</li>
              ),
              table: ({ children }) => (
                <div className="my-10 overflow-x-auto rounded-md border border-line bg-card/70 md:my-12">
                  <table className="w-full text-sm">{children}</table>
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
              td: ({ children }) => <td className="px-5 py-4 text-ink-soft md:px-6">{children}</td>,
              sup: ({ children }) => (
                <sup className="ml-0.5 cursor-pointer text-xs text-accent-orange transition-colors hover:text-accent-purple">
                  {children}
                </sup>
              ),
              section: ({ children, ...props }) => {
                if (props.className?.includes("footnotes")) {
                  return <section className="mt-16 border-t border-line pt-10">{children}</section>;
                }
                return <section {...props}>{children}</section>;
              },
              hr: () => (
                <div className="my-12 flex justify-center md:my-16">
                  <Doodle name="divider" tone="rust" className="h-5 w-56" strokeWidth={2.5} />
                </div>
              ),
              strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
              em: ({ children }) => <em className="italic text-ink">{children}</em>,
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

      {/* end-of-entry mark */}
      <div className="mt-8 flex items-center justify-center gap-3 text-ink-faint">
        <Doodle name="star" tone="orange" className="h-4 w-4" strokeWidth={2} />
        <span className="font-hand text-xl">end of entry</span>
        <Doodle name="star" tone="purple" className="h-4 w-4" strokeWidth={2} />
      </div>
    </div>
  );
}
