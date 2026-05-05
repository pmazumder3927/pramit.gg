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

  const [bannerWidth, bannerHeight] = (
    (process.env.OPENAI_IMAGE_SIZE?.trim() || DEFAULT_BANNER_SIZE)
      .split("x")
      .map(Number) as [number, number]
  );
  const referencePng = await composeReferenceScattered(
    sketches,
    bannerWidth,
    bannerHeight,
  );
  const promptText = buildBannerPrompt(sketches);

  const client = new OpenAI({ apiKey });

  const referenceFile = await toFile(referencePng, "sketches.png", {
    type: "image/png",
  });

  // The reference is a scattered (non-grid) layout of the contributor sketches
  // on a pure-black canvas matching the output dimensions. The prompt asks the
  // model to weave the subjects into a single cohesive constellation scene —
  // pinpoint stars + ultra-thin hairlines on pure black, suitable for the
  // screen-blend overlay in the procedural sky.
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
      ? `Subjects to incorporate (one per contributor): ${subjects.join("; ")}.`
      : "";

  // Painterly nocturne for the dedicated /collage page. The reference is a
  // scattered (not gridded) layout of every contributor sketch on pure black.
  // The model paints a cinematic moonlit landscape *around* those sketches,
  // preserving their exact silhouettes and idiosyncrasies — the cat keeps its
  // raised paw, the eye keeps its eyelashes and pink tear, etc. The scene
  // wraps the contributors' actual marks rather than replacing them with
  // polished stock illustrations.
  return [
    "A wide cinematic moonlit nocturne — one cohesive painted scene that incorporates every sketched subject from the reference as a natural element of the landscape.",
    subjectLine,
    "CRITICAL: each subject's silhouette must match the contributor's reference sketch as closely as possible — the SAME pose, SAME proportions, SAME quirky details. Do not normalize the cat into a stock cat; if the contributor drew it sitting upright with one paw raised and uneven whiskers, draw THAT cat. If the umbrella has a wobbly handle in the sketch, keep the wobbly handle. The scene should feel like the contributors' drawings have stepped into a painted world, retaining their personality.",
    "Style: refined ink-and-watercolor wash. Deep indigo and midnight teal sky, soft amber moonlight, restrained palette. Atmospheric, late-night, intimate, slightly mysterious. Not cute, not children's-book — Apple-restrained painting craft.",
  ].join(" ");
}

async function composeReferenceScattered(
  sketches: SketchRecord[],
  canvasWidth: number,
  canvasHeight: number,
): Promise<Buffer> {
  const sample = sketches.slice(0, MAX_REFERENCE_SKETCHES);
  const cols = Math.max(3, Math.ceil(Math.sqrt(sample.length * 1.6)));
  const rows = Math.ceil(sample.length / cols);
  const cellW = canvasWidth / cols;
  const cellH = canvasHeight / rows;

  // Scale weights: one anchor, one mid, rest small with mild variation. Gives
  // the model a clear hint that the scene mixes large and small subjects.
  const scales = sample.map((_, i) => {
    if (i === 0) return 0.95;
    if (i === 1) return 0.78;
    return 0.42 + Math.random() * 0.22;
  });

  const usedRects: Array<{ x: number; y: number; w: number; h: number }> = [];
  const placements: Array<{
    buffer: Buffer;
    left: number;
    top: number;
  }> = [];

  for (let i = 0; i < sample.length; i++) {
    const sketch = sample[i];
    const targetW = Math.round(cellW * 1.5 * scales[i]);
    const targetH = Math.round(
      (targetW * DRAWING_CANVAS_HEIGHT) / DRAWING_CANVAS_WIDTH,
    );

    const sketchPng = await sharp(Buffer.from(strokesToSvg(sketch.strokes)))
      .resize(targetW, targetH, { fit: "fill" })
      .png()
      .toBuffer();

    const col = i % cols;
    const row = Math.floor(i / cols);
    let x = Math.round(col * cellW + (cellW - targetW) / 2);
    let y = Math.round(row * cellH + (cellH - targetH) / 2);
    const jitterX = Math.round((Math.random() - 0.5) * cellW * 0.6);
    const jitterY = Math.round((Math.random() - 0.5) * cellH * 0.6);
    x = clamp(x + jitterX, 8, canvasWidth - targetW - 8);
    y = clamp(y + jitterY, 8, canvasHeight - targetH - 8);

    for (let attempt = 0; attempt < 6; attempt++) {
      const conflict = usedRects.find((r) =>
        rectsOverlap(
          { x, y, w: targetW, h: targetH },
          { x: r.x - 24, y: r.y - 24, w: r.w + 48, h: r.h + 48 },
        ),
      );
      if (!conflict) break;
      x = clamp(
        x + Math.round((Math.random() - 0.5) * cellW),
        8,
        canvasWidth - targetW - 8,
      );
      y = clamp(
        y + Math.round((Math.random() - 0.5) * cellH),
        8,
        canvasHeight - targetH - 8,
      );
    }

    usedRects.push({ x, y, w: targetW, h: targetH });
    placements.push({ buffer: sketchPng, left: x, top: y });
  }

  return sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite(
      placements.map((p) => ({ input: p.buffer, left: p.left, top: p.top })),
    )
    .png()
    .toBuffer();
}

function clamp(value: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, value));
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return !(
    a.x + a.w < b.x ||
    b.x + b.w < a.x ||
    a.y + a.h < b.y ||
    b.y + b.h < a.y
  );
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
