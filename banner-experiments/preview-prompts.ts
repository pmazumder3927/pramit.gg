/* eslint-disable no-console */
// Free dry-run of the nightly-collage "night curator" pipeline. Pulls the REAL
// current sketch pool from Supabase, then simulates N consecutive nights and
// prints the lens (medium x composition x mood x abstraction) + the full prompt
// for each. Because the inputs are held fixed across the simulated nights, this
// isolates the rotation + anti-repeat machinery — you should see the medium and
// composition change every night and NO medium-family repeat within 3 nights.
//
// Usage:
//   npx tsx banner-experiments/preview-prompts.ts            # $0, deterministic prose
//   npx tsx banner-experiments/preview-prompts.ts --director # uses gpt-4o-mini (tiny cost)
//   npx tsx banner-experiments/preview-prompts.ts 12         # simulate 12 nights
//
// No images are generated. To see a real painting, hit "regenerate" on the
// dashboard (which now runs this exact pipeline) or POST /api/banner.

import "dotenv/config";

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

import {
  analyzeNight,
  assemblePrompt,
  directNight,
  parseRecentFamilies,
  pickLens,
  renderDeterministicProse,
  type DirectorOut,
} from "../app/lib/banner-art-director";

type SketchRecord = {
  id: string;
  strokes: { points: { x: number; y: number }[]; color?: string }[];
  prompt: string | null;
  created_at: string;
};

async function main() {
  const args = process.argv.slice(2);
  const useDirector = args.includes("--director");
  const nights = Number(args.find((a) => /^\d+$/.test(a))) || 8;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("missing env: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from("turtle_drawings")
    .select("id, strokes, prompt, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const sketches = (data ?? []) as SketchRecord[];

  const analysis = analyzeNight(sketches as never);
  console.log(`\nLoaded ${sketches.length} sketches.`);
  console.log(
    `Night signal: ${analysis.count} subjects · density=${analysis.density} · ` +
      `catRatio=${analysis.catRatio.toFixed(2)} · theme=${analysis.centerOfGravity ?? "—"} · ` +
      `inkBias=${analysis.inkBias ?? "—"}`,
  );
  console.log(`Director: ${useDirector ? "gpt-4o-mini (live)" : "off (deterministic prose)"}`);

  const client =
    useDirector && process.env.OPENAI_API_KEY
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      : null;
  if (useDirector && !client) {
    console.log("(--director requested but OPENAI_API_KEY unset → deterministic prose)");
  }

  let recentPrompts: (string | null)[] = [];
  for (let day = 0; day < nights; day++) {
    // Hold inputs fixed, advance only the date, to isolate rotation/anti-repeat.
    const date = new Date(Date.UTC(2026, 5, day + 1));
    const families = parseRecentFamilies(recentPrompts);
    const lens = pickLens(analysis, date, 0, families);

    let out: DirectorOut | null = null;
    if (client) out = await directNight(analysis, lens, client, families);
    if (!out) out = renderDeterministicProse(analysis, lens);

    const tagged = assemblePrompt(out, lens);
    console.log(
      `\n=== night ${day + 1} :: ${lens.medium.id} × ${lens.composition.id} ` +
        `(family: ${lens.medium.family}${families.length ? `, avoiding: ${families.join(", ")}` : ""}) ===`,
    );
    console.log(tagged);
    recentPrompts = [tagged, ...recentPrompts].slice(0, 3);
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
