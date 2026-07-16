import { MetadataRoute } from "next";
import { siteConfig } from "@/app/lib/metadata";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = siteConfig.url;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard/",
        "/music/manage/",
        "/music/review/",
        "/music/sequencer/",
        "/post/*/preview",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
