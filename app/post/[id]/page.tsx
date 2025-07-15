import { notFound } from "next/navigation";
import { Post } from "@/app/lib/supabase";
import PostContent from "./PostContent";
import { createClient } from "@/utils/supabase/server";
import { createMetadata } from "@/app/lib/metadata";
import { Metadata } from "next";

interface PostPageProps {
  params: Promise<{ id: string }>;
}

// Enable ISR with 5 minute revalidation for posts
export const revalidate = 300;

async function fetchPost(identifier: string): Promise<Post | null> {
  try {
    const supabase = await createClient();
    console.log("Fetching post server-side for:", identifier);

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
      console.log("Post fetched successfully server-side:", data.title);
      return data;
    }

    return null;
  } catch (error) {
    console.error("Error fetching post:", error);
    return null;
  }
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
    description: generateExcerpt(post.content),
    image: post.media_url,
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
    <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(120,119,198,0.03),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,107,61,0.02),transparent_50%)]" />

      <main className="relative z-10 min-h-screen px-4 py-8 md:px-8 md:py-16">
        <article className="max-w-4xl mx-auto">
          <PostContent post={post} />
        </article>
      </main>
    </div>
  );
}
