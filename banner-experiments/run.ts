/* eslint-disable no-console */
// Iteration harness for the homepage banner generator.
// Pulls real sketches from Supabase, builds a reference grid, calls
// gpt-image-2 with a configurable prompt, saves the result to disk.
//
// Usage: npx ts-node banner-experiments/run.ts <variant>
// Variants live in PROMPTS below. Each run also drops the reference grid
// alongside the output so we can eyeball drift from the originals.

import "dotenv/config";

import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import * as path from "path";
import sharp from "sharp";

const DRAWING_CANVAS_WIDTH = 480;
const DRAWING_CANVAS_HEIGHT = 320;

// Keep in sync with app/lib/homepage-banner.ts — faint, overlapping reference so
// the image-conditioned edit weaves the doodles instead of tracing them.
const REFERENCE_STROKE_OPACITY = 0.55;

type DrawingPoint = { x: number; y: number };
type DrawingStroke = { points: DrawingPoint[]; color?: string; width?: number };

type SketchRecord = {
  id: string;
  strokes: DrawingStroke[];
  prompt: string | null;
  created_at: string;
};

type Variant = {
  name: string;
  size: "1024x1024" | "1024x1536" | "1536x1024";
  quality: "low" | "medium" | "high";
  layout: "grid" | "scattered";
  buildPrompt: (subjects: string[]) => string;
};

const SUBJECT_LIST = (subjects: string[]) =>
  subjects.length > 0
    ? `Subjects (one per cell): ${subjects.join("; ")}.`
    : "";

const PROMPTS: Variant[] = [
  {
    name: "t1-vibe",
    layout: "scattered",
    size: "1536x1024",
    quality: "low",
    buildPrompt: (s) =>
      [
        "A wide cinematic banner of a quiet night sky. The reference shows rough sketches by anonymous visitors, used here only as inspiration for the silhouette and pose of each constellation in the sky.",
        SUBJECT_LIST(s),
        "Render each subject as a small refined constellation: tiny pinpoint stars and barely-there glowing hairlines, in soft off-white with rare warm-orange or indigo accent stars. Keep the silhouettes recognizable, but draw with intention — clean, elegant, contemplative. Vary scale freely across the panorama. Sparse background starfield and the faintest wash of nebula. Apple-restrained.",
      ].join(" "),
  },
  {
    name: "t2-elegant",
    layout: "scattered",
    size: "1536x1024",
    quality: "low",
    buildPrompt: (s) =>
      [
        "Wide ambient banner: a refined astronomical illustration of a night sky filled with intimate little constellations.",
        SUBJECT_LIST(s),
        "The reference grid contains the rough sketches that inspired each constellation — match each subject's silhouette so a viewer can still recognize 'oh, that's the cat someone drew', but otherwise abandon the hand-drawn quality entirely. Render in the style of a tasteful celestial chart: tiny bright stars at landmark points, ultra-thin connecting hairlines that suggest the form, varied scales, scattered organically. Pure black void, sparse pinpoint background stars, optional whisper of nebula. Restrained palette of soft white with rare muted orange and indigo accents. Quiet, late-night mood.",
      ].join(" "),
  },
  {
    name: "t3-short",
    layout: "scattered",
    size: "1536x1024",
    quality: "low",
    buildPrompt: (s) =>
      [
        "A wide tasteful cinematic banner of a starfield. Use the reference sketches only as silhouette guides — render each as a refined small constellation of pinpoint stars and faint connecting hairlines. Keep the original silhouette recognizable. Scatter at varied scales across deep black. Soft off-white, occasional muted orange/indigo accent. Contemplative, minimal, late-night.",
        SUBJECT_LIST(s),
      ].join(" "),
  },
  {
    name: "L1-landscape",
    layout: "scattered",
    size: "1536x1024",
    quality: "low",
    buildPrompt: (s) =>
      [
        "A wide cinematic nocturne — a single cohesive moonlit landscape painting. The reference shows rough sketches by anonymous visitors. Compose ONE unified scene that incorporates each subject as a natural element of the landscape (e.g. a cat sitting on a windowsill, an umbrella resting against a fence, a house in the distance, a balloon drifting over the horizon, an eye-shaped moon in the sky, a slice of pizza on a picnic blanket — but the placements should emerge naturally from what feels right).",
        SUBJECT_LIST(s),
        "The original silhouette of each subject must remain recognizable — a viewer should be able to point and say 'oh, that cat looks like the one someone drew'. Render in a refined illustrative style: soft watercolor wash, restrained palette of indigo, deep teal, warm orange highlights. Atmospheric, dreamlike, late-night, intimate. Apple-restrained, never whimsical or children's-book.",
      ].join(" "),
  },
  {
    name: "L2-dreamscape",
    layout: "scattered",
    size: "1536x1024",
    quality: "low",
    buildPrompt: (s) =>
      [
        "A wide surreal dreamscape that weaves together every sketched subject into ONE atmospheric composition.",
        SUBJECT_LIST(s),
        "Each subject should appear as an element in the scene with its silhouette recognizably matching the reference sketch — a viewer should still be able to see 'someone drew this cat', 'someone drew this umbrella'. But arrange them into a single cohesive vignette: things floating in dreamlike space, occupying one continuous environment. Refined, mysterious, restrained color (deep indigo, soft cream, warm orange embers). Painterly but minimal, late-night, contemplative.",
      ].join(" "),
  },
  {
    name: "L3-silhouette-horizon",
    layout: "scattered",
    size: "1536x1024",
    quality: "low",
    buildPrompt: (s) =>
      [
        "A wide cinematic silhouette landscape at twilight. A low horizon runs across the lower third of the frame. Above it, an indigo-to-amber gradient sky with scattered stars and a soft moon.",
        SUBJECT_LIST(s),
        "Each subject from the reference appears as a small dark silhouette nestled into the landscape — a tiny house on the horizon, a cat on a fencepost, an umbrella propped against a stone, a balloon drifting up, etc. Make it feel like one scene, not a collage. Keep each silhouette clearly traceable to the contributor's original sketch (preserve their idiosyncratic shape). Restrained palette, painterly but precise. Quiet and intimate.",
      ].join(" "),
  },
  {
    name: "L4-collage",
    layout: "scattered",
    size: "1536x1024",
    quality: "low",
    buildPrompt: (s) =>
      [
        "A wide cinematic ink-and-wash composition that fuses every sketch from the reference into one tasteful nocturne illustration.",
        SUBJECT_LIST(s),
        "Treat the sketches as a story being told together: arrange them organically into a single layered scene. The cat watches from a windowsill. The umbrella shelters something. The house anchors the distance. The balloon escapes. The eye watches over everything as a celestial body or motif. Render in soft monochrome ink wash with whisper-thin gold and indigo accents. Each subject's silhouette must remain recognizable as the original contributor's drawing.",
      ].join(" "),
  },
  {
    name: "L5-loose",
    layout: "scattered",
    size: "1536x1024",
    quality: "low",
    buildPrompt: (s) =>
      [
        "Take every rough sketch in the reference and weave them into one cohesive cinematic banner — a tasteful nighttime composition where each subject finds a natural place. Surprise me with the framing, but keep each subject's silhouette clearly tied to the contributor's drawing. Restrained palette, refined craft, contemplative mood.",
        SUBJECT_LIST(s),
      ].join(" "),
  },
  // C-series: constellation-only, but composed as a cohesive scene (skyline,
  // landscape implied entirely in star-points and hairlines on pure black).
  // Designed for screen-blend integration into the procedural starfield.
  {
    name: "C1-skyline",
    layout: "scattered",
    size: "1536x1024",
    quality: "low",
    buildPrompt: (s) =>
      [
        "A wide cinematic constellation tableau on a pure #000000 sky. Compose ONE cohesive nighttime scene rendered entirely in tiny pinpoint stars and ultra-thin connecting hairlines. The subjects from the reference each become a constellation in the scene, but their POSITIONS imply a landscape: grounded subjects (house, cat, fencepost-type things) sit on a low horizon-line of star-points across the bottom third; floating or celestial subjects (balloon, eye) drift higher in the sky.",
        SUBJECT_LIST(s),
        "Each constellation's silhouette must be recognizable as the contributor's original sketch — same pose, same character — but render with refined intentional craft, not literal trace of every wobble. Soft off-white star-points with rare warm-orange or indigo accent stars. A barely-visible horizon hairline runs across the lower portion. Sparse pinpoint background stars; no nebula, no fills, no color blocks. Pure black background everywhere else. Quiet, ambient, tasteful.",
      ].join(" "),
  },
  {
    name: "C2-medium",
    layout: "scattered",
    size: "1536x1024",
    quality: "medium",
    buildPrompt: (s) =>
      [
        "A single wide cinematic constellation scene, rendered ENTIRELY as star-points (1–3px) and ultra-thin connecting hairlines on pure #000000. No fills, no painterly elements, no color washes — only stars and faint lines.",
        SUBJECT_LIST(s),
        "Compose the subjects into one coherent vignette — for example, a house and cat on the ground level (lower portion of frame), an umbrella nearby, a balloon drifting overhead, a celestial eye watching from above — but feel free to choose what makes the scene feel right. Each subject's silhouette must be tied to the contributor's original sketch (recognizable pose). Vary the constellation scales (one or two larger anchors, the rest smaller and quiet). Soft off-white predominates, with occasional warm-orange or indigo accent stars. Tasteful, contemplative, late-night.",
      ].join(" "),
  },
  {
    name: "C2-scene",
    layout: "scattered",
    size: "1536x1024",
    quality: "low",
    buildPrompt: (s) =>
      [
        "A single wide cinematic constellation scene, rendered ENTIRELY as star-points (1–3px) and ultra-thin connecting hairlines on pure #000000. No fills, no painterly elements, no color washes — only stars and faint lines.",
        SUBJECT_LIST(s),
        "Compose the subjects into one coherent vignette — for example, a house and cat on the ground level (lower portion of frame), an umbrella nearby, a balloon drifting overhead, a celestial eye watching from above — but feel free to choose what makes the scene feel right. Each subject's silhouette must be tied to the contributor's original sketch (recognizable pose). Vary the constellation scales (one or two larger anchors, the rest smaller and quiet). Soft off-white predominates, with occasional warm-orange or indigo accent stars. Tasteful, contemplative, late-night.",
      ].join(" "),
  },
  {
    name: "C3-pure",
    layout: "scattered",
    size: "1536x1024",
    quality: "low",
    buildPrompt: (s) =>
      [
        "A wide tasteful constellation map on absolute pure #000000 black. Output is ONLY tiny luminous star-points and barely-visible glowing hairlines. No paint, no wash, no color fills, no nebula, no atmosphere — strict star-chart minimalism.",
        SUBJECT_LIST(s),
        "Compose the subjects into one cohesive vignette: imagine the panorama as a single nighttime scene in which each constellation finds its natural place (a balloon floats high, a house sits low, a cat rests on something, an umbrella shelters a small thing). Each constellation's silhouette must come clearly from the reference sketch. Vary scales. Soft off-white stars with rare muted-orange or indigo accents. Background pure black with sparse incidental pinpoints.",
      ].join(" "),
  },
  {
    name: "C4-loose",
    layout: "scattered",
    size: "1536x1024",
    quality: "low",
    buildPrompt: (s) =>
      [
        "Compose all the sketched subjects into a single cohesive constellation scene — a quiet nocturne rendered entirely in pinpoint stars and faint hairlines on pure #000000. Cohesive, tasteful, restrained. Vary scales. Each constellation's silhouette obviously inspired by its contributor's sketch.",
        SUBJECT_LIST(s),
      ].join(" "),
  },
  // P-series: painterly nocturne for the dedicated collage page. Goal: a
  // cinematic painted scene that retains each contributor's idiosyncratic
  // silhouette/pose so the viewer can recognize "that's the cat someone drew",
  // not a generic stock cat.
  {
    name: "P1-medium",
    layout: "scattered",
    size: "1536x1024",
    quality: "medium",
    buildPrompt: (s) =>
      [
        "A wide cinematic moonlit nocturne — one cohesive painted scene that incorporates every sketched subject from the reference as a natural element of the landscape.",
        SUBJECT_LIST(s),
        "CRITICAL: each subject's silhouette must match the contributor's reference sketch as closely as possible — the SAME pose, SAME proportions, SAME quirky details. Do not normalize the cat into a stock cat; if the contributor drew it sitting upright with one paw raised and uneven whiskers, draw THAT cat. If the umbrella has a wobbly handle in the sketch, keep the wobbly handle. The scene should feel like the contributors' drawings have stepped into a painted world, retaining their personality.",
        "Style: refined ink-and-watercolor wash. Deep indigo and midnight teal sky, soft amber moonlight, restrained palette. Atmospheric, late-night, intimate, slightly mysterious. Not cute, not children's-book — Apple-restrained painting craft.",
      ].join(" "),
  },
  {
    name: "P1-faithful-pose",
    layout: "scattered",
    size: "1536x1024",
    quality: "low",
    buildPrompt: (s) =>
      [
        "A wide cinematic moonlit nocturne — one cohesive painted scene that incorporates every sketched subject from the reference as a natural element of the landscape.",
        SUBJECT_LIST(s),
        "CRITICAL: each subject's silhouette must match the contributor's reference sketch as closely as possible — the SAME pose, SAME proportions, SAME quirky details. Do not normalize the cat into a stock cat; if the contributor drew it sitting upright with one paw raised and uneven whiskers, draw THAT cat. If the umbrella has a wobbly handle in the sketch, keep the wobbly handle. The scene should feel like the contributors' drawings have stepped into a painted world, retaining their personality.",
        "Style: refined ink-and-watercolor wash. Deep indigo and midnight teal sky, soft amber moonlight, restrained palette. Atmospheric, late-night, intimate, slightly mysterious. Not cute, not children's-book — Apple-restrained painting craft.",
      ].join(" "),
  },
  {
    name: "P2-traced-painted",
    layout: "scattered",
    size: "1536x1024",
    quality: "low",
    buildPrompt: (s) =>
      [
        "A wide painted nocturne. The reference shows finger-sketches by anonymous visitors, scattered across a black canvas. Build ONE cohesive painted scene where each subject appears in its sketched location.",
        SUBJECT_LIST(s),
        "STRICT RULE: trace each subject's outer silhouette directly from the reference sketch, then paint INSIDE that silhouette with refined craft. Do not redraw or normalize the subject — its shape, proportions, and pose must match the contributor's drawing. The umbrella keeps its slightly off-kilter dome. The cat keeps its specific posture. The house keeps its windows.",
        "Render the scene in soft ink-and-watercolor wash with restrained color: indigo night sky, amber lamplight, deep teal shadow, cream highlights. Build a quiet cohesive vignette around the subjects. Atmospheric and tasteful, late-night.",
      ].join(" "),
  },
  {
    name: "P3-folk",
    layout: "scattered",
    size: "1536x1024",
    quality: "low",
    buildPrompt: (s) =>
      [
        "A wide cinematic painted folk-art nocturne — one cohesive scene weaving all sketched subjects into a tasteful nighttime composition.",
        SUBJECT_LIST(s),
        "Embrace a slightly naive, hand-painted quality that honors the children's-drawing source: keep each subject's silhouette idiosyncratic — same pose, same quirks, same proportions as the contributor's sketch. The painted style should feel intimate and storybook-illustration-meets-James-Jean: refined linework, soft ink wash, restrained palette of indigo, deep teal, soft amber, cream. Not cartoonish, not cute — quiet and contemplative.",
      ].join(" "),
  },
  {
    name: "P4-overlay",
    layout: "scattered",
    size: "1536x1024",
    quality: "low",
    buildPrompt: (s) =>
      [
        "A wide cinematic painted nocturne. Build a quiet atmospheric scene that incorporates every sketched subject from the reference as an element of the composition.",
        SUBJECT_LIST(s),
        "Render each subject AS a hand-drawn ink line drawing (the silhouette comes directly from the contributor's reference sketch — pose, proportions, character preserved exactly), then paint a soft watercolor scene around and behind them. The contributor's lines remain as visible inked outlines on top of the painted environment, so a viewer sees the actual sketch silhouette set against an atmospheric painted world. Restrained palette: indigo, teal, amber, cream. Late-night, intimate.",
      ].join(" "),
  },
  {
    name: "P5-loose-spirit",
    layout: "scattered",
    size: "1536x1024",
    quality: "low",
    buildPrompt: (s) =>
      [
        "A wide cinematic painted nocturne — a single cohesive moonlit scene woven from rough finger-sketches by anonymous visitors of a personal website.",
        SUBJECT_LIST(s),
        "Treat the reference sketches as portraits — render each subject in the painted scene with its silhouette and personality preserved (the specific cat someone drew, the specific umbrella, etc.). Honor the imperfection of the originals; don't smooth them into stock illustrations. Style: ink and watercolor, restrained indigo/teal/amber palette, atmospheric depth. Mood: contemplative, late-night, slightly mischievous, intimate.",
      ].join(" "),
  },
];

async function main() {
  const variantName = process.argv[2];
  if (!variantName) {
    console.error("usage: ts-node run.ts <variant>");
    console.error(`available: ${PROMPTS.map((p) => p.name).join(", ")}`);
    process.exit(1);
  }

  const variant = PROMPTS.find((p) => p.name === variantName);
  if (!variant) {
    console.error(`unknown variant: ${variantName}`);
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!supabaseUrl || !supabaseKey || !openaiKey) {
    throw new Error("missing env: NEXT_PUBLIC_SUPABASE_URL/ANON_KEY or OPENAI_API_KEY");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from("turtle_drawings")
    .select("id, strokes, prompt, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const sketches = (data ?? []) as SketchRecord[];
  console.log(`loaded ${sketches.length} sketches`);

  const subjects = Array.from(
    new Set(
      sketches
        .map((s) => s.prompt?.trim())
        .filter((p): p is string => Boolean(p && p.length > 0)),
    ),
  );

  const referencePng =
    variant.layout === "scattered"
      ? await composeReferenceScattered(sketches, variant.size)
      : await composeReferenceGrid(sketches);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.resolve(process.cwd(), "banner-experiments", variant.name);
  await fs.mkdir(outDir, { recursive: true });
  const refPath = path.join(outDir, `${ts}_reference.png`);
  await fs.writeFile(refPath, referencePng);
  console.log(`saved reference grid: ${refPath}`);

  const promptText = variant.buildPrompt(subjects);
  await fs.writeFile(path.join(outDir, `${ts}_prompt.txt`), promptText);

  const client = new OpenAI({ apiKey: openaiKey });
  const referenceFile = await toFile(referencePng, "sketches.png", {
    type: "image/png",
  });

  console.log(`calling gpt-image-2 (${variant.size}, ${variant.quality})...`);
  const start = Date.now();
  const response = await client.images.edit(
    {
      model: "gpt-image-2",
      image: referenceFile,
      prompt: promptText,
      size: variant.size,
      quality: variant.quality,
    },
    { timeout: 240_000 },
  );
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`generated in ${elapsed}s`);

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error("no image returned");
  const outPath = path.join(outDir, `${ts}.png`);
  await fs.writeFile(outPath, Buffer.from(b64, "base64"));
  console.log(`saved banner: ${outPath}`);
}

async function composeReferenceScattered(
  sketches: SketchRecord[],
  size: "1024x1024" | "1024x1536" | "1536x1024",
): Promise<Buffer> {
  const [canvasWidth, canvasHeight] = size.split("x").map(Number) as [
    number,
    number,
  ];

  // Deterministic-ish but visually scattered — varied scales (so the model
  // sees that the panorama mixes anchor pieces with incidental marks).
  const sample = sketches.slice(0, 36);
  const placements: Array<{
    buffer: Buffer;
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [];

  // Cell-based jitter: lay sketches into a sparse irregular grid then perturb.
  const cols = Math.max(3, Math.ceil(Math.sqrt(sample.length * 1.6)));
  const rows = Math.ceil(sample.length / cols);
  const cellW = canvasWidth / cols;
  const cellH = canvasHeight / rows;

  // Random size weights — a couple of anchors, a long tail of small ones.
  const scales = sample.map((_, i) => {
    if (i === 0) return 0.95; // one anchor
    if (i === 1) return 0.78; // one mid
    // rest: small, with mild variation
    return 0.42 + Math.random() * 0.22;
  });

  const usedRects: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
  }> = [];

  for (let i = 0; i < sample.length; i++) {
    const sketch = sample[i];
    const scale = scales[i];
    const targetW = Math.round(cellW * 1.5 * scale);
    const targetH = Math.round(
      (targetW * DRAWING_CANVAS_HEIGHT) / DRAWING_CANVAS_WIDTH,
    );

    const sketchPng = await sharp(Buffer.from(strokesToSvg(sketch.strokes)))
      .resize(targetW, targetH, { fit: "fill" })
      .png()
      .toBuffer();

    // Jittered position, biased toward the cell center but with overlap
    // checks so sketches don't visibly stack.
    const col = i % cols;
    const row = Math.floor(i / cols);
    let x = Math.round(col * cellW + (cellW - targetW) / 2);
    let y = Math.round(row * cellH + (cellH - targetH) / 2);
    const jitterX = Math.round((Math.random() - 0.5) * cellW * 0.9);
    const jitterY = Math.round((Math.random() - 0.5) * cellH * 0.9);
    x = clamp(x + jitterX, 8, canvasWidth - targetW - 8);
    y = clamp(y + jitterY, 8, canvasHeight - targetH - 8);

    // Allow generous overlap (test only the inner ~30% cores) so the doodles
    // intermingle into one field rather than reading as separated objects.
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
    placements.push({ buffer: sketchPng, x, y, width: targetW, height: targetH });
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
      placements.map((p) => ({
        input: p.buffer,
        left: p.x,
        top: p.y,
      })),
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
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

async function composeReferenceGrid(
  sketches: SketchRecord[],
): Promise<Buffer> {
  const sample = sketches.slice(0, 36);
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
