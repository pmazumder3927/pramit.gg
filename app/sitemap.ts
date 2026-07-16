import { MetadataRoute } from "next";
import { createPublicClient } from "@/utils/supabase/server";
import { siteConfig } from "@/app/lib/metadata";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteConfig.url;

  // Get all published posts from database
  const supabase = createPublicClient();
  const { data: posts } = await supabase
    .from("posts")
    .select("slug, created_at, updated_at, meta_image, media_url")
    .eq("is_draft", false)
    .order("created_at", { ascending: false });

  // Newest post drives the homepage lastModified for fresher crawl signals.
  const latestPostDate = posts?.[0]
    ? new Date(posts[0].updated_at || posts[0].created_at)
    : new Date();

  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: latestPostDate,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/music`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/collage`,
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

  // Dynamic post routes (with image entries for Google Images)
  const postRoutes: MetadataRoute.Sitemap =
    posts?.map((post) => ({
      url: `${baseUrl}/post/${post.slug}`,
      lastModified: new Date(post.updated_at || post.created_at),
      changeFrequency: "monthly" as const,
      priority: 0.9,
      images: [
        post.meta_image ||
          post.media_url ||
          `${baseUrl}/post/${post.slug}/opengraph-image`,
      ],
    })) || [];

  return [...staticRoutes, ...postRoutes];
}
