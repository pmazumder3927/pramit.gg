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

// Cap how many sketches we stamp; in practice each collage is just the unclaimed
// drawings since the last one, so this is a safety bound, not the common case.
const MAX_REFERENCE_SKETCHES = 36;

// The model only ever sees the doodles as FAINT soft shapes — enough to leave a
// reserved opening for each, never enough to redraw them. The real strokes are
// stamped on top afterward (see stampInk), so recognizability is guaranteed.
const REFERENCE_STROKE_OPACITY = 0.4;

export type SketchRecord = {
  id: string;
  strokes: DrawingStroke[];
  prompt: string | null;
  created_at: string;
  banner_id?: string | null;
};

export type HomepageBanner = {
  id: string;
  image_url: string;
  storage_path: string;
  sketch_count: number;
  prompt: string | null;
  created_at: string;
};

type Canvas = { width: number; height: number };

export async function generateHomepageBanner(
  supabase: SupabaseClient,
): Promise<HomepageBanner> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  // Each collage is built from ONLY the drawings that haven't been claimed by a
  // previous banner — i.e. the new doodles since the last collage. This is the
  // same set we attribute below, so the picture matches its credits and never
  // re-accumulates the whole history.
  const sketches = await fetchUnclaimedSketches(supabase);
  if (sketches.length === 0) {
    throw new Error("No new sketches to build a banner from.");
  }

  const [bannerWidth, bannerHeight] = (
    (process.env.OPENAI_IMAGE_SIZE?.trim() || DEFAULT_BANNER_SIZE)
      .split("x")
      .map(Number) as [number, number]
  );

  const client = new OpenAI({ apiKey });

  // Pull the last few banners for two reasons: (1) the medium-family anti-repeat
  // reads their hidden [lens:*] tags so we never repeat a genre three nights
  // running, and (2) the same-day re-roll salt makes a manual "regenerate" land
  // on a different lens.
  const recent = await fetchAllHomepageBanners(supabase, 8);
  const today = new Date().toISOString().slice(0, 10);
  const reRollSalt = recent.filter(
    (b) => b.created_at?.slice(0, 10) === today,
  ).length;

  const { buffer, promptText } = await composeBanner(sketches, client, {
    recentPrompts: recent.map((b) => b.prompt),
    reRollSalt,
    canvas: { width: bannerWidth, height: bannerHeight },
  });

  const storagePath = `${BANNER_PATH_PREFIX}/${Date.now()}.png`;

  const { error: uploadError } = await supabase.storage
    .from(BANNER_BUCKET)
    .upload(storagePath, buffer, {
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

// Only the doodles not yet claimed by a previous banner — the new drawings since
// the last collage. Ordered oldest-first so the deterministic scene is stable.
async function fetchUnclaimedSketches(
  supabase: SupabaseClient,
): Promise<SketchRecord[]> {
  const { data, error } = await supabase
    .from("turtle_drawings")
    .select("id, strokes, prompt, created_at, banner_id")
    .is("banner_id", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load sketches: ${error.message}`);
  }

  return (data ?? []).filter(
    (s) => Array.isArray((s as SketchRecord).strokes) && (s as SketchRecord).strokes.length,
  ) as SketchRecord[];
}

// ===========================================================================
// THE WHOLE COMPOSE STEP — shared by the nightly run and the regen script.
// ---------------------------------------------------------------------------
// 1. Lock a night lens (medium/palette/mood, anti-repeat) via the art-director.
// 2. Lay the REAL doodles into a little SCENE (sky / ground / water / shelter),
//    with relationships (an umbrella shelters a figure) — composeScene.
// 3. The art-director writes the night's wash prose; the scene's spatial
//    structure is appended, so the prompt asks the model for a coherent washed
//    WORLD (horizon, sky, ground, water, weather) — but NO subjects.
// 4. The model paints only that ground; we stamp the real strokes on top.
// ===========================================================================
export async function composeBanner(
  sketches: SketchRecord[],
  client: OpenAI,
  opts: {
    recentPrompts?: (string | null)[];
    reRollSalt?: number;
    date?: Date;
    canvas: Canvas;
  },
): Promise<{ buffer: Buffer; promptText: string }> {
  const date = opts.date ?? new Date();
  const canvas = opts.canvas;
  const sample = sketches.slice(0, MAX_REFERENCE_SKETCHES);

  const analysis = analyzeNight(sample);
  const recentFamilies = parseRecentFamilies(opts.recentPrompts ?? []);
  const lens = pickLens(analysis, date, opts.reRollSalt ?? 0, recentFamilies);

  const { placements, sceneBits } = composeScene(sample, canvas);

  const directorEnabled = process.env.BANNER_ART_DIRECTOR?.trim() !== "0";
  let out: DirectorOut | null = null;
  if (directorEnabled) {
    out = await directNight(analysis, lens, client, recentFamilies);
  }
  if (!out) out = renderDeterministicProse(analysis, lens);

  const promptText = assemblePrompt(out, lens, sceneBits);
  const imagePrompt = stripLensTag(promptText);

  const buffer = await renderGroundAndStamp(placements, imagePrompt, client, canvas);
  return { buffer, promptText };
}

// ===========================================================================
// SCENE COMPOSITION — place the REAL doodles by their role in a little world.
// ===========================================================================
type Placement = {
  sketch: SketchRecord;
  vb: { x: number; y: number; w: number; h: number };
  left: number;
  top: number;
  w: number;
  h: number;
  role: SceneRole;
};

type SceneRole = "sky" | "water" | "shelter" | "ground" | "misc";

const ROLE_RULES: Array<[SceneRole, RegExp]> = [
  ["sky", /\b(sun|moon|star|cloud|bird|balloon|kite|comet|planet|rainbow|plane|airplane|butterfly|moth|crescent)\b/i],
  ["water", /\b(fish|whale|boat|ship|jelly|jellyfish|shark|wave|crab|octopus|turtle|duck|seal)\b/i],
  ["shelter", /\b(umbrella|parasol)\b/i],
  ["ground", /\b(person|man|woman|guy|girl|kid|child|people|dog|cat|kitten|snail|house|home|building|tree|flower|mushroom|car|truck|hill|mountain|grass|teapot|cup|mug|chair|lamp|robot|monster|dino|dinosaur|snowman|frog|bear|rabbit|bug|worm)\b/i],
];

function classifyRole(prompt: string | null): SceneRole {
  const p = (prompt || "").toLowerCase();
  for (const [role, re] of ROLE_RULES) if (re.test(p)) return role;
  return "misc";
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function sketchBounds(strokes: DrawingStroke[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const st of strokes)
    for (const p of st.points ?? []) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function aspectOf(strokes: DrawingStroke[]) {
  const b = sketchBounds(strokes);
  if (!b || b.w < 2 || b.h < 2) return null;
  const margin = 0.12;
  const vb = {
    x: b.minX - b.w * margin,
    y: b.minY - b.h * margin,
    w: b.w * (1 + margin * 2),
    h: b.h * (1 + margin * 2),
  };
  return { vb, aspect: vb.h / vb.w };
}

// Deterministic jitter from a stable index so re-runs lay out identically.
function jit(i: number, amt: number) {
  const r = Math.sin(i * 127.1 + 9.7) * 43758.5453;
  return (r - Math.floor(r) - 0.5) * 2 * amt;
}

type BandItem = { sketch: SketchRecord; idx: number; role: SceneRole };

function placeBand(
  items: BandItem[],
  canvas: Canvas,
  cfg: { targetH: number; yFrac: number; yJit?: number; anchor?: "center" | "base"; xPad?: number },
): Placement[] {
  const { targetH, yFrac, yJit = 0.04, anchor = "center", xPad = 0.04 } = cfg;
  const W = canvas.width;
  const H = canvas.height;
  const n = items.length;
  if (!n) return [];
  const slotW = (W * (1 - xPad * 2)) / n;
  const out: Placement[] = [];
  items.forEach((it, k) => {
    const ax = aspectOf(it.sketch.strokes);
    if (!ax) return;
    let h = targetH * H;
    let w = h / ax.aspect;
    if (w > slotW * 0.94) {
      w = slotW * 0.94;
      h = w * ax.aspect;
    }
    const cx = W * xPad + slotW * (k + 0.5) + jit(it.idx, slotW * 0.12);
    const cyBase = (yFrac + jit(it.idx, yJit)) * H;
    const left = Math.round(clamp(cx - w / 2, 8, W - w - 8));
    const top =
      anchor === "base"
        ? Math.round(clamp(cyBase - h, 8, H - h - 8))
        : Math.round(clamp(cyBase - h / 2, 8, H - h - 8));
    out.push({ sketch: it.sketch, vb: ax.vb, left, top, w: Math.round(w), h: Math.round(h), role: it.role });
  });
  return out;
}

function coresOverlap(a: Placement, b: Placement, frac = 0.5) {
  const inset = (r: Placement) => ({
    x: r.left + (r.w * (1 - frac)) / 2,
    y: r.top + (r.h * (1 - frac)) / 2,
    w: r.w * frac,
    h: r.h * frac,
  });
  const A = inset(a);
  const B = inset(b);
  return !(A.x + A.w < B.x || B.x + B.w < A.x || A.y + A.h < B.y || B.y + B.h < A.y);
}

// Greedy de-overlap: nudge each item (mostly horizontally, to keep its scene
// band) until its core clears the already-placed ones. Shelters are skipped —
// they're MEANT to overlap the figure they cover.
function resolveCollisions(placements: Placement[], canvas: Canvas) {
  const W = canvas.width;
  const H = canvas.height;
  for (let i = 1; i < placements.length; i++) {
    const p = placements[i];
    if (p.role === "shelter") continue;
    for (let attempt = 0; attempt < 16; attempt++) {
      const hit = placements
        .slice(0, i)
        .find((q) => q.role !== "shelter" && coresOverlap(p, q));
      if (!hit) break;
      const dir = p.left + p.w / 2 < hit.left + hit.w / 2 ? -1 : 1;
      p.left = Math.round(clamp(p.left + dir * p.w * 0.4, 8, W - p.w - 8));
      if (attempt >= 8) {
        const vdir = p.top < hit.top ? -1 : 1;
        p.top = Math.round(clamp(p.top + vdir * p.h * 0.3, 8, H - p.h - 8));
      }
    }
  }
}

// Place the real doodles into a little scene and return the spatial-structure
// sentences for the wash-ground prompt.
function composeScene(
  sketches: SketchRecord[],
  canvas: Canvas,
): { placements: Placement[]; sceneBits: string[] } {
  const items: BandItem[] = sketches.map((s, idx) => ({
    sketch: s,
    idx,
    role: classifyRole(s.prompt),
  }));
  const sky = items.filter((i) => i.role === "sky");
  const water = items.filter((i) => i.role === "water");
  const shelters = items.filter((i) => i.role === "shelter");
  const ground = items.filter((i) => i.role === "ground");
  const misc = items.filter((i) => i.role === "misc");

  const W = canvas.width;
  const H = canvas.height;
  const horizonFrac = 0.64;
  const placements: Placement[] = [];

  // Sky: spread across the top; sun/moon drift toward the upper corners.
  const skySorted = [...sky].sort((a, b) => {
    const wt = (x: BandItem) =>
      /sun/i.test(x.sketch.prompt || "")
        ? -2
        : /moon|crescent/i.test(x.sketch.prompt || "")
          ? -1
          : 0;
    return wt(a) - wt(b);
  });
  placements.push(...placeBand(skySorted, canvas, { targetH: 0.17, yFrac: 0.2, yJit: 0.05, anchor: "center" }));

  // Misc: small, floating in the clear mid-air gap between sky and ground.
  placements.push(...placeBand(misc, canvas, { targetH: 0.14, yFrac: 0.5, yJit: 0.04, anchor: "center", xPad: 0.14 }));

  // Ground: larger foreground figures, base on the horizon line.
  const groundPlaced = placeBand(ground, canvas, {
    targetH: 0.3,
    yFrac: horizonFrac + 0.02,
    yJit: 0.015,
    anchor: "base",
    xPad: 0.06,
  });
  placements.push(...groundPlaced);

  // Water: below the horizon, in the lower band.
  placements.push(...placeBand(water, canvas, { targetH: 0.16, yFrac: 0.84, yJit: 0.04, anchor: "center" }));

  // Shelters: each umbrella shelters the nearest ground figure (placed just
  // above it, slightly overlapping its top). Falls back to mid-air otherwise.
  shelters.forEach((sh, k) => {
    const ax = aspectOf(sh.sketch.strokes);
    if (!ax) return;
    let h = 0.26 * H;
    let w = h / ax.aspect;
    if (w > W * 0.34) {
      w = W * 0.34;
      h = w * ax.aspect;
    }
    const target = groundPlaced[k % Math.max(1, groundPlaced.length)];
    let cx: number;
    let topY: number;
    if (target) {
      cx = target.left + target.w / 2 + jit(sh.idx, 30);
      topY = target.top - h * 0.62;
    } else {
      cx = W * (0.3 + 0.4 * ((k + 1) / (shelters.length + 1)));
      topY = H * 0.24;
    }
    const left = Math.round(clamp(cx - w / 2, 8, W - w - 8));
    const top = Math.round(clamp(topY, 8, H - h - 8));
    placements.push({ sketch: sh.sketch, vb: ax.vb, left, top, w: Math.round(w), h: Math.round(h), role: "shelter" });
  });

  resolveCollisions(placements, canvas);

  // --- scene structure sentences for the wash-ground prompt ----------------
  const hasWater = water.length > 0;
  const hasSky = sky.length > 0 || misc.length > 0;
  const hasRain = shelters.length > 0;
  const sun = placements.find((p) => /sun/i.test(p.sketch.prompt || ""));
  const sunSide = sun ? (sun.left + sun.w / 2 < W / 2 ? "upper-left" : "upper-right") : null;

  const sceneBits = [
    "Compose it as a believable little world rendered ONLY in soft washes: a gentle low horizon-wash about two-thirds down, a settled slightly-warmer ground band below it, and an open graded sky-wash above.",
    hasSky ? "Let the upper air breathe with the faintest drifting cloud-wash." : "",
    sunSide ? `A soft warm glow rests in the ${sunSide} where the light comes from, falling gently across the page.` : "",
    hasWater ? "Along the very bottom, a calm cool water-wash band with the faintest reflection." : "",
    hasRain ? "A whisper of soft rain-wash drifts down through the mid-page, and the ground reads faintly damp beneath it." : "",
  ].filter(Boolean);

  return { placements, sceneBits };
}

// ===========================================================================
// IMAGE PIPELINE — model paints the wash GROUND; we stamp the REAL strokes.
// ===========================================================================
async function renderGroundAndStamp(
  placements: Placement[],
  groundPrompt: string,
  client: OpenAI,
  canvas: Canvas,
): Promise<Buffer> {
  // (1) Faint reference: soft sepia ghosts on warm paper so the model knows
  // where to leave openings, but has nothing crisp to trace.
  const modelRef = await renderStrokeLayer(placements, canvas, {
    opacity: REFERENCE_STROKE_OPACITY,
    inkMode: "defaultsToSepia",
    widthMul: 1.0,
    bg: "#efe5d0",
  });

  // (2) The model paints ONLY the wash world.
  const referenceFile = await toFile(modelRef, "ground.png", { type: "image/png" });
  const sizeStr = `${canvas.width}x${canvas.height}` as "1536x1024";
  const response = await client.images.edit(
    {
      model: process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL,
      image: referenceFile,
      prompt: groundPrompt,
      size: sizeStr,
      quality: (process.env.OPENAI_IMAGE_QUALITY?.trim() ||
        DEFAULT_BANNER_QUALITY) as "medium",
    },
    { timeout: 180_000 },
  );
  const base64 = response.data?.[0]?.b64_json;
  if (!base64) {
    throw new Error("Image generation returned no image data.");
  }
  const ground = Buffer.from(base64, "base64");

  // (3) Stamp the REAL strokes on top, nested into the wash.
  return stampInk(ground, placements, canvas);
}

// --- ink colour handling ---------------------------------------------------
// The captcha canvas is dark, so "default" strokes are near-white (#f5f5f5) or
// the theme dark (#2a2018). On warm paper those must become a dark ink to read.
// Deliberately-chosen colours (purple umbrella, teal rain, gold sun, orange
// tag) are kept — that colour IS the drawing's identity.
const DEFAULT_INKS = new Set(["#f5f5f5", "#2a2018", "#ffffff", "#000000"]);
const SEPIA = "#241a12";

function isDefaultInk(hex: unknown): boolean {
  if (typeof hex !== "string") return true;
  const c = hex.toLowerCase();
  if (DEFAULT_INKS.has(c)) return true;
  const m = /^#([0-9a-f]{6})$/.exec(c);
  if (!m) return false;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  const lum = r + g + b;
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  return (lum > 690 || lum < 60) && sat < 28;
}

function mapInk(color: unknown, inkMode: "keep" | "defaultsToSepia"): string {
  const valid = typeof color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(color);
  if (inkMode === "keep") return valid ? (color as string) : SEPIA;
  if (isDefaultInk(color)) return SEPIA;
  return color as string;
}

function sanitizeWidth(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(20, Math.max(1, value))
    : 5;
}

function strokesToSvg(
  strokes: DrawingStroke[],
  opts: { opacity: number; inkMode: "keep" | "defaultsToSepia"; widthMul: number; bg?: string },
  viewBox: string,
  w: number,
  h: number,
) {
  const { opacity, inkMode, widthMul, bg = "none" } = opts;
  const paths = strokes
    .map((stroke) => {
      const points = Array.isArray(stroke?.points) ? stroke.points : [];
      if (points.length === 0) return "";
      const color = mapInk(stroke.color, inkMode);
      const width = sanitizeWidth(stroke.width) * widthMul;
      if (points.length === 1) {
        const p = points[0];
        return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(width / 2).toFixed(1)}" fill="${color}" fill-opacity="${opacity}"/>`;
      }
      const d = points
        .map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
        .join(" ");
      return `<path d="${d}" stroke="${color}" stroke-width="${width.toFixed(1)}" stroke-opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
    })
    .filter(Boolean)
    .join("");
  const bgRect = bg === "none" ? "" : `<rect width="100%" height="100%" fill="${bg}"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}">${bgRect}${paths}</svg>`;
}

async function tileFor(
  p: Placement,
  opts: { opacity: number; inkMode: "keep" | "defaultsToSepia"; widthMul: number },
): Promise<Buffer> {
  const vbStr = `${p.vb.x.toFixed(1)} ${p.vb.y.toFixed(1)} ${p.vb.w.toFixed(1)} ${p.vb.h.toFixed(1)}`;
  const svg = strokesToSvg(p.sketch.strokes, opts, vbStr, p.w, p.h);
  return sharp(Buffer.from(svg)).resize(p.w, p.h, { fit: "fill" }).png().toBuffer();
}

async function renderStrokeLayer(
  placements: Placement[],
  canvas: Canvas,
  opts: { opacity: number; inkMode: "keep" | "defaultsToSepia"; widthMul: number; bg?: string },
): Promise<Buffer> {
  const tiles: sharp.OverlayOptions[] = [];
  for (const p of placements) {
    tiles.push({ input: await tileFor(p, opts), left: p.left, top: p.top });
  }
  const bg = opts.bg ?? "none";
  const base =
    bg === "none"
      ? sharp({
          create: {
            width: canvas.width,
            height: canvas.height,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          },
        })
      : sharp({
          create: {
            width: canvas.width,
            height: canvas.height,
            channels: 3,
            background: hexToRgb(bg),
          },
        });
  return base.composite(tiles).png().toBuffer();
}

// Stamp the real strokes onto the wash ground so the ink sits IN the paper:
// a soft blurred shadow under the crisp line nests it into the wash.
async function stampInk(
  ground: Buffer,
  placements: Placement[],
  canvas: Canvas,
): Promise<Buffer> {
  const ink = await renderStrokeLayer(placements, canvas, {
    opacity: 1,
    inkMode: "defaultsToSepia",
    widthMul: 1.15,
  });
  const shadow = await sharp(ink).blur(3).png().toBuffer();
  return sharp(ground)
    .composite([
      { input: shadow, blend: "multiply" },
      { input: ink, blend: "over" },
    ])
    .png()
    .toBuffer();
}

function hexToRgb(hex: string) {
  const m = hex.replace("#", "");
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  };
}

// Re-export drawing canvas constants kept for any callers that imported them.
export { DRAWING_CANVAS_WIDTH, DRAWING_CANVAS_HEIGHT };
