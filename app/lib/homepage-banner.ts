import OpenAI from "openai";
import { toFile } from "openai/uploads";
import sharp from "sharp";

import {
  DRAWING_CANVAS_HEIGHT,
  DRAWING_CANVAS_WIDTH,
  type DrawingStroke,
} from "@/app/lib/confessional-captcha";
import type { SupabaseClient } from "@supabase/supabase-js";

const BANNER_BUCKET = "images";
const BANNER_PATH_PREFIX = "banners";
const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const DEFAULT_BANNER_SIZE = "1536x1024";
const DEFAULT_BANNER_QUALITY = "medium";

// Cap how many sketches we feed into the reference grid; gpt-image-2 doesn't
// need every last one, and the input image gets large fast.
const MAX_REFERENCE_SKETCHES = 36;

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

  const referencePng = await composeReferenceGrid(sketches);
  const promptText = buildBannerPrompt(sketches);

  const client = new OpenAI({ apiKey });

  const referenceFile = await toFile(referencePng, "sketches.png", {
    type: "image/png",
  });

  const response = await client.images.edit(
    {
      model: process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL,
      image: referenceFile,
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
      ? `The reference grid contains rough finger sketches drawn by visitors of: ${subjects.join("; ")}.`
      : "The reference grid contains rough finger sketches drawn by visitors.";

  return [
    "Create a single wide cinematic banner image suitable as the hero of a personal website.",
    subjectLine,
    "Reinterpret these scribbled sketches as a unified illustrated tapestry: weave the subjects together into one cohesive dreamlike scene at night.",
    "Style: hand-drawn ink and watercolor wash, deep midnight purple and indigo background, soft warm orange and cream highlights, glowing edges, painterly imperfection.",
    "Mood: contemplative, late-night, intimate, slightly mischievous — like a confessional booth painted by ghosts.",
    "Composition: wide horizontal panorama, balanced negative space across the top half so text could overlay it, no visible writing or letters anywhere in the image.",
    "Honor the spirit of the contributors' rough drawings — keep the charm of the originals visible in the linework, even as the scene becomes painterly.",
  ].join(" ");
}

async function composeReferenceGrid(
  sketches: SketchRecord[],
): Promise<Buffer> {
  const sample = sketches.slice(0, MAX_REFERENCE_SKETCHES);
  const cols = Math.min(6, Math.max(2, Math.ceil(Math.sqrt(sample.length))));
  const rows = Math.ceil(sample.length / cols);

  const cellWidth = 320;
  const cellHeight = Math.round(
    (cellWidth * DRAWING_CANVAS_HEIGHT) / DRAWING_CANVAS_WIDTH,
  );
  const padding = 16;

  const canvasWidth = cols * cellWidth + (cols + 1) * padding;
  const canvasHeight = rows * cellHeight + (rows + 1) * padding;

  const cellSvgs = await Promise.all(
    sample.map((sketch) =>
      sharp(Buffer.from(strokesToSvg(sketch.strokes)))
        .resize(cellWidth, cellHeight, { fit: "fill" })
        .png()
        .toBuffer(),
    ),
  );

  const composites = cellSvgs.map((buffer, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    return {
      input: buffer,
      left: padding + col * (cellWidth + padding),
      top: padding + row * (cellHeight + padding),
    };
  });

  return sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 3,
      background: { r: 10, g: 8, b: 20 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

function strokesToSvg(strokes: DrawingStroke[]) {
  const paths = strokes
    .map((stroke) => {
      const points = Array.isArray(stroke?.points) ? stroke.points : [];
      if (points.length === 0) {
        return "";
      }

      const color = sanitizeColor(stroke.color) ?? "#f5f5f5";
      const width = sanitizeWidth(stroke.width) ?? 5;

      if (points.length === 1) {
        const p = points[0];
        return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(width / 2).toFixed(1)}" fill="${color}"/>`;
      }

      const d = points
        .map((point, index) => {
          const command = index === 0 ? "M" : "L";
          return `${command}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
        })
        .join(" ");

      return `<path d="${d}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
    })
    .filter(Boolean)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${DRAWING_CANVAS_WIDTH}" height="${DRAWING_CANVAS_HEIGHT}" viewBox="0 0 ${DRAWING_CANVAS_WIDTH} ${DRAWING_CANVAS_HEIGHT}">
  <rect width="100%" height="100%" fill="#0a0814"/>
  ${paths}
</svg>`;
}

function sanitizeColor(value: unknown) {
  if (typeof value !== "string") return null;
  return /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : null;
}

function sanitizeWidth(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(20, Math.max(1, value));
}
