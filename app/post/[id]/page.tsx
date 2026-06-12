import { cache } from "react";
import { notFound } from "next/navigation";
import { Post, stripWorkingCopy } from "@/app/lib/supabase";
import PostContent, { type PostNav } from "./PostContent";
import { createPublicClient } from "@/utils/supabase/server";
import { createMetadata, siteConfig } from "@/app/lib/metadata";
import { articleSchema, breadcrumbSchema } from "@/app/lib/structured-data";
import JsonLd from "@/app/components/JsonLd";
import { Metadata } from "next";

interface PostPageProps {
  params: Promise<{ id: string }>;
}

// Enable ISR with 5 minute revalidation for posts
export const revalidate = 300;

// Deduplicate fetchPost calls within the same request (metadata + page)
const fetchPost = cache(async (identifier: string): Promise<Post | null> => {
  try {
    const supabase = createPublicClient();

    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("slug", identifier)
      .eq("is_draft", false)
      .single();

    if (error) return null;
    // never let the writing room's working copy reach the public payload
    return stripWorkingCopy(data);
  } catch (error) {
    console.error("Error fetching post:", error);
    return null;
  }
});

// Adjacent published posts (one newer, one older) for end-of-entry navigation.
const fetchNeighbors = cache(
  async (
    createdAt: string,
  ): Promise<{ prev: PostNav | null; next: PostNav | null }> => {
    try {
      const supabase = createPublicClient();
      const [{ data: newer }, { data: older }] = await Promise.all([
        supabase
          .from("posts")
          .select("slug,title,type")
          .eq("is_draft", false)
          .gt("created_at", createdAt)
          .order("created_at", { ascending: true })
          .limit(1),
        supabase
          .from("posts")
          .select("slug,title,type")
          .eq("is_draft", false)
          .lt("created_at", createdAt)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
      return { prev: newer?.[0] ?? null, next: older?.[0] ?? null };
    } catch (error) {
      console.error("Error fetching neighbors:", error);
      return { prev: null, next: null };
    }
  },
);

// Pre-render all published posts at build time
export async function generateStaticParams() {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("posts")
    .select("slug")
    .eq("is_draft", false);

  return (data || []).map((post) => ({ id: post.slug }));
}

// Helper function to generate excerpt from content
function generateExcerpt(content: string): string {
  const cleanText = content
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*`_~]/g, "")
    .replace(/\n+/g, " ")
    .trim();

  return cleanText.length > 160
    ? cleanText.substring(0, 160) + "..."
    : cleanText;
}

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await fetchPost(id);

  if (!post) {
    return createMetadata({
      title: "Post Not Found",
      description: "The requested post could not be found.",
      noIndex: true,
    });
  }

  return createMetadata({
    title: post.title,
    description: post.description || generateExcerpt(post.content),
    // When no custom image exists, omit it so the generated per-post
    // opengraph-image (app/post/[id]/opengraph-image.tsx) is used.
    image: post.meta_image || post.media_url || undefined,
    path: `/post/${post.slug}`,
    keywords: post.tags?.length
      ? [...siteConfig.keywords, ...post.tags]
      : siteConfig.keywords,
    openGraph: {
      type: "article",
      publishedTime: post.created_at,
      modifiedTime: post.updated_at || post.created_at,
      authors: [siteConfig.author],
      tags: post.tags,
    },
  });
}

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params;
  const post = await fetchPost(id);

  if (!post) {
    notFound();
  }

  const { prev, next } = await fetchNeighbors(post.created_at);

  const postUrl = `${siteConfig.url}/post/${post.slug}`;
  const schemaImage =
    post.meta_image || `${postUrl}/opengraph-image`;

  return (
    <div className="min-h-screen page-reveal">
      <JsonLd
        data={[
          articleSchema(post, schemaImage),
          breadcrumbSchema([
            { name: "home", url: siteConfig.url },
            { name: post.title, url: postUrl },
          ]),
        ]}
      />
      <main className="post-reading relative z-10 min-h-screen py-8 sm:py-10 md:py-16">
        <PostContent key={post.id} post={post} prev={prev} next={next} />
      </main>
    </div>
  );
}
