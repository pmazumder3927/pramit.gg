/* eslint-disable no-console */
// Generate REAL collage images through the production "night curator" pipeline
// against the current Supabase sketch pool, so we can eyeball the actual output.
// Simulates N consecutive nights (date advances, prior families feed anti-repeat)
// so we see genuine genre variety. Uses the real banner-art-director module +
// the same softened reference composition as app/lib/homepage-banner.ts.
//
// Usage:
//   npx tsx banner-experiments/generate-real.ts            # 4 nights, medium quality
//   npx tsx banner-experiments/generate-real.ts 3 low      # 3 nights, low quality (cheaper/faster)
//
// Output: banner-experiments/real-eval/<ts>/nightN_<medium>x<comp>{,_reference}.png + _prompt.txt

import "dotenv/config";

import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import * as path from "path";
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
} from "../app/lib/banner-art-director";

const DRAWING_CANVAS_WIDTH = 480;
const DRAWING_CANVAS_HEIGHT = 320;
const REFERENCE_STROKE_OPACITY = 0.55;
const CANVAS_W = 1536;
const CANVAS_H = 1024;
const MAX_REFERENCE_SKETCHES = 36;

type DrawingPoint = { x: number; y: number };
type DrawingStroke = { points: DrawingPoint[]; color?: string; width?: number };
type SketchRecord = {
  id: string;
  strokes: DrawingStroke[];
  prompt: string | null;
  created_at: string;
};

async function main() {
  const args = process.argv.slice(2);
  const nights = Number(args.find((a) => /^\d+$/.test(a))) || 4;
  const quality = (args.find((a) => /^(low|medium|high)$/.test(a)) ||
    "medium") as "low" | "medium" | "high";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!supabaseUrl || !supabaseKey || !openaiKey) {
    throw new Error("missing env: SUPABASE url/key or OPENAI_API_KEY");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from("turtle_drawings")
    .select("id, strokes, prompt, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const sketches = (data ?? []) as SketchRecord[];
  const analysis = analyzeNight(sketches as never);
  console.log(
    `Loaded ${sketches.length} sketches · ${analysis.count} subjects · ` +
      `density=${analysis.density} · catRatio=${analysis.catRatio.toFixed(2)} · ` +
      `theme=${analysis.centerOfGravity ?? "—"} · inkBias=${analysis.inkBias ?? "—"}`,
  );
  console.log(`Generating ${nights} night(s) at ${quality} quality...`);

  const client = new OpenAI({ apiKey: openaiKey });
  const stamp = "run";
  const outDir = path.resolve(process.cwd(), "banner-experiments", "real-eval", stamp);
  await fs.mkdir(outDir, { recursive: true });

  let recentPrompts: (string | null)[] = [];
  for (let day = 0; day < nights; day++) {
    const date = new Date(Date.UTC(2026, 5, day + 1));
    const families = parseRecentFamilies(recentPrompts);
    const lens = pickLens(analysis, date, 0, families);
    const tag = `night${day + 1}_${lens.medium.id}x${lens.composition.id}`;
    console.log(`\n[${tag}] directing (avoiding: ${families.join(", ") || "none"})...`);

    let out: DirectorOut | null = await directNight(analysis, lens, client, families);
    const usedDirector = !!out;
    if (!out) out = renderDeterministicProse(analysis, lens);
    const tagged = assemblePrompt(out, lens);
    const imagePrompt = stripLensTag(tagged);
    console.log(`  director: ${usedDirector ? "gpt-5.5 ✓" : "fallback (deterministic)"}`);
    console.log(`  fusion: ${out.fusionConcept || "(n/a)"}`);

    const referencePng = await composeReferenceScattered(sketches);
    await fs.writeFile(path.join(outDir, `${tag}_reference.png`), referencePng);
    await fs.writeFile(path.join(outDir, `${tag}_prompt.txt`), tagged);

    const referenceFile = await toFile(referencePng, "sketches.png", { type: "image/png" });
    const t0 = Date.now();
    const res = await client.images.edit(
      { model: "gpt-image-2", image: referenceFile, prompt: imagePrompt, size: "1536x1024", quality },
      { timeout: 240_000 },
    );
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) {
      console.log("  ⚠ no image returned");
      continue;
    }
    await fs.writeFile(path.join(outDir, `${tag}.png`), Buffer.from(b64, "base64"));
    console.log(`  ✓ image saved in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${tag}.png`);

    recentPrompts = [tagged, ...recentPrompts].slice(0, 3);
  }
  console.log(`\nDone. Images in ${outDir}`);
}

// --- softened reference composition, mirrors app/lib/homepage-banner.ts -----
async function composeReferenceScattered(sketches: SketchRecord[]): Promise<Buffer> {
  const sample = sketches.slice(0, MAX_REFERENCE_SKETCHES);
  const cols = Math.max(3, Math.ceil(Math.sqrt(sample.length * 1.6)));
  const rows = Math.ceil(sample.length / cols);
  const cellW = CANVAS_W / cols;
  const cellH = CANVAS_H / rows;

  const scales = sample.map((_, i) => {
    if (i === 0) return 0.95;
    if (i === 1) return 0.78;
    return 0.42 + Math.random() * 0.22;
  });

  const usedRects: Array<{ x: number; y: number; w: number; h: number }> = [];
  const placements: Array<{ buffer: Buffer; left: number; top: number }> = [];

  for (let i = 0; i < sample.length; i++) {
    const targetW = Math.round(cellW * 1.5 * scales[i]);
    const targetH = Math.round((targetW * DRAWING_CANVAS_HEIGHT) / DRAWING_CANVAS_WIDTH);
    const sketchPng = await sharp(Buffer.from(strokesToSvg(sample[i].strokes)))
      .resize(targetW, targetH, { fit: "fill" })
      .png()
      .toBuffer();

    const col = i % cols;
    const row = Math.floor(i / cols);
    let x = Math.round(col * cellW + (cellW - targetW) / 2);
    let y = Math.round(row * cellH + (cellH - targetH) / 2);
    x = clamp(x + Math.round((Math.random() - 0.5) * cellW * 0.9), 8, CANVAS_W - targetW - 8);
    y = clamp(y + Math.round((Math.random() - 0.5) * cellH * 0.9), 8, CANVAS_H - targetH - 8);

    const inset = (r: { x: number; y: number; w: number; h: number }) => ({
      x: r.x + r.w * 0.35,
      y: r.y + r.h * 0.35,
      w: r.w * 0.3,
      h: r.h * 0.3,
    });
    for (let attempt = 0; attempt < 4; attempt++) {
      const conflict = usedRects.find((r) =>
        rectsOverlap(inset({ x, y, w: targetW, h: targetH }), inset(r)),
      );
      if (!conflict) break;
      x = clamp(x + Math.round((Math.random() - 0.5) * cellW), 8, CANVAS_W - targetW - 8);
      y = clamp(y + Math.round((Math.random() - 0.5) * cellH), 8, CANVAS_H - targetH - 8);
    }
    usedRects.push({ x, y, w: targetW, h: targetH });
    placements.push({ buffer: sketchPng, left: x, top: y });
  }

  return sharp({
    create: { width: CANVAS_W, height: CANVAS_H, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite(placements.map((p) => ({ input: p.buffer, left: p.left, top: p.top })))
    .png()
    .toBuffer();
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}
function strokesToSvg(strokes: DrawingStroke[]) {
  const paths = strokes
    .map((stroke) => {
      const points = Array.isArray(stroke?.points) ? stroke.points : [];
      if (points.length === 0) return "";
      const color =
        typeof stroke.color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(stroke.color)
          ? stroke.color
          : "#f5f5f5";
      const width =
        typeof stroke.width === "number" && Number.isFinite(stroke.width)
          ? Math.min(20, Math.max(1, stroke.width))
          : 5;
      if (points.length === 1) {
        const p = points[0];
        return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(width / 2).toFixed(1)}" fill="${color}" fill-opacity="${REFERENCE_STROKE_OPACITY}"/>`;
      }
      const d = points
        .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
