import { Post } from "@/app/lib/supabase";
import SketchbookHome from "@/app/components/SketchbookHome";
import { fetchLatestHomepageBanner } from "@/app/lib/homepage-banner";
import { createPublicClient } from "@/utils/supabase/server";

async function fetchPosts(): Promise<Post[]> {
  try {
    // Use public client (no cookies) to enable static generation/ISR
    const supabase = createPublicClient();

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

    return data || [];
  } catch (error) {
    console.error("Error fetching posts server-side:", error);
    return [];
  }
}

async function fetchBanner() {
  try {
    const supabase = createPublicClient();
    return await fetchLatestHomepageBanner(supabase);
  } catch (error) {
    console.error("Error fetching banner:", error);
    return null;
  }
}

// Enable ISR with 60 second revalidation
export const revalidate = 60;

export default async function Home() {
  const [posts, banner] = await Promise.all([fetchPosts(), fetchBanner()]);

  return (
    <div className="min-h-screen overflow-x-hidden page-reveal">
      <SketchbookHome
        posts={posts}
        bannerImage={banner?.image_url ?? null}
        sketchCount={banner?.sketch_count ?? 0}
      />
    </div>
  );
}
