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
      {/* Chaotic Article Grid with integrated search */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.4 }}
      >
        <ChaoticArticleGrid posts={allPosts} />
      </motion.section>
    </div>
  );
}
