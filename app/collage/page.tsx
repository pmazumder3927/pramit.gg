import {
  fetchAllHomepageBanners,
  type HomepageBanner,
} from "@/app/lib/homepage-banner";
import { createPublicClient } from "@/utils/supabase/server";
import { createMetadata, siteConfig } from "@/app/lib/metadata";

import CollageExperience from "./CollageExperience";

export const revalidate = 60;

export const metadata = createMetadata({
  title: "collage",
  description:
    "every sketch left in the confession booth gets painted into an image along with its peers",
  image: siteConfig.ogImage,
  path: "/collage",
});

type SketchPreview = {
  id: string;
  prompt: string | null;
  snapshot_url: string | null;
  created_at: string;
  banner_id: string | null;
};

async function fetchSketchPreviews(): Promise<SketchPreview[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("turtle_drawings")
    .select("id, prompt, snapshot_url, created_at, banner_id")
    .not("snapshot_url", "is", null)
    .not("banner_id", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Sketch preview fetch error:", error);
    return [];
  }

  return (data ?? []) as SketchPreview[];
}

export default async function CollagePage() {
  const supabase = createPublicClient();
  const [banners, sketches] = await Promise.all([
    fetchAllHomepageBanners(supabase),
    fetchSketchPreviews(),
  ]);

  // Oldest → newest so the latest sits at the right end of the strip.
  const orderedBanners: HomepageBanner[] = [...banners].reverse();

  return (
    <div className="page-reveal">
      <CollageExperience banners={orderedBanners} sketches={sketches} />
    </div>
  );
}
