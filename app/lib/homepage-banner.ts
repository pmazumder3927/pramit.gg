import OpenAI from "openai";
import { toFile } from "openai/uploads";
import sharp from "sharp";

import {
  analyzeNight,
  assemblePrompt,
  directNight,
  parseRecentFamilies,
  pickLens,
  renderDeterministicProse,
  stripLensTag,
  type DirectorOut,
} from "@/app/lib/banner-art-director";
import {
  DRAWING_CANVAS_HEIGHT,
  DRAWING_CANVAS_WIDTH,
  type DrawingStroke,
} from "@/app/lib/confessional-captcha";
import { createAdminClient } from "@/utils/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const BANNER_BUCKET = "images";
const BANNER_PATH_PREFIX = "banners";
const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const DEFAULT_BANNER_SIZE = "1536x1024";
const DEFAULT_BANNER_QUALITY = "medium";

// Cap how many sketches we feed into the reference grid; gpt-image-2 doesn't
// need every last one, and the input image gets large fast.
const MAX_REFERENCE_SKETCHES = 36;

// The reference is deliberately faint so the image-conditioned edit reads the
// doodles as a gestural score to weave, not a crisp stencil to trace. This is
// the single highest-leverage lever for clean, abstract incorporation.
const REFERENCE_STROKE_OPACITY = 0.55;

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

  const client = new OpenAI({ apiKey });

  // Pull the last few banners for two reasons: (1) the medium-family anti-repeat
  // reads their hidden [lens:*] tags so we never repeat a genre three nights
  // running, and (2) the same-day re-roll salt makes a manual "regenerate" land
  // on a different lens while re-rendering an existing /collage row stays stable.
  const recent = await fetchAllHomepageBanners(supabase, 8);
  const today = new Date().toISOString().slice(0, 10);
  const reRollSalt = recent.filter(
    (b) => b.created_at?.slice(0, 10) === today,
  ).length;

  const promptText = await buildBannerPrompt(sketches, {
    client,
    recentPrompts: recent.map((b) => b.prompt),
    reRollSalt,
  });
  // The [lens:*] tag is bookkeeping for tomorrow's anti-repeat — never send it
  // to the image model.
  const imagePrompt = stripLensTag(promptText);

  const referenceFile = await toFile(referencePng, "sketches.png", {
    type: "image/png",
  });

  // The reference is a softened, overlapping scatter of the contributor sketches
  // on a pure-black canvas matching the output dimensions — faint enough that the
  // image-conditioned edit reads it as a gestural score, not a stencil to trace.
  // buildBannerPrompt picks a fresh medium / composition / mood lens each night
  // (see banner-art-director.ts), so the genre and palette vary instead of
  // collapsing to one repeated nocturne.
  const response = await client.images.edit(
    {
      model: process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL,
      image: referenceFile,
      prompt: imagePrompt,
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

  // Attribute every sketch that hadn't yet been claimed to this banner so the
  // collage page can render "the sketches behind it" per painting. This runs
  // through the service-role client because turtle_drawings RLS only grants
  // INSERT/SELECT — an UPDATE via the authenticated user client silently
  // matches zero rows, leaving new banners with no credits.
  const admin = createAdminClient();
  const { data: attributed, error: attributionError } = await admin
    .from("turtle_drawings")
    .update({ banner_id: inserted.id })
    .is("banner_id", null)
    .select("id");

  if (attributionError) {
    console.error("Sketch attribution failed:", attributionError.message);
  } else {
    console.log(
      `Attributed ${attributed?.length ?? 0} sketches to banner ${inserted.id}`,
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

export async function fetchAllHomepageBanners(
  supabase: SupabaseClient,
  limit = 60,
): Promise<HomepageBanner[]> {
  const { data, error } = await supabase
    .from("homepage_banners")
    .select("id, image_url, storage_path, sketch_count, prompt, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Banner history fetch error:", error);
    return [];
  }

  return (data ?? []) as HomepageBanner[];
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

// Build the night's gpt-image-2 prompt via the "night curator" pipeline
// (banner-art-director.ts): read deterministic signals from the doodles, lock a
// curated medium x composition x mood x abstraction lens (seeded, signal-biased,
// with a hard anti-repeat on recent nights), then either let a constrained
// gpt-5.5 director write the night's fusion prose or fall back to deterministic
// on-brand prose. Returns the FULL prompt *including* the hidden
// [lens:*] tag; the caller strips it before the image call and stores the tagged
// string so tomorrow can read the family back out.
//
// The art-director is on by default; set BANNER_ART_DIRECTOR=0 to ship the
// deterministic deck alone (no extra LLM call).
async function buildBannerPrompt(
  sketches: SketchRecord[],
  opts?: {
    client?: OpenAI | null;
    recentPrompts?: (string | null)[];
    date?: Date;
    reRollSalt?: number;
  },
): Promise<string> {
  const date = opts?.date ?? new Date();
  const analysis = analyzeNight(sketches);
  const recentFamilies = parseRecentFamilies(opts?.recentPrompts ?? []);
  const lens = pickLens(analysis, date, opts?.reRollSalt ?? 0, recentFamilies);

  const directorEnabled = process.env.BANNER_ART_DIRECTOR?.trim() !== "0";

  let out: DirectorOut | null = null;
  if (directorEnabled && opts?.client) {
    out = await directNight(analysis, lens, opts.client, recentFamilies);
  }
  if (!out) out = renderDeterministicProse(analysis, lens);

  return assemblePrompt(out, lens);
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
    const jitterX = Math.round((Math.random() - 0.5) * cellW * 0.9);
    const jitterY = Math.round((Math.random() - 0.5) * cellH * 0.9);
    x = clamp(x + jitterX, 8, canvasWidth - targetW - 8);
    y = clamp(y + jitterY, 8, canvasHeight - targetH - 8);

    // Allow generous overlap so the doodles intermingle into one field — only
    // nudge apart when two sketches would almost completely stack (reads as a
    // single blob). Each rect is inset to its inner ~30% core before testing,
    // so partial overlap is permitted by design and the marks weave together.
    for (let attempt = 0; attempt < 4; attempt++) {
      const conflict = usedRects.find((r) =>
        rectsOverlap(insetRect({ x, y, w: targetW, h: targetH }), insetRect(r)),
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

// Shrink a rect to its inner ~30% core so the overlap test only fires on heavy
// stacking — partial overlap between sketches is allowed (and desired).
function insetRect(r: { x: number; y: number; w: number; h: number }) {
  return {
    x: r.x + r.w * 0.35,
    y: r.y + r.h * 0.35,
    w: r.w * 0.3,
    h: r.h * 0.3,
  };
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
        return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(width / 2).toFixed(1)}" fill="${color}" fill-opacity="${REFERENCE_STROKE_OPACITY}"/>`;
      }

      const d = points
        .map((point, index) => {
          const command = index === 0 ? "M" : "L";
          return `${command}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
        })
        .join(" ");

      return `<path d="${d}" stroke="${color}" stroke-width="${width}" stroke-opacity="${REFERENCE_STROKE_OPACITY}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
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
