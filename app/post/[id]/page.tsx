import { cache } from "react";
import { notFound } from "next/navigation";
import { Post } from "@/app/lib/supabase";
import PostContent from "./PostContent";
import { createPublicClient, createClient } from "@/utils/supabase/server";
import { createMetadata } from "@/app/lib/metadata";
import { createAdminClient } from "@/utils/supabase/admin";
import { Metadata } from "next";

interface PostPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// Enable ISR with 5 minute revalidation for posts
export const revalidate = 300;

// Deduplicate fetchPost calls within the same request (metadata + page)
const fetchPost = cache(async (identifier: string, preview = false): Promise<Post | null> => {
  try {
    if (preview) {
      // Use cookie-aware auth, then fetch via admin client so drafts stay private but viewable in the dashboard.
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const admin = createAdminClient();
      const { data, error } = await admin
        .from("posts")
        .select("*")
        .eq("slug", identifier)
        .single();

      if (error) {
        console.error("Supabase error:", error);
        return null;
      }
      return data;
    }

    // Use public client (no cookies) to enable static generation/ISR
    const supabase = createPublicClient();

    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("slug", identifier)
      .eq("is_draft", false)
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return null;
    }

    if (data) {
      return data;
    }

    return null;
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
    .replace(/!\[.*?\]\(.*?\)/g, "") // Remove images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Convert links to text
    .replace(/[#*`_~]/g, "") // Remove markdown formatting
    .replace(/\n+/g, " ") // Replace newlines with spaces
    .trim();

  return cleanText.length > 160
    ? cleanText.substring(0, 160) + "..."
    : cleanText;
}

export async function generateMetadata({
  params,
  searchParams,
}: PostPageProps): Promise<Metadata> {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const preview = resolvedSearchParams.preview === "true";
  const post = await fetchPost(id, preview);

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
    noIndex: preview,
    openGraph: {
      type: "article",
      publishedTime: post.created_at,
      modifiedTime: post.updated_at || post.created_at,
      authors: ["Pramit Mazumder"],
    },
  });
}

export default async function PostPage({ params, searchParams }: PostPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const preview = resolvedSearchParams.preview === "true";
  const post = await fetchPost(id, preview);

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black page-reveal">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(120,119,198,0.03),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,107,61,0.02),transparent_50%)]" />

      <main className="relative z-10 min-h-screen px-5 py-8 sm:px-6 md:px-8 md:py-16">
        <article className="max-w-2xl md:max-w-3xl lg:max-w-5xl mx-auto">
          <PostContent post={post} />
        </article>
      </main>
    </div>
  );
}
