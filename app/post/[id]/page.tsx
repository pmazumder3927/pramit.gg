import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import Navigation from "@/app/components/Navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import PostAnimations from "./PostAnimations";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";

interface Props {
  params: Promise<{ id: string }>;
}

// Generate static params for all posts at build time
export async function generateStaticParams() {
  const supabase = await createClient();
  
  const { data: posts } = await supabase
    .from("posts")
    .select("slug")
    .eq("is_draft", false);

  return posts?.map((post) => ({
    id: post.slug,
  })) || [];
}

// Generate dynamic metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  
  const { data: post } = await supabase
    .from("posts")
    .select("*")
    .eq("slug", id)
    .eq("is_draft", false)
    .single();

  if (!post) {
    return {
      title: "Post Not Found | pramit.gg",
      description: "The requested post could not be found.",
    };
  }

  // Extract first image from content for Open Graph
  const imageMatch = post.content?.match(/!\[.*?\]\((.*?)\)/);
  const ogImage = imageMatch ? imageMatch[1] : undefined;

  // Generate excerpt for description
  const cleanContent = post.content
    ?.replace(/!\[.*?\]\(.*?\)/g, "") // Remove images
    ?.replace(/\[.*?\]\(.*?\)/g, "") // Remove links
    ?.replace(/[#*`]/g, "") // Remove markdown
    ?.trim();
  
  const description = cleanContent
    ? cleanContent.substring(0, 160) + (cleanContent.length > 160 ? "..." : "")
    : `Read "${post.title}" on pramit.gg`;

  return {
    title: `${post.title} | pramit.gg`,
    description,
    openGraph: {
      title: post.title,
      description,
      type: "article",
      publishedTime: post.created_at,
      modifiedTime: post.updated_at,
      authors: ["Pramit"],
      tags: post.tags,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: post.title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
    alternates: {
      canonical: `/post/${post.slug}`,
    },
  };
}

// Server component for fetching and rendering data
export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  
  const { data: post, error } = await supabase
    .from("posts")
    .select("*")
    .eq("slug", id)
    .eq("is_draft", false)
    .single();

  if (error || !post) {
    notFound();
  }

  // Increment view count (fire and forget)
  supabase
    .from("posts")
    .update({ view_count: (post.view_count || 0) + 1 })
    .eq("id", post.id)
    .then(() => {});

  // Generate JSON-LD structured data
  const imageMatch = post.content?.match(/!\[.*?\]\((.*?)\)/);
  const articleImage = imageMatch ? imageMatch[1] : undefined;
  
  const cleanContent = post.content
    ?.replace(/!\[.*?\]\(.*?\)/g, "")
    ?.replace(/\[.*?\]\(.*?\)/g, "")
    ?.replace(/[#*`]/g, "")
    ?.trim();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: cleanContent ? cleanContent.substring(0, 160) + (cleanContent.length > 160 ? "..." : "") : "",
    image: articleImage,
    datePublished: post.created_at,
    dateModified: post.updated_at,
    author: {
      "@type": "Person",
      name: "Pramit Mazumder",
      url: "https://pramit.gg"
    },
    publisher: {
      "@type": "Person",
      name: "Pramit Mazumder",
      logo: {
        "@type": "ImageObject",
        url: "https://pramit.gg/favicon.ico"
      }
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://pramit.gg/post/${post.slug}`
    }
  };

  const postDate = new Date(post.created_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const readingTime = Math.ceil(post.content?.split(/\s+/).length / 200) || 1;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(120,119,198,0.03),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,107,61,0.02),transparent_50%)]" />

        <Navigation />

        <main className="relative z-10 min-h-screen px-4 py-8 md:px-8 md:py-16">
          <article className="max-w-4xl mx-auto">
            {/* Back button */}
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
              data-animate="fade-in"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              back to posts
            </Link>

            {/* Post header */}
            <header className="mb-12" data-animate="fade-up">
              <div className="flex items-center gap-4 mb-6 text-sm text-gray-500">
                <time dateTime={post.created_at}>{postDate}</time>
                <span>•</span>
                <span>{readingTime} min read</span>
                <span>•</span>
                <span>{post.view_count || 0} views</span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-light text-white mb-6 leading-tight">
                {post.title}
              </h1>

              <div className="flex flex-wrap gap-2">
                {post.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-gray-400 border border-white/10"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </header>

            {/* Post content */}
            <div 
              className="prose prose-invert prose-lg max-w-none"
              data-animate="fade-up"
              data-delay="200"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex, rehypeHighlight]}
                components={{
                  // Custom components for better styling
                  h1: ({ children }) => (
                    <h1 className="text-3xl font-light text-white mt-12 mb-6">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-2xl font-light text-white mt-10 mb-4">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-xl font-light text-white mt-8 mb-3">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-gray-300 leading-relaxed mb-6">{children}</p>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      className="text-accent-orange hover:text-accent-purple transition-colors underline underline-offset-4"
                      target={href?.startsWith('http') ? '_blank' : undefined}
                      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                    >
                      {children}
                    </a>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside space-y-2 my-6 text-gray-300">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside space-y-2 my-6 text-gray-300">{children}</ol>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-accent-purple/50 pl-6 italic text-gray-400 my-8">
                      {children}
                    </blockquote>
                  ),
                  code: ({ inline, children }) => {
                    if (inline) {
                      return (
                        <code className="px-1.5 py-0.5 rounded bg-white/10 text-accent-orange text-sm">
                          {children}
                        </code>
                      );
                    }
                    return <code>{children}</code>;
                  },
                  pre: ({ children }) => (
                    <pre className="rounded-xl overflow-x-auto my-8 p-6 bg-charcoal-black/50 border border-white/5">
                      {children}
                    </pre>
                  ),
                  img: ({ src, alt }) => (
                    <figure className="my-10">
                      <img
                        src={src}
                        alt={alt}
                        className="rounded-xl w-full"
                        loading="lazy"
                      />
                      {alt && (
                        <figcaption className="text-center text-sm text-gray-500 mt-3">
                          {alt}
                        </figcaption>
                      )}
                    </figure>
                  ),
                }}
              >
                {post.content}
              </ReactMarkdown>
            </div>

            {/* Post footer */}
            <footer className="mt-16 pt-8 border-t border-white/10" data-animate="fade-up" data-delay="400">
              <div className="flex items-center justify-between">
                <Link
                  href="/"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ← Back to all posts
                </Link>
                <div className="text-sm text-gray-500">
                  Updated {new Date(post.updated_at).toLocaleDateString()}
                </div>
              </div>
            </footer>
          </article>
        </main>
      </div>

      {/* Client-side animations */}
      <PostAnimations />
    </>
  );
}
