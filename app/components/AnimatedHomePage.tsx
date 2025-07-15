"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Post } from "@/app/lib/supabase";
import PostCard from "@/app/components/PostCard";
import { useInView } from "react-intersection-observer";

interface AnimatedHomePageProps {
  posts: Post[];
  featuredPosts: Post[];
}

export default function AnimatedHomePage({
  posts,
  featuredPosts,
}: AnimatedHomePageProps) {
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  return (
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
                  <PostCard post={post} index={index + 3} featured={false} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.section>
      )}
    </div>
  );
}
