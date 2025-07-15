"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Post } from "@/app/lib/supabase";
import PostCard from "@/app/components/PostCard";
import Navigation from "@/app/components/Navigation";
import NowPlaying from "@/app/components/NowPlaying";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { useLoading } from "@/app/hooks/useLoading";
import { useInView } from "react-intersection-observer";

interface HomePageProps {
  initialPosts: Post[];
}

export default function HomePage({ initialPosts }: HomePageProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts.slice(3));
  const [featuredPosts, setFeaturedPosts] = useState<Post[]>(initialPosts.slice(0, 3));
  const { isLoading, stopLoading } = useLoading(false);
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  useEffect(() => {
    if (initialPosts.length > 0) {
      setFeaturedPosts(initialPosts.slice(0, 3));
      setPosts(initialPosts.slice(3));
    }
  }, [initialPosts]);

  return (
    <>
      <LoadingSpinner isLoading={isLoading} fullscreen={true} />
      <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(120,119,198,0.03),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,107,61,0.02),transparent_50%)]" />

        <Navigation />

        <main className="relative z-10 min-h-screen">
          <section className="relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mb-16"
              >
                <h1 className="font-inter text-4xl md:text-5xl lg:text-6xl font-light text-soft-white leading-tight tracking-tight mb-6">
                  <span className="text-gradient-primary">pramit</span>.gg
                </h1>
                <p className="text-ghost-white/70 text-lg md:text-xl max-w-2xl font-light">
                  a living, evolving journal of interests, projects, and
                  experiences
                </p>
              </motion.div>

              {/* Featured Posts - Horizontal Scroll */}
              {featuredPosts.length > 0 && (
                <div className="mb-20">
                  <motion.h2
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-xl text-ghost-white/70 mb-8 font-light"
                  >
                    Featured
                  </motion.h2>
                  <div className="relative -mx-4 px-4">
                    <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
                      {featuredPosts.map((post, index) => (
                        <motion.div
                          key={post.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex-shrink-0 w-[85vw] sm:w-[400px]"
                        >
                          <PostCard post={post} featured />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Posts - Grid */}
              {posts.length > 0 && (
                <div ref={ref}>
                  <motion.h2
                    initial={{ opacity: 0 }}
                    animate={inView ? { opacity: 1 } : {}}
                    className="text-xl text-ghost-white/70 mb-8 font-light"
                  >
                    Recent
                  </motion.h2>
                  <AnimatePresence mode="wait">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                      {posts.map((post, index) => (
                        <motion.div
                          key={post.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={
                            inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
                          }
                          transition={{ delay: index * 0.05 }}
                        >
                          <PostCard post={post} />
                        </motion.div>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                </div>
              )}

              {posts.length === 0 && featuredPosts.length === 0 && !isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20"
                >
                  <p className="text-ghost-white/50 text-lg">
                    No posts yet. Check back soon!
                  </p>
                </motion.div>
              )}
            </div>
          </section>
        </main>

        <NowPlaying />
      </div>
    </>
  );
}