#!/usr/bin/env node
/**
 * Listen to the library and write down what it actually sounds like.
 *
 * Spotify's /audio-features and /audio-analysis answer 403 for apps registered
 * after late 2024, and every preview_url on this account is null, so there is
 * no way left to ask Spotify how a song sounds. Deezer's open API still serves
 * a 30-second preview for effectively everything, and ffmpeg plus a few hundred
 * lines of DSP turns that into a real measurement.
 *
 * Runs offline (it needs ffmpeg), writes vectors to Supabase, and the app only
 * ever reads the result:  npm run music:audio [-- --limit 200] [--all]
 */
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const file of [".env.local", ".env"]) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, "utf8").split("\n")) {
    if (!line.includes("=") || line.trim().startsWith("#")) continue;
    const at = line.indexOf("=");
    const key = line.slice(0, at).trim();
    if (!process.env[key]) process.env[key] = line.slice(at + 1).trim();
  }
}

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const SR = 22050;
const FRAME = 1024;
const HOP = 512;
const MELS = 26;
const MFCC = 13;
const CONCURRENCY = 5;

const args = process.argv.slice(2);
const limitArg = args.indexOf("--limit");
const LIMIT = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity;
const REDO = args.includes("--all");

// ---------------------------------------------------------------------------
// DSP
// ---------------------------------------------------------------------------

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const half = i + k + len / 2;
        const vr = re[half] * cr - im[half] * ci;
        const vi = re[half] * ci + im[half] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[half] = ur - vr;
        im[half] = ui - vi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

const WINDOW = new Float64Array(FRAME);
for (let i = 0; i < FRAME; i++) {
  WINDOW[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME - 1));
}

const BINS = FRAME / 2 + 1;
const toMel = (hz) => 2595 * Math.log10(1 + hz / 700);
const toHz = (mel) => 700 * (10 ** (mel / 2595) - 1);
const MEL_BANK = (() => {
  const edges = [];
  const lo = toMel(30);
  const hi = toMel(SR / 2);
  for (let i = 0; i < MELS + 2; i++) edges.push(toHz(lo + ((hi - lo) * i) / (MELS + 1)));
  return Array.from({ length: MELS }, (_, m) => {
    const filter = new Float64Array(BINS);
    const [a, b, c] = [edges[m], edges[m + 1], edges[m + 2]];
    for (let k = 0; k < BINS; k++) {
      const hz = (k * SR) / FRAME;
      if (hz >= a && hz <= b) filter[k] = (hz - a) / (b - a || 1);
      else if (hz > b && hz <= c) filter[k] = (c - hz) / (c - b || 1);
    }
    return filter;
  });
})();

function stats(values) {
  if (values.length === 0) return [0, 0];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return [mean, Math.sqrt(variance)];
}

/** Fold the octave errors an autocorrelation tempo estimate always makes. */
function foldTempo(bpm) {
  let value = bpm;
  while (value > 0 && value < 70) value *= 2;
  while (value > 180) value /= 2;
  return value;
}

function analyse(pcm) {
  const frames = Math.floor((pcm.length - FRAME) / HOP);
  if (frames < 8) return null;

  const rms = [];
  const centroid = [];
  const rolloff = [];
  const flatness = [];
  const zcr = [];
  const flux = [];
  const mfcc = Array.from({ length: MFCC }, () => []);
  let previous = null;

  for (let f = 0; f < frames; f++) {
    const offset = f * HOP;
    const re = new Float64Array(FRAME);
    const im = new Float64Array(FRAME);
    let energy = 0;
    let crossings = 0;

    for (let i = 0; i < FRAME; i++) {
      const x = pcm[offset + i];
      energy += x * x;
      if (i > 0 && (x >= 0) !== (pcm[offset + i - 1] >= 0)) crossings++;
      re[i] = x * WINDOW[i];
    }
    rms.push(Math.sqrt(energy / FRAME));
    zcr.push(crossings / FRAME);

    fft(re, im);

    const magnitude = new Float64Array(BINS);
    let total = 0;
    let weighted = 0;
    let logSum = 0;
    for (let k = 0; k < BINS; k++) {
      magnitude[k] = Math.hypot(re[k], im[k]);
      total += magnitude[k];
      weighted += magnitude[k] * ((k * SR) / FRAME);
      logSum += Math.log(magnitude[k] + 1e-10);
    }
    centroid.push(total > 0 ? weighted / total : 0);
    flatness.push(total > 0 ? Math.exp(logSum / BINS) / (total / BINS) : 0);

    let running = 0;
    let cut = 0;
    for (let k = 0; k < BINS; k++) {
      running += magnitude[k];
      if (running >= total * 0.85) {
        cut = (k * SR) / FRAME;
        break;
      }
    }
    rolloff.push(cut);

    if (previous) {
      let delta = 0;
      for (let k = 0; k < BINS; k++) delta += Math.max(0, magnitude[k] - previous[k]);
      flux.push(delta);
    }
    previous = magnitude;

    for (let c = 0; c < MFCC; c++) {
      let value = 0;
      for (let m = 0; m < MELS; m++) {
        let band = 0;
        for (let k = 0; k < BINS; k++) band += MEL_BANK[m][k] * magnitude[k] * magnitude[k];
        value += Math.log(band + 1e-10) * Math.cos((Math.PI * c * (m + 0.5)) / MELS);
      }
      mfcc[c].push(value);
    }
  }

  // Tempo: autocorrelate the onset envelope.
  const mean = flux.reduce((a, b) => a + b, 0) / (flux.length || 1);
  const centred = flux.map((x) => x - mean);
  const fps = SR / HOP;
  let bestBpm = 0;
  let bestScore = -Infinity;
  for (let bpm = 60; bpm <= 190; bpm++) {
    const lag = Math.round((60 / bpm) * fps);
    if (lag < 2 || lag >= centred.length) continue;
    let acc = 0;
    for (let i = 0; i + lag < centred.length; i++) acc += centred[i] * centred[i + lag];
    const score = acc / (centred.length - lag);
    if (score > bestScore) {
      bestScore = score;
      bestBpm = bpm;
    }
  }

  const [loudness, dynamics] = stats(rms);
  const [brightness, brightnessVar] = stats(centroid);
  const mfccMeans = mfcc.map((c) => stats(c)[0]);
  const mfccStds = mfcc.map((c) => stats(c)[1]);

  return {
    bpm: foldTempo(bestBpm),
    loudness,
    dynamics,
    brightness,
    flatness: stats(flatness)[0],
    zcr: stats(zcr)[0],
    // 34 numbers: the shape of the sound. Standardised at read time so no one
    // dimension's units dominate the distance.
    vector: [
      loudness,
      dynamics,
      brightness / 1000,
      brightnessVar / 1000,
      stats(rolloff)[0] / 1000,
      stats(flatness)[0],
      stats(zcr)[0],
      foldTempo(bestBpm) / 100,
      ...mfccMeans.map((v) => v / 10),
      ...mfccStds.map((v) => v / 10),
    ],
  };
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

function decode(mp3) {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG, [
      "-hide_banner", "-loglevel", "error",
      "-i", "pipe:0",
      "-ac", "1", "-ar", String(SR), "-f", "s16le", "pipe:1",
    ]);
    const chunks = [];
    ff.stdout.on("data", (chunk) => chunks.push(chunk));
    ff.on("error", reject);
    ff.on("close", () => {
      const buffer = Buffer.concat(chunks);
      const pcm = new Float64Array(buffer.length / 2);
      for (let i = 0; i < pcm.length; i++) pcm[i] = buffer.readInt16LE(i * 2) / 32768;
      resolve(pcm);
    });
    ff.stdin.on("error", () => {});
    ff.stdin.end(mp3);
  });
}

const clean = (s) => (s || "").replace(/\([^)]*\)|\[[^\]]*\]|feat\..*$|-\s.*$/gi, " ").trim();

async function findPreview(track) {
  const attempts = [
    `${clean(track.title)} ${track.artist_names?.[0] || ""}`,
    `${track.title} ${track.artist_names?.[0] || ""}`,
    clean(track.title),
  ];

  for (const attempt of attempts) {
    const query = encodeURIComponent(attempt.slice(0, 100).trim());
    if (!query) continue;
    try {
      const response = await fetch(`https://api.deezer.com/search?q=${query}&limit=5`);
      if (!response.ok) continue;
      const payload = await response.json();
      const wanted = Math.round((track.duration_ms || 0) / 1000);
      const candidates = (payload.data || []).filter((hit) => hit.preview);
      if (candidates.length === 0) continue;
      // Prefer a hit whose length matches — same title, very different duration
      // is usually a remix or a live cut.
      const matched =
        candidates.find((hit) => wanted > 0 && Math.abs(hit.duration - wanted) <= 5) ||
        candidates[0];
      return matched.preview;
    } catch {
      /* try the next phrasing */
    }
  }
  return null;
}

async function mapLimit(items, limit, work) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const index = cursor++;
        if (index >= items.length) return;
        results[index] = await work(items[index], index);
      }
    })
  );
  return results;
}

// ---------------------------------------------------------------------------

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: known } = await supabase.from("music_track_sound").select("track_id");
const done = new Set(REDO ? [] : (known || []).map((row) => row.track_id));

const { data: tracks } = await supabase
  .from("music_tracks")
  .select("track_id, title, artist_names, artist_display, duration_ms")
  .eq("shelf", "active")
  .eq("unavailable", false);

const pending = (tracks || []).filter((t) => !done.has(t.track_id)).slice(0, LIMIT);
console.log(`listening to ${pending.length} of ${tracks?.length ?? 0} tracks…`);

let heard = 0;
let missed = 0;
const rows = [];

await mapLimit(pending, CONCURRENCY, async (track, index) => {
  try {
    const preview = await findPreview(track);
    if (!preview) throw new Error("no preview");
    const response = await fetch(preview);
    if (!response.ok) throw new Error(`preview ${response.status}`);
    const features = analyse(await decode(Buffer.from(await response.arrayBuffer())));
    if (!features) throw new Error("too short");

    rows.push({
      track_id: track.track_id,
      embedding: JSON.stringify(features.vector.map((v) => Number(v.toFixed(5)))),
      bpm: features.bpm,
      loudness: features.loudness,
      dynamics: features.dynamics,
      brightness: features.brightness,
      flatness: features.flatness,
      zcr: features.zcr,
      source: "deezer-preview",
      analysed_at: new Date().toISOString(),
    });
    heard++;
  } catch {
    missed++;
  }

  if ((index + 1) % 25 === 0) {
    process.stdout.write(`  ${index + 1}/${pending.length}  heard ${heard}, missed ${missed}\n`);
  }
});

for (let i = 0; i < rows.length; i += 100) {
  const { error } = await supabase
    .from("music_track_sound")
    .upsert(rows.slice(i, i + 100), { onConflict: "track_id" });
  if (error) {
    console.error("write failed:", error.message);
    process.exit(1);
  }
}

console.log(`\nheard ${heard}, missed ${missed}. ${rows.length} vectors written.`);
