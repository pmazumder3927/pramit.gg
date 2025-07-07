"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Post, supabase, generateSlug } from "@/app/lib/supabase";
import PostContent from "./PostContent";

export default function PostPage() {
  const params = useParams();
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingFinishing, setLoadingFinishing] = useState(false);

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
      // Trigger ripple effect and immediately set loading to false
      setLoadingFinishing(true);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black flex items-center justify-center relative">
        <div className="relative">
          {/* Bold outer rotating ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ 
              duration: 2, 
              repeat: loadingFinishing ? 0 : Infinity, 
              ease: 'linear' 
            }}
            className="w-32 h-32 border-2 border-accent-orange/30 rounded-full"
          />
          
          {/* Dramatic pulsing core */}
          <motion.div
            animate={{ 
              scale: [1, 1.8, 1],
              opacity: [0.9, 0.3, 0.9]
            }}
            transition={{ 
              duration: 1.5, 
              repeat: loadingFinishing ? 0 : Infinity, 
              ease: [0.25, 0.1, 0.25, 1]
            }}
            className="absolute inset-0 m-auto w-12 h-12 bg-gradient-to-r from-accent-orange to-accent-purple rounded-full"
          />
          
          {/* Explosive particle burst */}
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                x: [0, Math.cos(i * 30 * Math.PI / 180) * 50, 0],
                y: [0, Math.sin(i * 30 * Math.PI / 180) * 50, 0],
                scale: [0, 1.5, 0],
                opacity: [0, 1, 0]
              }}
              transition={{
                duration: 2,
                repeat: loadingFinishing ? 0 : Infinity,
                delay: i * 0.1,
                ease: [0.25, 0.1, 0.25, 1]
              }}
              className="absolute top-1/2 left-1/2 w-3 h-3 bg-gradient-to-r from-accent-orange to-accent-purple rounded-full transform -translate-x-1/2 -translate-y-1/2"
            />
          ))}
          
          {/* Fast counter-rotating inner ring */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ 
              duration: 1.5, 
              repeat: loadingFinishing ? 0 : Infinity, 
              ease: 'linear' 
            }}
            className="absolute inset-0 m-auto w-20 h-20 border-2 border-accent-purple/40 rounded-full border-dashed"
          />
          
          {/* Intense glowing backdrop */}
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3]
            }}
            transition={{ 
              duration: 2, 
              repeat: loadingFinishing ? 0 : Infinity, 
              ease: [0.25, 0.1, 0.25, 1]
            }}
            className="absolute inset-0 m-auto w-40 h-40 bg-gradient-to-r from-accent-orange/10 to-accent-purple/10 rounded-full blur-2xl -z-10"
          />
          
          {/* Sharp rotating diamond */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ 
              duration: 3, 
              repeat: loadingFinishing ? 0 : Infinity, 
              ease: 'linear' 
            }}
            className="absolute inset-0 m-auto w-6 h-6 bg-white/20 rounded-sm transform rotate-45"
          />
                  </div>
        </div>
    );
  }

  if (!post) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(120,119,198,0.03),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,107,61,0.02),transparent_50%)]" />
      
      {/* Non-blocking ripple overlay */}
      {loadingFinishing && (
        <motion.div
          initial={{ scale: 0, opacity: 0.6 }}
          animate={{ scale: 15, opacity: 0 }}
          transition={{ 
            duration: 0.8, 
            ease: [0.25, 0.1, 0.25, 1] 
          }}
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
        >
          <div className="w-32 h-32 bg-gradient-to-r from-accent-orange/15 to-accent-purple/15 rounded-full blur-xl" />
        </motion.div>
      )}
      
      <main className="relative z-10 min-h-screen px-4 py-8 md:px-8 md:py-16">
        <article className="max-w-4xl mx-auto">
          <PostContent post={post} />
        </article>
      </main>
    </div>
  );
}
