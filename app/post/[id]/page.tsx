import { notFound } from "next/navigation";
import { Post } from "@/app/lib/supabase";
import PostContent from "./PostContent";
import { createClient } from "@/utils/supabase/server";

interface PostPageProps {
  params: Promise<{ id: string }>;
}

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

      // Increment view count server-side
      const { error: updateError } = await supabase
        .from("posts")
        .update({ view_count: (data.view_count || 0) + 1 })
        .eq("id", data.id);

      if (updateError) {
        console.error("Error updating view count:", updateError);
      }

      // Return the post with incremented view count
      return {
        ...data,
        view_count: (data.view_count || 0) + 1,
      };
    }

    return null;
  } catch (error) {
    console.error("Error fetching post:", error);
    return null;
  }
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
