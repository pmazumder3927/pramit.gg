"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Post, supabase, analyzeContent } from "@/app/lib/supabase";
import PostCard from "@/app/components/PostCard";
import Navigation from "@/app/components/Navigation";
import NowPlaying from "@/app/components/NowPlaying";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { useLoading } from "@/app/hooks/useLoading";
import { useInView } from "react-intersection-observer";

interface PostWithLayout extends Post {
  layoutWeight: number;
  gridSpan: string;
  priority: number;
}

export default function Home() {
  const [posts, setPosts] = useState<PostWithLayout[]>([]);
  const [featuredPosts, setFeaturedPosts] = useState<PostWithLayout[]>([]);
  const { isLoading, stopLoading } = useLoading(true);
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  useEffect(() => {
    fetchPosts();
  }, []);

  // Calculate layout weight based on content richness
  const calculateLayoutWeight = (post: Post): number => {
    const analysis = analyzeContent(post.content || "");
    let weight = 1; // Base weight

    // Content length factor
    if (analysis.wordCount > 800) weight += 2;
    else if (analysis.wordCount > 400) weight += 1;
    else if (analysis.wordCount > 200) weight += 0.5;

    // Media presence factor
    if (post.media_url) weight += 1.5;
    if (analysis.hasMultipleImages) weight += 1;
    else if (analysis.hasImages) weight += 0.5;

    // Content type factor
    if (analysis.contentType === "visual-heavy") weight += 1;
    else if (analysis.contentType === "text-heavy") weight += 0.5;

    // Reading time factor
    if (analysis.readingTime > 8) weight += 1;
    else if (analysis.readingTime > 5) weight += 0.5;

    // Type-specific bonuses
    if (post.type === "climb") weight += 0.5;
    if (post.type === "music") weight += 0.3;

    return Math.min(weight, 4); // Cap at 4 for layout purposes
  };

  // Assign grid spans based on weight and position
  const assignGridLayout = (posts: Post[]): PostWithLayout[] => {
    const postsWithWeight = posts.map((post, index) => ({
      ...post,
      layoutWeight: calculateLayoutWeight(post),
      priority: index,
      gridSpan: "",
    }));

    // Sort by weight (heaviest first) while maintaining some original order
    const sortedPosts = [...postsWithWeight].sort((a, b) => {
      const weightDiff = b.layoutWeight - a.layoutWeight;
      if (Math.abs(weightDiff) < 0.5) {
        // If weights are similar, maintain original order
        return a.priority - b.priority;
      }
      return weightDiff;
    });

    // Assign grid spans based on weight and create organic patterns
    const layoutPosts = sortedPosts.map((post, layoutIndex) => {
      let gridSpan = "";
      
      // Create organic patterns based on weight and position
      if (post.layoutWeight >= 3.5) {
        // Very heavy content - large feature
        gridSpan = "col-span-2 row-span-2 lg:col-span-3 lg:row-span-2";
      } else if (post.layoutWeight >= 2.5) {
        // Heavy content - wide or tall
        if (layoutIndex % 3 === 0) {
          gridSpan = "col-span-2 lg:col-span-2 row-span-1";
        } else {
          gridSpan = "col-span-1 row-span-2 lg:col-span-1 lg:row-span-2";
        }
      } else if (post.layoutWeight >= 2) {
        // Medium-heavy content - occasional wide
        if (layoutIndex % 4 === 1) {
          gridSpan = "col-span-2 lg:col-span-2";
        } else {
          gridSpan = "col-span-1";
        }
      } else if (post.layoutWeight >= 1.5) {
        // Medium content - mix of sizes
        if (layoutIndex % 5 === 2) {
          gridSpan = "col-span-2 lg:col-span-1";
        } else if (layoutIndex % 7 === 4) {
          gridSpan = "col-span-1 row-span-2 lg:row-span-1";
        } else {
          gridSpan = "col-span-1";
        }
      } else {
        // Light content - mostly standard with occasional variations
        if (layoutIndex % 6 === 3) {
          gridSpan = "col-span-2 lg:col-span-1";
        } else {
          gridSpan = "col-span-1";
        }
      }

      return {
        ...post,
        gridSpan,
      };
    });

    // Restore some chronological order while keeping the organic layout
    const finalLayout = layoutPosts.sort((a, b) => {
      const weightDiff = Math.abs(a.layoutWeight - b.layoutWeight);
      if (weightDiff < 1) {
        // If weights are close, prefer chronological order
        return a.priority - b.priority;
      }
      // Otherwise, maintain weight-based ordering with some randomization
      return (b.layoutWeight - a.layoutWeight) + (Math.random() - 0.5) * 0.3;
    });

    return finalLayout;
  };

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
        // Apply organic layout to featured posts as well
        const featuredWithLayout = assignGridLayout(data.slice(0, 3));
        setFeaturedPosts(featuredWithLayout);
        
        // Apply organic layout to remaining posts
        const organicPosts = assignGridLayout(data.slice(3));
        setPosts(organicPosts);
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
      // Log more details about the error
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
    } finally {
      stopLoading();
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

        <LoadingSpinner isLoading={isLoading} className="h-64" />

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
                    {featuredPosts.map((post, index) => {
                      // Dynamic width based on content weight
                      const getFeatureWidth = (weight: number) => {
                        if (weight >= 3.5) return "w-96 md:w-[500px] lg:w-[600px]"; // Extra large
                        if (weight >= 2.5) return "w-80 md:w-[420px] lg:w-[500px]"; // Large
                        if (weight >= 2) return "w-72 md:w-96 lg:w-[420px]"; // Medium
                        return "w-64 md:w-80 lg:w-96"; // Compact
                      };
                      
                      return (
                        <motion.div
                          key={post.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{
                            delay: 0.8 + index * 0.1,
                            duration: 0.6,
                            ease: [0.25, 0.1, 0.25, 1],
                          }}
                          className={`flex-shrink-0 ${getFeatureWidth(post.layoutWeight)}`}
                        >
                          <PostCard 
                            post={post} 
                            index={index} 
                            featured={true}
                            layoutWeight={post.layoutWeight}
                          />
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </motion.section>
            )}

            {/* Organic Posts Grid */}
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
                  className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 auto-rows-max"
                  style={{
                    gridAutoRows: 'minmax(200px, auto)',
                  }}
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
                          delay: 1.4 + index * 0.03,
                          duration: 0.6,
                          ease: [0.25, 0.1, 0.25, 1],
                        }}
                        className={`group ${post.gridSpan}`}
                      >
                        <PostCard
                          post={post}
                          index={index + 3}
                          featured={post.layoutWeight >= 3}
                          layoutWeight={post.layoutWeight}
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
