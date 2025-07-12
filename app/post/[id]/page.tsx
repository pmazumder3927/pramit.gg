"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Post, supabase, generateSlug } from "@/app/lib/supabase";
import PostContent from "./PostContent";
import Navigation from "@/app/components/Navigation";

export default function PostPage() {
  const params = useParams();
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchPost(params.id as string);
    }
  }, [params.id]);

  const fetchPost = async (identifier: string) => {
    try {
      let foundPost: Post | null = null;
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("slug", identifier)
        .eq("is_draft", false)
        .single();

      if (!error && data) {
        foundPost = data;
      } else {
        // If no match found, redirect to home
        router.push("/");
        return;
      }
      if (foundPost) {
        setPost(foundPost);

        // Increment view count (optimized)
        supabase
          .from("posts")
          .update({ view_count: (foundPost.view_count || 0) + 1 })
          .eq("id", foundPost.id)
          .then(() => {
            // Update local state to reflect new view count
            setPost((prev) =>
              prev ? { ...prev, view_count: (prev.view_count || 0) + 1 } : null
            );
          });
      } else {
        router.push("/");
      }
    } catch (error) {
      console.error("Error fetching post:", error);
      router.push("/");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !post) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(120,119,198,0.03),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,107,61,0.02),transparent_50%)]" />

      <main className="relative z-10 min-h-screen">
        <Navigation />
        <div className="px-4 py-8 md:px-8 md:py-16">
          <article className="max-w-4xl mx-auto">
            <PostContent post={post} />
          </article>
        </div>
      </main>
    </div>
  );
}
