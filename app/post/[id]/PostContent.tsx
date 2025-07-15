"use client";

import { motion } from "motion/react";
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
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";

interface PostContentProps {
  post: Post;
}

export default function PostContent({ post }: PostContentProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8 group"
      >
        <svg
          className="w-4 h-4 transition-transform group-hover:-translate-x-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        back to home
      </Link>

      {/* Post Header */}
      <header className="mb-12">
        <div className="flex items-center gap-4 mb-6">
          <span
            className="text-sm px-3 py-1 rounded-full bg-white/5 border border-white/10 font-light"
            style={{ color: post.accent_color }}
          >
            {post.type}
          </span>
          <span className="text-sm text-gray-500">
            {formatDistanceToNow(new Date(post.created_at), {
              addSuffix: true,
            })}
          </span>
          <ViewCountTracker
            postId={post.id}
            initialViewCount={post.view_count || 0}
          />
        </div>
        <h1 className="text-4xl md:text-6xl font-extralight mb-6 leading-tight">
          <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
            {post.title}
          </span>
        </h1>
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-sm px-3 py-1 rounded-full bg-white/5 text-gray-400 border border-white/10"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Media */}
      {post.media_url && (
        <div className="mb-12">
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
          rehypePlugins={[rehypeKatex, rehypeHighlight]}
          components={{
            h1: ({ children }) => (
              <h1 className="text-3xl font-light mt-8 mb-4 text-white">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-2xl font-light mt-6 mb-3 text-white">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-xl font-light mt-4 mb-2 text-white">
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p className="text-gray-300 leading-relaxed mb-4">{children}</p>
            ),
            img: (props) => {
              const { src, alt } = props;
              return (
                <span className="block relative w-full my-8 rounded-2xl overflow-hidden bg-gradient-to-br from-charcoal-black/90 to-void-black/90 backdrop-blur-xl border border-white/10">
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
              return (
                <div className="block relative w-full my-8 rounded-2xl overflow-hidden bg-gradient-to-br from-charcoal-black/90 to-void-black/90 backdrop-blur-xl border border-white/10">
                  <video
                    {...props}
                    className="w-full h-auto"
                    controls
                    preload="metadata"
                  >
                    {children}
                  </video>
                </div>
              );
            },
            a: ({ href, children }) => (
              <a
                href={href}
                className="text-accent-orange hover:text-accent-purple transition-colors hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
            code: (props: any) =>
              props.inline ? (
                <code className="px-2 py-1 bg-white/10 rounded text-sm font-mono text-accent-orange">
                  {props.children}
                </code>
              ) : (
                <code className="font-mono">{props.children}</code>
              ),
            pre: ({ children }) => (
              <pre className="bg-gradient-to-br from-charcoal-black/90 to-void-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 overflow-x-auto my-6 text-sm">
                {children}
              </pre>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-accent-orange pl-6 my-6 italic text-gray-400 bg-white/5 py-4 rounded-r-lg">
                {children}
              </blockquote>
            ),
            ul: ({ children }) => (
              <ul className="space-y-3 my-6 text-gray-300">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-inside space-y-3 my-6 text-gray-300 [&>li]:pl-2">
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className="text-gray-300 leading-relaxed pl-2 relative before:content-['•'] before:text-accent-orange before:absolute before:-left-4 before:top-0 before:text-lg before:font-bold ml-6">
                {children}
              </li>
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto my-8 rounded-2xl bg-gradient-to-br from-charcoal-black/90 to-void-black/90 backdrop-blur-xl border border-white/10">
                <table className="w-full text-sm">{children}</table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className="bg-white/5 border-b border-white/10">
                {children}
              </thead>
            ),
            tbody: ({ children }) => (
              <tbody className="divide-y divide-white/10">{children}</tbody>
            ),
            tr: ({ children }) => (
              <tr className="hover:bg-white/5 transition-colors duration-200">
                {children}
              </tr>
            ),
            th: ({ children }) => (
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="px-6 py-4 text-gray-300 whitespace-nowrap">
                {children}
              </td>
            ),
            // Enhanced footnote styling
            sup: ({ children }) => (
              <sup className="text-accent-orange hover:text-accent-purple transition-colors cursor-pointer">
                {children}
              </sup>
            ),
            // Style footnote references and definitions
            section: ({ children, ...props }) => {
              if (props.className?.includes("footnotes")) {
                return (
                  <section className="mt-12 pt-8 border-t border-white/20">
                    {children}
                  </section>
                );
              }
              return <section {...props}>{children}</section>;
            },
          }}
        >
          {post.content}
        </ReactMarkdown>
      </div>
    </motion.div>
  );
}
