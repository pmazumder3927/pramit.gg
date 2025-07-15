import { createClient } from "@/utils/supabase/server";
import HomeClient from "./components/HomeClient";

export default async function Home() {
  const supabase = await createClient();
  
  const { data: posts, error } = await supabase
    .from("posts")
    .select("*")
    .eq("is_draft", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching posts:", error);
  }

  const featuredPosts = posts?.slice(0, 3) || [];
  const remainingPosts = posts?.slice(3) || [];

  return <HomeClient featuredPosts={featuredPosts} posts={remainingPosts} />;
}
