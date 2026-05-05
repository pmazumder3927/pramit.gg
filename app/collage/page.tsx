import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";

import { fetchLatestHomepageBanner } from "@/app/lib/homepage-banner";
import { createPublicClient } from "@/utils/supabase/server";

import CollageExperience from "./CollageExperience";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-instrument-serif",
});

export const revalidate = 60;

export const metadata: Metadata = {
  title: "the collage",
  description:
    "every confession in the booth comes with a sketch. they all end up here.",
};

type SketchPreview = {
  id: string;
  prompt: string | null;
  snapshot_url: string | null;
  created_at: string;
};

async function fetchSketchPreviews(): Promise<SketchPreview[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("turtle_drawings")
    .select("id, prompt, snapshot_url, created_at")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    console.error("Sketch preview fetch error:", error);
    return [];
  }

  return (data ?? []) as SketchPreview[];
}

export default async function CollagePage() {
  const [banner, sketches] = await Promise.all([
    fetchLatestHomepageBanner(createPublicClient()),
    fetchSketchPreviews(),
  ]);

  return (
    <div className={`${instrumentSerif.variable} page-reveal`}>
      <CollageExperience banner={banner} sketches={sketches} />
    </div>
  );
}
