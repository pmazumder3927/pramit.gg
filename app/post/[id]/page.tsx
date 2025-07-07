"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Post, supabase, generateSlug } from "@/app/lib/supabase";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { useLoading } from "@/app/hooks/useLoading";
import PostContent from "./PostContent";

export default function PostPage() {
  const params = useParams();
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const { isLoading, stopLoading } = useLoading(true);

  useEffect(() => {
    if (params.id) {
      fetchPost(params.id as string);
    }
  }, [params.id]);

  const fetchPost = async (identifier: string) => {
    try {
      let foundPost: Post | null = null;
      
      // First, try to find by ID (UUID format)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
      
      if (isUUID) {
        const { data, error } = await supabase
          .from("posts")
          .select("*")
          .eq("id", identifier)
          .eq("is_draft", false)
          .single();

        if (!error && data) {
          foundPost = data;
          
          // Redirect to slug-based URL for better SEO
          const slug = generateSlug(data.title);
          if (slug !== identifier) {
            router.replace(`/post/${slug}`);
            return;
          }
        }
      } else {
        // Optimized slug lookup - try to use database query first
        const { data: allPosts, error } = await supabase
          .from("posts")
          .select("*")
          .eq("is_draft", false)
          .order("created_at", { ascending: false });

        if (!error && allPosts) {
          const matchingPost = allPosts.find(post => generateSlug(post.title) === identifier);
          
          if (matchingPost) {
            foundPost = matchingPost;
          } else {
            // If no match found, redirect to home
            router.push("/");
            return;
          }
        }
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
            setPost(prev => prev ? { ...prev, view_count: (prev.view_count || 0) + 1 } : null);
          });
      } else {
        router.push("/");
      }
    } catch (error) {
      console.error("Error fetching post:", error);
      router.push("/");
    } finally {
      stopLoading();
    }
  };

    if (isLoading) {
    return <LoadingSpinner isLoading={isLoading} fullscreen={true} />;
  }

  if (!post) return null;

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
