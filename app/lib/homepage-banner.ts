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

  // images.edit gives us per-stroke fidelity — the model can attend to each
  // contributor's actual wobble. The prompt locks the transformation to a
  // single move (strokes → glowing constellation lines + star-points) so the
  // result remains tied to the originals rather than drifting into generic
  // celestial scenery.
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

function buildBannerPrompt(_sketches: SketchRecord[]) {
  // The reference image carries every contributor's actual hand. The model's
  // job is ONE thing: convert each scribble into a glowing constellation by
  // (1) replacing stroke endpoints and curve corners with bright star-points
  // and (2) running a thin glowing hairline along the path of the stroke
  // itself — so the contributor's wobble, gesture, and composition survive
  // intact. The point is to honor the originals, not to "fix" them or replace
  // them with generic celestial scenery.
  return [
    "TASK: Transform the reference grid of finger-drawn sketches into a single wide cinematic star chart.",
    "Each cell of the reference contains one rough sketch by a different site visitor. Treat the SET of sketches as the source material for a unified constellation map.",
    "TRANSFORMATION (apply consistently to every sketch):",
    "1. Trace the EXACT path of every original stroke — every curve, every wobble, every imperfection. Do not smooth, simplify, straighten, regularize, or beautify the lines. The wobble is the soul of the contribution; the contributor's hand must remain visible.",
    "2. Render each traced stroke as an extremely thin (1px) glowing hairline in soft off-white (#e8e8ea), with the line itself at low brightness (~25% intensity).",
    "3. Place a small bright star-point (a 2–3px luminous dot) at every stroke endpoint, every sharp corner, and every notable inflection along the curve. The stars are the eye-catching element; the hairline between them is barely visible.",
    "4. A small minority of star-points (around 1 in 8) may be in muted warm orange (#ff6b3d) or indigo (#7c77c6); the rest are soft off-white. Keep the palette restrained.",
    "LAYOUT: rearrange the sketches across a wide horizontal panorama as if scattered organically across a night sky. Do NOT preserve the input grid — break the grid, vary the scale of each constellation modestly, leave large negative space between them. The panorama should breathe; subjects must not overlap.",
    "BACKGROUND: pure #000000 across the entire canvas. No stars beyond the constellation points. No gradients, no haze, no atmosphere, no textures, no nebulae, no Milky Way.",
    "WHAT THIS IMAGE IS: a star chart whose constellations were drawn by anonymous visitors. The viewer should be able to recognize 'oh, someone drew a cat' and also 'oh, someone drew a fishbone' from the constellation outlines — because those outlines literally are the strokes the contributors made. Do NOT replace the contributor's drawing with a polished or canonical version of the subject.",
    "HARD RULES: background MUST be pure #000000 (will be screen-blended away). Preserve every original stroke's path. Do not add new strokes the contributor didn't draw. Do not add subjects, decorations, frames, panels, captions, or any text/letters/numerals/labels/watermarks. No watercolor, no painterly brushwork, no glow halos around large areas, no lens flares, no anime, no 3D rendering, no photo-real elements, no shading or fills.",
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
      background: { r: 0, g: 0, b: 0 },
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
  <rect width="100%" height="100%" fill="#000000"/>
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
