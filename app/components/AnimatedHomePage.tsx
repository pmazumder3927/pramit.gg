"use client";

import { motion } from "motion/react";
import { Post } from "@/app/lib/supabase";
import ChaoticArticleGrid from "@/app/components/ChaoticArticleGrid";

interface AnimatedHomePageProps {
  posts: Post[];
  featuredPosts: Post[];
}

export default function AnimatedHomePage({
  posts,
  featuredPosts,
}: AnimatedHomePageProps) {
  // Combine all posts for the chaotic display
  const allPosts = [...featuredPosts, ...posts];

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-8">
      {/* Section header */}
      <motion.div
        className="mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <div className="flex items-center gap-4 mb-4">
          <motion.h2
            className="text-sm font-medium text-gray-500 uppercase tracking-widest"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            Writing
          </motion.h2>
          <motion.div
            className="flex-1 h-px bg-gradient-to-r from-accent-orange/30 via-accent-purple/20 to-transparent"
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1, delay: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          />
        </div>
        <motion.p
          className="text-gray-600 text-sm max-w-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          Thoughts on climbing, code, music, and everything in between
        </motion.p>
      </motion.div>

      {/* Chaotic Article Grid */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.8 }}
      >
        <ChaoticArticleGrid posts={allPosts} />
      </motion.section>
    </div>
  );
}
