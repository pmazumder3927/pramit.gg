"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { Post } from "@/app/lib/supabase";
import ReactPlayer from "react-player";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";
import ViewCountTracker from "./ViewCountTracker";
import PlotlyGraph from "@/app/components/PlotlyGraph";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";
import rehypeRaw from "rehype-raw";

interface PostContentProps {
  post: Post;
}

export default function PostContent({ post }: PostContentProps) {
  return (
    <div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-300 transition-colors duration-300 mb-10 group text-sm tracking-wide"
      >
        <svg
          className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        back to home
      </Link>

      {/* Post Header */}
      <header className="mb-16">
        <div className="flex items-center gap-3 mb-8">
          <span
            className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 font-normal tracking-wide uppercase"
            style={{ color: post.accent_color }}
          >
            {post.type}
          </span>
          <span className="text-sm text-gray-500 tracking-wide">
            {formatDistanceToNow(new Date(post.created_at), {
              addSuffix: true,
            })}
          </span>
          <ViewCountTracker
            postId={post.id}
            initialViewCount={post.view_count || 0}
          />
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extralight mb-8 leading-[1.1] tracking-tight">
          <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
            {post.title}
          </span>
        </h1>
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-3 py-1.5 rounded-full bg-white/5 text-gray-500 border border-white/10 tracking-wide"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Media */}
      {post.media_url && (
        <div className="mb-14">
          {post.type === "music" ? (
            <div className="bg-gradient-to-br from-charcoal-black/90 to-void-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
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
            </div>
          ) : post.type === "climb" ? (
            <div className="relative aspect-video bg-gradient-to-br from-charcoal-black/90 to-void-black/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
              <ReactPlayer
                url={post.media_url}
                width="100%"
                height="100%"
                controls
                playing={false}
              />
            </div>
          ) : null}
        </div>
      )}

      {/* Content */}
      <div className="prose prose-invert prose-lg max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex, rehypeHighlight, rehypeRaw]}
          components={{
            ...({} as any),
            h1: ({ children }) => (
              <h1 className="text-2xl md:text-3xl font-light mt-16 mb-6 text-white/95 tracking-tight first:mt-0">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-xl md:text-2xl font-light mt-14 mb-5 text-white/90 tracking-tight first:mt-0">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-lg md:text-xl font-light mt-10 mb-4 text-white/85 first:mt-0">
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4 className="text-base md:text-lg font-normal mt-8 mb-3 text-white/80 first:mt-0">
                {children}
              </h4>
            ),
            p: ({ children, node }: any) => {
              // Block elements that shouldn't be wrapped in <p>
              const blockTags = ["div", "video", "figure", "table", "pre", "ul", "ol", "blockquote", "plotly-graph"];

              // Check the HAST node for block elements (more reliable than checking React elements)
              if (node?.children) {
                const hasBlockElement = node.children.some((child: any) => {
                  if (child.type === 'element') {
                    return blockTags.includes(child.tagName);
                  }
                  return false;
                });

                if (hasBlockElement) {
                  return <>{children}</>;
                }
              }

              return (
                <p className="text-gray-300/90 text-base md:text-lg leading-[1.75] md:leading-[1.8] mb-7 tracking-[0.01em]">{children}</p>
              );
            },
            img: (props) => {
              const { src, alt } = props;
              return (
                <span className="block relative w-full my-10 md:my-12 rounded-2xl overflow-hidden bg-gradient-to-br from-charcoal-black/90 to-void-black/90 backdrop-blur-xl border border-white/10">
                  <Image
                    src={typeof src === "string" ? src : ""}
                    alt={typeof alt === "string" ? alt : ""}
                    width={800}
                    height={600}
                    className="w-full h-auto object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 800px"
                  />
                </span>
              );
            },
            video: ({ children, ...props }) => {
              // Filter out the node prop that ReactMarkdown adds
              const { node, ...videoProps } = props as any;

              return (
                <div className="block relative w-full my-10 md:my-12 rounded-2xl overflow-hidden bg-gradient-to-br from-charcoal-black/90 to-void-black/90 backdrop-blur-xl border border-white/10">
                  <video
                    {...videoProps}
                    className="w-full h-auto"
                    controls
                    preload="metadata"
                    suppressHydrationWarning
                  >
                    {children}
                  </video>
                </div>
              );
            },
            a: ({ href, children }) => (
              <a
                href={href}
                className="text-accent-orange hover:text-accent-purple transition-colors duration-200 underline decoration-accent-orange/30 hover:decoration-accent-purple/50 underline-offset-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
            code: (props: any) =>
              props.inline ? (
                <code className="px-1.5 py-0.5 bg-white/10 rounded text-[0.9em] font-mono text-accent-orange/90">
                  {props.children}
                </code>
              ) : (
                <code className="font-mono">{props.children}</code>
              ),
            pre: ({ children }) => (
              <pre className="bg-gradient-to-br from-charcoal-black/90 to-void-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 md:p-6 overflow-x-auto my-10 text-sm leading-relaxed">
                {children}
              </pre>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-accent-orange/60 pl-6 md:pl-8 my-10 text-gray-400/90 text-base md:text-lg leading-[1.75]">
                {children}
              </blockquote>
            ),
            ul: ({ children }) => (
              <ul className="space-y-3 my-8 md:my-10 ml-5 [&>li]:relative [&>li]:pl-2 [&>li]:before:content-[''] [&>li]:before:absolute [&>li]:before:-left-4 [&>li]:before:top-[0.6em] [&>li]:before:w-1.5 [&>li]:before:h-1.5 [&>li]:before:bg-accent-orange/80 [&>li]:before:rounded-full">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal space-y-3 my-8 md:my-10 pl-6 marker:text-accent-orange/80">
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className="text-gray-300/90 text-base md:text-lg leading-[1.75]">
                {children}
              </li>
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto my-10 md:my-12 rounded-2xl bg-gradient-to-br from-charcoal-black/90 to-void-black/90 backdrop-blur-xl border border-white/10">
                <table className="w-full text-sm">{children}</table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className="bg-white/5 border-b border-white/10">
                {children}
              </thead>
            ),
            tbody: ({ children }) => (
              <tbody className="divide-y divide-white/5">{children}</tbody>
            ),
            tr: ({ children }) => (
              <tr className="hover:bg-white/5 transition-colors duration-200">
                {children}
              </tr>
            ),
            th: ({ children }) => (
              <th className="px-5 md:px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="px-5 md:px-6 py-4 text-gray-300/90">
                {children}
              </td>
            ),
            // Enhanced footnote styling
            sup: ({ children }) => (
              <sup className="text-accent-orange/80 hover:text-accent-purple transition-colors duration-200 cursor-pointer text-xs ml-0.5">
                {children}
              </sup>
            ),
            // Style footnote references and definitions
            section: ({ children, ...props }) => {
              if (props.className?.includes("footnotes")) {
                return (
                  <section className="mt-16 pt-10 border-t border-white/10">
                    {children}
                  </section>
                );
              }
              return <section {...props}>{children}</section>;
            },
            // Horizontal rule
            hr: () => (
              <hr className="my-12 md:my-16 border-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            ),
            // Strong and emphasis
            strong: ({ children }) => (
              <strong className="font-semibold text-white/95">{children}</strong>
            ),
            em: ({ children }) => (
              <em className="italic text-gray-200/90">{children}</em>
            ),
            // Custom plotly-graph element
            "plotly-graph": (props: any) => {
              const { src, title, height } = props;
              // Ensure the component is rendered as a block element
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
  );
}
