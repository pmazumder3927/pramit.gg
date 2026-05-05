import OpenAI from "openai";

import { type DrawingStroke } from "@/app/lib/confessional-captcha";
import type { SupabaseClient } from "@supabase/supabase-js";

const BANNER_BUCKET = "images";
const BANNER_PATH_PREFIX = "banners";
const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const DEFAULT_BANNER_SIZE = "1536x1024";
const DEFAULT_BANNER_QUALITY = "medium";

export type SketchRecord = {
  id: string;
  strokes: DrawingStroke[];
  prompt: string | null;
  created_at: string;
};

export type HomepageBanner = {
  id: string;
  image_url: string;
  storage_path: string;
  sketch_count: number;
  prompt: string | null;
  created_at: string;
};

export async function generateHomepageBanner(
  supabase: SupabaseClient,
): Promise<HomepageBanner> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const sketches = await fetchSketches(supabase);
  if (sketches.length === 0) {
    throw new Error("No sketches available to build a banner from.");
  }

  const promptText = buildBannerPrompt(sketches);

  const client = new OpenAI({ apiKey });

  // Text-only generation: passing the sketches as a reference image biased the
  // model toward retracing the input strokes. Without a reference, gpt-image-2
  // has to actually reinterpret each named subject as a celestial element.
  const response = await client.images.generate(
    {
      model: process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL,
      prompt: promptText,
      size: (process.env.OPENAI_IMAGE_SIZE?.trim() ||
        DEFAULT_BANNER_SIZE) as "1536x1024",
      quality: (process.env.OPENAI_IMAGE_QUALITY?.trim() ||
        DEFAULT_BANNER_QUALITY) as "medium",
    },
    { timeout: 180_000 },
  );

  const base64 = response.data?.[0]?.b64_json;
  if (!base64) {
    throw new Error("Image generation returned no image data.");
  }

  const bannerBuffer = Buffer.from(base64, "base64");
  const storagePath = `${BANNER_PATH_PREFIX}/${Date.now()}.png`;

  const { error: uploadError } = await supabase.storage
    .from(BANNER_BUCKET)
    .upload(storagePath, bannerBuffer, {
      contentType: "image/png",
      cacheControl: "31536000",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Banner upload failed: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BANNER_BUCKET).getPublicUrl(storagePath);

  const { data: inserted, error: insertError } = await supabase
    .from("homepage_banners")
    .insert({
      image_url: publicUrl,
      storage_path: storagePath,
      sketch_count: sketches.length,
      prompt: promptText,
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    throw new Error(
      `Banner record insert failed: ${insertError?.message ?? "unknown"}`,
    );
  }

  return inserted as HomepageBanner;
}

export async function fetchLatestHomepageBanner(
  supabase: SupabaseClient,
): Promise<HomepageBanner | null> {
  const { data, error } = await supabase
    .from("homepage_banners")
    .select("id, image_url, storage_path, sketch_count, prompt, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Banner fetch error:", error);
    return null;
  }

  return (data as HomepageBanner) ?? null;
}

async function fetchSketches(
  supabase: SupabaseClient,
): Promise<SketchRecord[]> {
  const { data, error } = await supabase
    .from("turtle_drawings")
    .select("id, strokes, prompt, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load sketches: ${error.message}`);
  }

  return (data ?? []) as SketchRecord[];
}

function buildBannerPrompt(sketches: SketchRecord[]) {
  const subjects = Array.from(
    new Set(
      sketches
        .map((s) => s.prompt?.trim())
        .filter((p): p is string => Boolean(p && p.length > 0)),
    ),
  ).slice(0, 18);

  const subjectLine =
    subjects.length > 0
      ? `Subjects to reinterpret (one per visitor, list may include duplicates of category): ${subjects.join("; ")}.`
      : "A small set of arbitrary subjects drawn by site visitors.";

  // This image is screen-blended at low opacity into a procedural pixel-art
  // starfield (the existing AuroraBackground canvas — stars, constellations,
  // distant terrain silhouettes, drifting satellites). Pure black goes
  // transparent under "screen", so only the bright pixels survive. The model's
  // real job is to TRANSLATE each rough sketch into the visual language of
  // that sky: a constellation of stars+lines, a tiny silhouette on the
  // horizon, or a faint orbital drifter. Don't return the line drawings.
  return [
    "Generate a wide cinematic star chart for a late-night personal website's procedural sky background.",
    subjectLine,
    "Each subject is something a different visitor was prompted to draw. Reinterpret each one as a polished celestial element — do NOT render any of them as doodles, sketches, hand-drawings, or wobbly lines.",
    "For each subject, choose ONE of these treatments and execute it cleanly:",
    "(a) Constellation: place 4–10 small bright star-points (1–2px white dots, occasionally warm orange #ff6b3d or indigo #7c77c6) in a configuration whose connecting hairline (extremely faint, around 8–15% opacity) traces the silhouette of the subject. The stars are the focus; the connecting line is barely visible.",
    "(b) Horizon silhouette: for grounded or architectural subjects, render a tiny crisp pixel-edge silhouette sitting on the very bottom edge of the frame, in deep slate (#1a1b22) backlit by a single accent pixel.",
    "(c) Drifter: a small pixel-art sprite (12–24px) of the subject — flat single-color, no shading, anchored mid-sky.",
    "Mix the three treatments across the subjects so the scene reads as a coherent night sky, not as a single repeated motif. Most subjects should be (a). Reserve (b) for the bottom 10% of the canvas only.",
    "Background: pure #000000 across the entire canvas. No gradients, no haze, no atmosphere, no textures.",
    "Density: SPARSE. Vast negative space between elements. The subjects are small relative to the frame; the chart breathes. No clusters, no overlaps, no grid arrangement — scatter them organically across a wide horizontal panorama.",
    "Palette: predominantly soft off-white (#e8e8ea) star-points and hairlines, with selective accents in muted warm orange (#ff6b3d) and indigo (#7c77c6). No other colors.",
    "Style reference: think NASA-style star chart crossed with a minimalist pixel-art space sim. Quiet, precise, intentional. Apple-restrained.",
    "Hard rules: background MUST be pure #000000 (will be screen-blended away). No text, no letters, no numerals, no labels, no signatures, no watermark, no frame, no border, no panel grid, no caption. No watercolor, no painterly brushwork, no glow halos, no lens flares, no anime, no 3D rendering, no photo-real elements, no full color illustrations. The output must read as scattered tiny luminous marks on a void, NOT as a doodle, NOT as a re-drawing of the input sketches.",
  ].join(" ");
}
