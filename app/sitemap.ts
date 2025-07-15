import { MetadataRoute } from "next";
import { createClient } from "@/utils/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://pramit.gg";

  // Get all published posts from database
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("posts")
    .select("id, created_at, updated_at")
    .eq("is_draft", false)
    .order("created_at", { ascending: false });

  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/music`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/connect`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  // Dynamic post routes
  const postRoutes: MetadataRoute.Sitemap =
    posts?.map((post) => ({
      url: `${baseUrl}/post/${post.id}`,
      lastModified: new Date(post.updated_at || post.created_at),
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })) || [];

  return [...staticRoutes, ...postRoutes];
}
