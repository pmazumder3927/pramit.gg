import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import PostContent from "./PostContent";

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

// Server component for fetching data
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(120,119,198,0.03),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,107,61,0.02),transparent_50%)]" />

        <main className="relative z-10 min-h-screen px-4 py-8 md:px-8 md:py-16">
          <article className="max-w-4xl mx-auto">
            <PostContent post={post} />
          </article>
        </main>
      </div>
    </>
  );
}
