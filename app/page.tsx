"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Post, supabase } from "@/app/lib/supabase";
import PostCard from "@/app/components/PostCard";
import Navigation from "@/app/components/Navigation";
import NowPlaying from "@/app/components/NowPlaying";
import { useInView } from "react-intersection-observer";

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [featuredPosts, setFeaturedPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      console.log("Fetching posts...");
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("is_draft", false)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }

      console.log("Posts fetched successfully:", data?.length || 0);

      if (data) {
        // Set first 3 posts as featured for horizontal scroll
        setFeaturedPosts(data.slice(0, 3));
        setPosts(data.slice(3));
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
      // Log more details about the error
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(120,119,198,0.03),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,107,61,0.02),transparent_50%)]" />

      <main className="relative z-10 min-h-screen">
        <Navigation />

        {/* Hero Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          className="relative pt-20 pb-12 md:pt-32 md:pb-20"
        >
          <div className="max-w-7xl mx-auto px-6 md:px-8">
            <div className="text-center">
              <motion.h1
                className="text-5xl md:text-7xl lg:text-8xl font-extralight tracking-tight mb-6"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 1,
                  delay: 0.2,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
              >
                <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                  pramit mazumder
                </span>
              </motion.h1>
              <motion.p
                className="text-xl md:text-2xl text-gray-400 font-light max-w-2xl mx-auto leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.8,
                  delay: 0.4,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
              >
                a living, evolving journal of interests, projects, and
                experiences
              </motion.p>
            </div>
          </div>
        </motion.section>

        {!isLoading && (
          <div className="max-w-7xl mx-auto px-6 md:px-8">
            {/* Featured Posts - Horizontal Momentum Scroll */}
            {featuredPosts.length > 0 && (
              <motion.section
                className="mb-16 md:mb-24"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.8,
                  delay: 0.6,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
              >
                <div className="mb-8">
                  <motion.h2
                    className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.8 }}
                  >
                    Featured
                  </motion.h2>
                  <motion.div
                    className="h-px bg-gradient-to-r from-accent-orange/20 via-accent-purple/20 to-transparent"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{
                      duration: 0.8,
                      delay: 0.9,
                      ease: [0.25, 0.1, 0.25, 1],
                    }}
                  />
                </div>

                <div className="overflow-x-auto scrollbar-hide ios-momentum-scroll">
                  <div className="flex gap-6 md:gap-8 pb-4">
                    {featuredPosts.map((post, index) => (
                      <motion.div
                        key={post.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                          delay: 0.8 + index * 0.1,
                          duration: 0.6,
                          ease: [0.25, 0.1, 0.25, 1],
                        }}
                        className="flex-shrink-0 w-80 md:w-96 lg:w-[420px]"
                      >
                        <PostCard post={post} index={index} featured={true} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.section>
            )}

            {/* Main Posts Grid */}
            {posts.length === 0 && featuredPosts.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 1 }}
                className="text-center py-24"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-white/5 rounded-full mb-6">
                  <svg
                    className="w-8 h-8 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                    />
                  </svg>
                </div>
                <p className="text-gray-500 text-lg font-light">
                  No posts yet. Check back soon.
                </p>
              </motion.div>
            ) : (
              <motion.section
                className="mb-16"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.8,
                  delay: 1,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
              >
                {posts.length > 0 && (
                  <div className="mb-8">
                    <motion.h2
                      className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.6, delay: 1.2 }}
                    >
                      All Posts
                    </motion.h2>
                    <motion.div
                      className="h-px bg-gradient-to-r from-accent-purple/20 via-accent-orange/20 to-transparent"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{
                        duration: 0.8,
                        delay: 1.3,
                        ease: [0.25, 0.1, 0.25, 1],
                      }}
                    />
                  </div>
                )}

                <div
                  ref={ref}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8"
                >
                  <AnimatePresence mode="popLayout">
                    {posts.map((post, index) => (
                      <motion.div
                        key={post.id}
                        layout
                        initial={{ opacity: 0, y: 40, scale: 0.9 }}
                        animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
                        exit={{
                          opacity: 0,
                          scale: 0.8,
                          transition: { duration: 0.3 },
                        }}
                        transition={{
                          delay: 1.4 + index * 0.05,
                          duration: 0.6,
                          ease: [0.25, 0.1, 0.25, 1],
                        }}
                        className="group"
                      >
                        <PostCard
                          post={post}
                          index={index + 3}
                          featured={false}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </motion.section>
            )}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-24 pb-24 md:pb-16">
          <div className="max-w-7xl mx-auto px-6 md:px-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                <NowPlaying />
              </div>
              <div className="flex items-center gap-6 text-sm text-gray-500">
                <a
                  href="/about"
                  className="hover:text-white transition-colors duration-300 font-light"
                >
                  About
                </a>
                <div className="w-1 h-1 bg-gray-700 rounded-full" />
                <span className="font-light">© 2025 pramit mazumder</span>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
