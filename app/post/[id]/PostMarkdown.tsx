// The markdown → journal-prose renderer, shared by every surface that shows a
// post body. Deliberately NOT a client component: imported from a server page
// (the public post + draft preview) the whole react-markdown/katex/highlight
// pipeline runs on the server and ships zero JS to the reader — only the
// interactive leaves (CodeCard's copy button, PlotlyGraph, figure widgets) are
// client references. The writing room imports this same component from its
// client code, where it renders live against the draft as it's typed.
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import PlotlyGraph from "@/app/components/PlotlyGraph";
// Generic per-post custom-tag widgets (each post's pack is code-split; see
// app/components/post-widgets.tsx). Keeps post-specific visuals out of here.
import { postWidgetComponents, postWidgetTags } from "@/app/components/post-widgets";
import { Doodle } from "@/app/components/sketchbook";
import CodeCard from "./CodeCard";

import "katex/dist/katex.min.css";
// syntax-highlighting colors are defined as theme-aware tokens in globals.css

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

export default function PostMarkdown({ content }: { content: string }) {
  return (
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
            ...postWidgetTags,
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
        // Per-post custom-tag widgets, registered generically.
        ...postWidgetComponents,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
