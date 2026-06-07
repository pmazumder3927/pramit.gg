import { cache } from "react";
import { notFound } from "next/navigation";
import { Post } from "@/app/lib/supabase";
import PostContent from "./PostContent";
import { createPublicClient } from "@/utils/supabase/server";
import { createMetadata } from "@/app/lib/metadata";
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
    return data;
  } catch (error) {
    console.error("Error fetching post:", error);
    return null;
  }
});

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
    image: post.meta_image || post.media_url,
    openGraph: {
      type: "article",
      publishedTime: post.created_at,
      modifiedTime: post.updated_at || post.created_at,
      authors: ["Pramit Mazumder"],
    },
  });
}

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params;
  const post = await fetchPost(id);

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen page-reveal">
      <main className="relative z-10 min-h-screen px-4 py-10 pb-28 sm:px-6 md:px-8 md:py-16 md:pb-16">
        <article className="mx-auto max-w-3xl">
          <PostContent post={post} />
        </article>
      </main>
    </div>
  );
}
