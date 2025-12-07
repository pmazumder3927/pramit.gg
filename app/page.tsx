import { Post } from "@/app/lib/supabase";
import AnimatedHomePage from "@/app/components/AnimatedHomePage";
import AnimatedHero from "@/app/components/AnimatedHero";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";

async function fetchPosts() {
  try {
    const supabase = await createClient();
    console.log("Fetching posts server-side...");

    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("is_draft", false)
      .order("is_pinned", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    console.log("Posts fetched successfully server-side:", data?.length || 0);
    return data || [];
  } catch (error) {
    console.error("Error fetching posts server-side:", error);
    return [];
  }
}

// Enable ISR with 60 second revalidation
export const revalidate = 60;

export default async function Home() {
  const allPosts = await fetchPosts();

  // Set first 3 posts as featured for horizontal scroll
  const featuredPosts = allPosts.slice(0, 3);
  const posts = allPosts.slice(3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black overflow-x-hidden page-reveal">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(120,119,198,0.03),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,107,61,0.02),transparent_50%)]" />

      <main className="relative z-10 min-h-screen">

        {/* Hero Section */}
        <AnimatedHero />

        {/* Animated Posts Content */}
        <AnimatedHomePage posts={posts} featuredPosts={featuredPosts} />

        {/* Footer */}
        <footer className="mt-24 pb-24 md:pb-16">
          <div className="max-w-7xl mx-auto px-6 md:px-8">
            <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
              <Link
                href="/about"
                className="hover:text-white transition-colors duration-300 font-light"
              >
                About
              </Link>
              <div className="w-1 h-1 bg-gray-700 rounded-full" />
              <span className="font-light">© 2025 pramit mazumder</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
