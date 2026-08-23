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
 * ever reads the result:
 *   npm run music:audio [-- --limit 200] [--all] [--refetch]
 *
 * Previews are kept under .cache/previews so adding a feature means re-reading
 * local mp3s rather than crawling a free API a thousand times again. --refetch
 * ignores that cache.
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
const REFETCH = args.includes("--refetch");
const CACHE = path.join(ROOT, ".cache", "previews");

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

  // How much of the onset envelope's energy actually recurs at the winning
  // period. A club track and a loud drone can sit at the same loudness; this is
  // the only number here that tells them apart.
  const zeroLag = centred.reduce((sum, x) => sum + x * x, 0) / (centred.length || 1);
  const pulse = zeroLag > 0 ? Math.min(1, Math.max(0, bestScore / zeroLag)) : 0;

  // Crest wants the true overall RMS, so take the root mean square of the frame
  // levels rather than reusing loudness, which is their arithmetic mean.
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) {
    const a = Math.abs(pcm[i]);
    if (a > peak) peak = a;
  }
  const overallRms = Math.sqrt(rms.reduce((sum, v) => sum + v * v, 0) / (rms.length || 1));
  const crest = peak > 0 && overallRms > 0 ? 20 * Math.log10(peak / overallRms) : 0;

  const [loudness, dynamics] = stats(rms);
  const [brightness, brightnessVar] = stats(centroid);
  const mfccMeans = mfcc.map((c) => stats(c)[0]);
  const mfccStds = mfcc.map((c) => stats(c)[1]);

  return {
    bpm: foldTempo(bestBpm),
    pulse,
    crest,
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

/**
 * Reduce a name to the letters and digits that survive translation between two
 * catalogues, so "Björk" and "Bjork", "Tiësto" and "Tiesto" compare equal.
 */
function fold(text) {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]+/g, " ")
    .trim();
}

/** Does this Deezer hit appear to be by the same people? */
function sameArtist(track, hit) {
  const theirs = fold(hit.artist?.name);
  if (!theirs) return false;
  for (const name of track.artist_names || []) {
    const ours = fold(name);
    if (!ours) continue;
    if (ours === theirs || ours.includes(theirs) || theirs.includes(ours)) return true;
    // Collaborations get credited differently on each service, so a shared
    // distinctive word is enough.
    const words = ours.split(" ").filter((w) => w.length >= 4);
    if (words.some((w) => theirs.includes(w))) return true;
  }
  return false;
}

async function findPreview(track) {
  const attempts = [
    `${clean(track.title)} ${track.artist_names?.[0] || ""}`,
    `${track.title} ${track.artist_names?.[0] || ""}`,
    clean(track.title),
  ];

  const wanted = Math.round((track.duration_ms || 0) / 1000);
  const seen = [];

  for (const attempt of attempts) {
    const query = encodeURIComponent(attempt.slice(0, 100).trim());
    if (!query) continue;
    try {
      const response = await fetch(`https://api.deezer.com/search?q=${query}&limit=8`);
      if (!response.ok) continue;
      const payload = await response.json();
      for (const hit of payload.data || []) if (hit.preview) seen.push(hit);
    } catch {
      /* try the next phrasing */
    }
    // A hit by the right artist at roughly the right length is as good as it gets.
    const exact = seen.find(
      (hit) => sameArtist(track, hit) && wanted > 0 && Math.abs(hit.duration - wanted) <= 5
    );
    if (exact) return describe(exact, track);
  }

  if (seen.length === 0) return null;

  // Nothing matched outright, so rank what we have. The artist agreeing matters
  // far more than the length: the wrong-length matches that were checked by hand
  // split cleanly into a different *recording* of the same piece, which is fine
  // to measure, and a different song that happens to share a title, which is
  // not — and the artist is what tells those apart. A long orchestral movement
  // matched to another orchestra's reading of it is still that music. "Falling
  // to Pieces" by Júndu matched to Faith No More is not.
  const scored = seen.map((hit) => {
    const artist = sameArtist(track, hit) ? 1 : 0;
    const drift = wanted > 0 && hit.duration ? Math.abs(hit.duration - wanted) / wanted : 1;
    return { hit, artist, score: artist * 2 - Math.min(1, drift) };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  // A different artist AND a length nowhere near ours is a different song. No
  // measurement is better than a confident wrong one — the sequencer treats a
  // missing vector as "sits at the average distance from everything", which is
  // the honest answer, while a wrong one quietly misfiles the song forever.
  if (!best.artist && wanted > 0 && best.hit.duration) {
    const drift = Math.abs(best.hit.duration - wanted) / wanted;
    if (drift > 0.25) return null;
  }
  return describe(best.hit, track);
}

function describe(hit, track) {
  return {
    url: hit.preview,
    hit: {
      id: hit.id,
      title: hit.title,
      artist: hit.artist?.name || null,
      duration: hit.duration ?? null,
      sameArtist: sameArtist(track, hit),
    },
  };
}

let cacheHits = 0;

/** The mp3 for a track, from disk if we have already fetched it once. */
async function loadPreview(track) {
  const key = String(track.track_id).replace(/[^\w-]/g, "_");
  const mp3Path = path.join(CACHE, `${key}.mp3`);
  const matchPath = path.join(CACHE, `${key}.json`);

  if (!REFETCH && fs.existsSync(mp3Path)) {
    cacheHits++;
    let match = null;
    try {
      match = JSON.parse(fs.readFileSync(matchPath, "utf8"));
    } catch {
      /* the audio is what we came for; provenance can be missing on old caches */
    }
    return { mp3: fs.readFileSync(mp3Path), match };
  }

  const found = await findPreview(track);
  if (!found) throw new Error("no preview");
  const response = await fetch(found.url);
  if (!response.ok) throw new Error(`preview ${response.status}`);
  const mp3 = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(mp3Path, mp3);
  fs.writeFileSync(matchPath, JSON.stringify(found.hit));
  return { mp3, match: found.hit };
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

// A row from before pulse and crest existed is not finished work, so it counts
// as pending even without --all. Otherwise the backfill would never happen.
const { data: known } = await supabase.from("music_track_sound").select("track_id, pulse");
const stale = new Set((known || []).filter((row) => row.pulse === null).map((row) => row.track_id));
const done = new Set(REDO ? [] : (known || []).filter((row) => row.pulse !== null).map((row) => row.track_id));

const { data: tracks } = await supabase
  .from("music_tracks")
  .select("track_id, title, artist_names, artist_display, duration_ms")
  .eq("shelf", "active")
  .eq("unavailable", false);

const pending = (tracks || []).filter((t) => !done.has(t.track_id)).slice(0, LIMIT);
const reheard = pending.filter((t) => stale.has(t.track_id)).length;
const note = REDO
  ? " (--all: everything again)"
  : reheard
    ? ` (${reheard} of them already had a row but no pulse)`
    : "";
console.log(`listening to ${pending.length} of ${tracks?.length ?? 0} tracks…${note}`);

let heard = 0;
let missed = 0;
let mismatched = 0;
const rows = [];

await mapLimit(pending, CONCURRENCY, async (track, index) => {
  try {
    const { mp3, match } = await loadPreview(track);
    const features = analyse(await decode(mp3));
    if (!features) throw new Error("too short");

    const wanted = Math.round((track.duration_ms || 0) / 1000);
    if (match?.duration && wanted > 0 && Math.abs(match.duration - wanted) > 5) {
      mismatched++;
      console.log(
        `  ? ${track.title} (${wanted}s) heard as "${match.title}" by ${match.artist} (${match.duration}s)`
      );
    }

    rows.push({
      track_id: track.track_id,
      embedding: JSON.stringify(features.vector.map((v) => Number(v.toFixed(5)))),
      bpm: features.bpm,
      pulse: features.pulse,
      crest: features.crest,
      loudness: features.loudness,
      dynamics: features.dynamics,
      brightness: features.brightness,
      flatness: features.flatness,
      zcr: features.zcr,
      deezer_id: match?.id ?? null,
      matched_title: match?.title ?? null,
      matched_artist: match?.artist ?? null,
      matched_duration_s: match?.duration ?? null,
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
console.log(`${cacheHits} previews came from the cache; ${mismatched} matches were the wrong length.`);
