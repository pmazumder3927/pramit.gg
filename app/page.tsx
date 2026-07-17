import { stripWorkingCopy } from "@/app/lib/supabase";
import SketchbookHome from "@/app/components/SketchbookHome";
import { fetchLatestHomepageBanner } from "@/app/lib/homepage-banner";
import { HomePost, trimPostForHome } from "@/app/lib/homePosts";
import { rankPosts } from "@/app/lib/rankPosts";
import { createPublicClient } from "@/utils/supabase/server";

async function fetchPosts(): Promise<HomePost[]> {
  try {
    // Use public client (no cookies) to enable static generation/ISR
    const supabase = createPublicClient();

    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("is_draft", false)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    // never let the writing room's working copies reach the public payload;
    // trim the full markdown down to precomputed previews (see homePosts)
    return rankPosts((data || []).map(stripWorkingCopy)).map(trimPostForHome);
  } catch (error) {
    console.error("Error fetching posts server-side:", error);
    // Fail the render instead of returning [] — a transient Supabase error
    // during ISR regeneration would otherwise cache a postless homepage.
    // Throwing keeps the last good snapshot being served.
    throw error;
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
