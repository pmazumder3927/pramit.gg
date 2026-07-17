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

// The strip renders every banner it's handed and a new collage lands every
// night, so cap the fetch or the page (and its image payload) grows without
// bound. 12 keeps everything visible today with headroom.
const BANNER_LIMIT = 12;
// Safety bound on the sketch payload. Scoped to the rendered banners below, so
// if it ever bites it trims the oldest walls instead of emptying them outright.
const SKETCH_LIMIT = 60;

async function fetchSketchPreviews(
  bannerIds: string[],
): Promise<SketchPreview[]> {
  if (bannerIds.length === 0) return [];
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("turtle_drawings")
    .select("id, prompt, snapshot_url, created_at, banner_id")
    .not("snapshot_url", "is", null)
    .in("banner_id", bannerIds)
    .order("created_at", { ascending: false })
    .limit(SKETCH_LIMIT);

  if (error) {
    console.error("Sketch preview fetch error:", error);
    return [];
  }

  return (data ?? []) as SketchPreview[];
}

export default async function CollagePage() {
  const supabase = createPublicClient();
  const banners = await fetchAllHomepageBanners(supabase, BANNER_LIMIT);
  // Only the sketches behind the banners we actually render ship to the client.
  const sketches = await fetchSketchPreviews(banners.map((b) => b.id));

  // Oldest → newest so the latest sits at the right end of the strip.
  const orderedBanners: HomepageBanner[] = [...banners].reverse();

  return (
    <div className="page-reveal">
      <CollageExperience banners={orderedBanners} sketches={sketches} />
    </div>
  );
}
