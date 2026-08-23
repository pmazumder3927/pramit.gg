import "server-only";

import { createAdminClient } from "@/utils/supabase/admin";
import {
  DEFAULT_SHAPE,
  type Arc,
  type Scorecard,
  type SeqTrack,
  type Setlist,
  type Shape,
  type Side,
} from "@/app/music/manage/lib/types";
import { api, fetchPlaylistMeta, fetchPlaylistTracks, forgetPlaylist } from "./spotify-api";
import { THRESHOLD_KEY, parseVector, type FeelThresholds } from "./feel";
import { getSetting } from "./settings";

/**
 * Playlist sequencing.
 *
 * Other people press play on these from the top and let them run, so the job is
 * to build something that goes somewhere. Three ideas carry it:
 *
 *   SIDES. A 225-track playlist is twelve and a half hours. Nobody hears an arc
 *   that long, so there is no point drawing one. The run is cut into hour-ish
 *   sides and each side is a whole journey — hot open, drift down, lift about
 *   two thirds through, land soft. Press play at the top and you get a shaped
 *   hour; leave it on all afternoon and you get several, each with its own
 *   shape, with a hard reset between them you can hear.
 *
 *   ASSIGNMENT, not chaining. Every slot takes a target arousal from the
 *   contour, tracks are ranked by arousal, and the two are matched up. The
 *   engine this replaces built its order by standing on one song and asking
 *   "which is the best next one" — a walk that cannot build an arc, because it
 *   never knows where in the run it is. It also wasn't asking that question
 *   properly: `costAt` read the length of the *partial* list it was handed, so
 *   `i/(n-1)` was 1 for every candidate at every slot, which multiplied the
 *   largest weight in the model by zero, flattened the wordiness curve to a
 *   constant, and fired the closing rule at every position. What was left
 *   steering it was a nearest-neighbour walk plus a standing preference for
 *   long, sparse songs. That is what "bland" was.
 *
 *   A BAND, not a floor. Neighbours have to be alike AND have to not be too
 *   alike. Across 704,166 real playlists adjacent tracks are 8-16% closer than
 *   random pairs from the same playlist — a band, not a minimum. Pushing that
 *   ratio toward zero is the over-smoothed order everyone recognises and nobody
 *   enjoys, and only having the upper side of the band pushes it there.
 *
 * The axes come from `feel.ts` and are standardised over the whole library, so
 * every threshold below is stated once and means the same thing everywhere.
 */

const ARTIST_WINDOW = 8;

export const WEIGHTS = {
  band: 70,
  equalStep: 10,
  stepCeiling: 90,
  alternate: 110,
  runGuard: 30,
  surprise: 60,
  outlier: 50,
  instrumentalFlip: 15,
  instrumentalRun: 40,
  artistHard: 600,
  artistSoft: 14,
  languageRun: 45,
  envelopeA: 60,
  envelopeV: 26,
  ramp: 150,
  peakAt: 90,
  peakLift: 70,
  floor: 2400,
  smooth: 90,
  strangerBudget: 110,
  strangerPair: 260,
  strangerAnchor: 200,
  strangerLate: 55,
  strangerEarly: 240,
};

export type SeqInternal = SeqTrack & {
  texture: number[] | null;
  meaning: number[] | null;
  density: number | null;
};

// ---------------------------------------------------------------------------
// The contour
// ---------------------------------------------------------------------------

/**
 * What the run should feel like at `t`, in SD of the library's arousal.
 *
 * "album" is the shape 51,010 real albums actually have: openers run hotter
 * (+0.10 to +0.12 normalised) and closers cooler (−0.11 to −0.12), with
 * down-ramps beating up-ramps outright. The bump at 0.68 is where five separate
 * DJ-teaching sources put the peak — "about two thirds through" — which at three
 * and a half minutes a track is minute 47 of an hour-long side.
 */
export function contourArousal(arc: Arc, t: number): number {
  if (arc === "even") return 0;
  if (arc === "party") {
    return -0.45 + 1.15 * t + 0.85 * Math.exp(-((t - 0.78) ** 2) / (2 * 0.09 ** 2));
  }
  return 0.35 - 0.7 * t + Math.exp(-((t - 0.68) ** 2) / (2 * 0.07 ** 2));
}

/** Valence drifts down and gets no bump: the peak evidence is all about loudness. */
export function contourValence(arc: Arc, t: number): number {
  return arc === "even" ? 0 : 0.2 - 0.4 * t;
}

// ---------------------------------------------------------------------------
// Small numerics
// ---------------------------------------------------------------------------

const mean = (values: ArrayLike<number>): number => {
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i];
  return values.length ? sum / values.length : 0;
};

const deviation = (values: ArrayLike<number>): number => {
  const m = mean(values);
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += (values[i] - m) ** 2;
  return values.length ? Math.sqrt(sum / values.length) : 0;
};

/** Rank correlation of position against value — is the run drifting down? */
export function spearman(values: ArrayLike<number>): number {
  const n = values.length;
  if (n < 3) return 0;
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => values[a] - values[b]);
  const rank = new Float64Array(n);
  order.forEach((index, r) => (rank[index] = r));
  const middle = (n - 1) / 2;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += (i - middle) * (rank[i] - middle);
  return sum / ((n * (n * n - 1)) / 12);
}

const quantile = (sorted: ArrayLike<number>, p: number): number =>
  sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];

/**
 * A seeded generator, because the same playlist and the same knobs must give the
 * same order. The engine this replaces stopped its local search on a wall-clock
 * deadline checked mid-pass, so a warm server and a cold one produced different
 * orders from identical input, and there was no way to tell whether a change you
 * heard came from a knob you turned or from the machine's mood.
 */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Distance
// ---------------------------------------------------------------------------

/**
 * How far apart two songs are.
 *
 * Each of the two distances is divided by its own mean before blending, so the
 * result sits on a ratio scale with mean 1. That matters: the adjacency ratio —
 * mean adjacent distance over mean pairwise distance, the number that says
 * "bland" out loud — is only meaningful on a scale with a real zero.
 *
 * They stay two distances rather than becoming one blended similarity. The old
 * single "likeness" slider min-maxed a 34-dimension Euclidean distance whose
 * whole spread was 9% of its mean, so dragging it to "pure sound" didn't make
 * the order sound-driven, it made the term inert.
 */
export type Distance = { m: Float32Array; n: number };

export function buildDistance(tracks: SeqInternal[], alike: number): Distance {
  const n = tracks.length;
  const m = new Float32Array(n * n);
  const pairs = (n * (n - 1)) / 2;
  const texture = new Float64Array(pairs);
  const meaning = new Float64Array(pairs);
  const hasMeaning = new Uint8Array(pairs);

  let k = 0;
  let textureSum = 0;
  let meaningSum = 0;
  let meaningCount = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++, k++) {
      const a = tracks[i];
      const b = tracks[j];
      if (a.texture && b.texture) {
        let sum = 0;
        for (let d = 0; d < a.texture.length; d++) sum += (a.texture[d] - b.texture[d]) ** 2;
        texture[k] = Math.sqrt(sum);
      } else {
        texture[k] = -1;
      }
      if (a.meaning && b.meaning) {
        let dot = 0;
        for (let d = 0; d < a.meaning.length; d++) dot += a.meaning[d] * b.meaning[d];
        meaning[k] = 1 - dot;
        hasMeaning[k] = 1;
        meaningSum += meaning[k];
        meaningCount++;
      }
      if (texture[k] >= 0) textureSum += texture[k];
    }
  }

  const measured = Array.from(texture).filter((v) => v >= 0);
  const textureMean = measured.length ? textureSum / measured.length : 1;
  const meaningMean = meaningCount ? meaningSum / meaningCount : 1;

  k = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++, k++) {
      const t = texture[k] >= 0 ? texture[k] / (textureMean || 1) : null;
      const s = hasMeaning[k] ? meaning[k] / (meaningMean || 1) : null;
      // Whichever one we have; the blend only when we have both. A track with
      // nothing measured sits at the average distance from everything, which is
      // the honest answer rather than a confident wrong one.
      const value = t !== null && s !== null ? (1 - alike) * t + alike * s : (t ?? s ?? 1);
      m[i * n + j] = value;
      m[j * n + i] = value;
    }
  }
  return { m, n };
}

// ---------------------------------------------------------------------------
// Sides
// ---------------------------------------------------------------------------

/** How many tracks in each side, so a side runs about `sideMinutes` long. */
export function planSides(tracks: SeqInternal[], sideMinutes: number): number[] {
  const total = tracks.reduce((sum, t) => sum + (t.durationMs || 210_000), 0) / 60_000;
  const count = Math.max(1, Math.round(total / Math.max(12, sideMinutes)));
  // A side needs enough songs to have a shape at all — an arc across six is not
  // an arc. `the lads with the class` is nineteen very long tracks, which by
  // minutes alone wants three sides of six, and none of them can carry a peak.
  if (count <= 1 || tracks.length < count * 8) {
    const fits = Math.max(1, Math.floor(tracks.length / 8));
    if (fits <= 1) return [tracks.length];
    const sizes: number[] = [];
    let used = 0;
    for (let i = 0; i < fits; i++) {
      const want = Math.round((tracks.length / fits) * (i + 1)) - used;
      sizes.push(want);
      used += want;
    }
    return sizes.filter((size) => size > 0);
  }
  const sizes: number[] = [];
  let used = 0;
  for (let i = 0; i < count; i++) {
    const want = Math.round((tracks.length / count) * (i + 1)) - used;
    sizes.push(want);
    used += want;
  }
  return sizes.filter((size) => size > 0);
}

/**
 * Which songs share a side. A side should sound like somewhere, so this is
 * k-medoids over the same distance the ordering uses, with the cluster sizes
 * held to the plan — a side of three and a side of forty is not two sides.
 */
export function assignSides(
  tracks: SeqInternal[],
  sizes: number[],
  distance: Distance,
  random: () => number
): number[][] {
  const k = sizes.length;
  const n = tracks.length;
  if (k <= 1) return [Array.from({ length: n }, (_, i) => i)];

  const medoids = [Math.floor(random() * n)];
  while (medoids.length < k) {
    let best = 0;
    let bestDistance = -Infinity;
    for (let i = 0; i < n; i++) {
      if (medoids.indexOf(i) >= 0) continue;
      let nearest = Infinity;
      for (const m of medoids) nearest = Math.min(nearest, distance.m[m * n + i]);
      if (nearest > bestDistance) {
        bestDistance = nearest;
        best = i;
      }
    }
    medoids.push(best);
  }

  let groups: number[][] = [];
  for (let pass = 0; pass < 14; pass++) {
    const claims = [];
    for (let i = 0; i < n; i++) {
      const to = medoids.map((m) => distance.m[m * n + i]);
      let best = 0;
      for (let j = 1; j < k; j++) if (to[j] < to[best]) best = j;
      let second = Infinity;
      for (let j = 0; j < k; j++) if (j !== best) second = Math.min(second, to[j]);
      claims.push({ i, best, gap: second - to[best], to });
    }
    // Strongest preference gets served first, so the tracks that only fit one
    // side get that side and the ambivalent ones fill in around them.
    claims.sort((a, b) => b.gap - a.gap);
    groups = Array.from({ length: k }, () => [] as number[]);
    for (const claim of claims) {
      let group = claim.best;
      if (groups[group].length >= sizes[group]) {
        let open = -1;
        for (let j = 0; j < k; j++) {
          if (groups[j].length < sizes[j] && (open < 0 || claim.to[j] < claim.to[open])) open = j;
        }
        if (open >= 0) group = open;
      }
      groups[group].push(claim.i);
    }
    const next = groups.map((group) => {
      let best = group[0];
      let bestSum = Infinity;
      for (const a of group) {
        let sum = 0;
        for (const b of group) sum += distance.m[a * n + b];
        if (sum < bestSum) {
          bestSum = sum;
          best = a;
        }
      }
      return best;
    });
    if (next.every((m, j) => m === medoids[j])) break;
    for (let j = 0; j < k; j++) medoids[j] = next[j];
  }
  return groups.filter((group) => group.length > 0);
}

// ---------------------------------------------------------------------------
// The objective
// ---------------------------------------------------------------------------

export type Bench = {
  n: number;
  d: Float32Array;
  meanPair: number;
  shape: Shape;
  small: boolean;
  opening: boolean;
  /** the fewest same-artist tracks in a row this playlist can possibly manage */
  artistRun: number;
  tauLo: number;
  tauHi: number;
  tauAbrupt: number;
  floorTarget: number;
  spread: number;
  arousal: Float64Array;
  valence: Float64Array;
  instrumental: Uint8Array;
  stranger: Uint8Array;
  anchor: Uint8Array;
  artist: Int32Array;
  language: Int32Array;
  members: SeqInternal[];
  /** the tail of the previous side, read-only */
  preCount: number;
  preD: Float32Array;
  preStranger: Uint8Array;
  preAnchor: Uint8Array;
  preInstrumental: Uint8Array;
  preArtist: Int32Array;
};

/** Everything one evaluation of the cost needs, packed so it touches no objects. */
export function makeBench(
  members: number[],
  tracks: SeqInternal[],
  distance: Distance,
  shape: Shape,
  limits: FeelThresholds & { artistRun?: number },
  prefix: number[] = []
): Bench {
  const n = members.length;
  const d = new Float32Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) d[i * n + j] = distance.m[members[i] * distance.n + members[j]];
  }
  const pairs: number[] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push(d[i * n + j]);
  pairs.sort((a, b) => a - b);

  // "movement" widens the band on both sides, which is the honest way to ask for
  // more contrast: it lets neighbours be further apart AND stops them being too
  // close, rather than just weakening the smoothness pressure.
  const width = 1 - 0.45 * (shape.movement - 0.5) * 2;

  const rows = members.map((m) => tracks[m]);
  const artistKeys = new Map<string, number>();
  const keyOf = (track: SeqInternal, fallback: number) => {
    const id = track.artistId;
    if (!id) return -1 - fallback;
    if (!artistKeys.has(id)) artistKeys.set(id, artistKeys.size);
    return artistKeys.get(id)!;
  };
  const languageKeys = new Map<string, number>();
  const languageOf = (track: SeqInternal) => {
    if (!track.language) return -1;
    if (!languageKeys.has(track.language)) languageKeys.set(track.language, languageKeys.size);
    return languageKeys.get(track.language)!;
  };

  const artist = Int32Array.from(rows, (track, i) => keyOf(track, i));
  const pre = prefix.map((m) => tracks[m]);
  const preD = new Float32Array(pre.length * n);
  for (let a = 0; a < pre.length; a++) {
    for (let i = 0; i < n; i++) preD[a * n + i] = distance.m[prefix[a] * distance.n + members[i]];
  }

  const arousal = Float64Array.from(rows, (track) => track.arousal ?? 0);
  const spread = deviation(arousal);

  return {
    n,
    d,
    meanPair: mean(pairs),
    shape,
    small: n < 12,
    opening: prefix.length === 0,
    artistRun: Math.max(2, limits.artistRun ?? 2),
    tauLo: quantile(pairs, 0.25 * width),
    tauHi: quantile(pairs, 1 - 0.2 * width),
    tauAbrupt: quantile(pairs, 0.9),
    // The flatness floor has to be reachable. A side whose own spread of arousal
    // is 0.46 SD cannot show 0.40 SD inside every four tracks while also fitting
    // a contour, and asking anyway just makes the search break some other rule
    // silently. Ask for a share of what this side actually has.
    floorTarget: Math.min(0.4, 0.62 * spread),
    spread,
    arousal,
    valence: Float64Array.from(rows, (track) => track.valence ?? 0),
    instrumental: Uint8Array.from(rows, (track) => (track.instrumental ? 1 : 0)),
    stranger: Uint8Array.from(rows, (track) => (track.stranger ? 1 : 0)),
    anchor: Uint8Array.from(rows, (track) => (track.anchor ? 1 : 0)),
    artist,
    language: Int32Array.from(rows, languageOf),
    members: rows,
    preCount: pre.length,
    preD,
    preStranger: Uint8Array.from(pre, (track) => (track.stranger ? 1 : 0)),
    preAnchor: Uint8Array.from(pre, (track) => (track.anchor ? 1 : 0)),
    preInstrumental: Uint8Array.from(pre, (track) => (track.instrumental ? 1 : 0)),
    preArtist: Int32Array.from(pre, (track) =>
      track.artistId && artistKeys.has(track.artistId) ? artistKeys.get(track.artistId)! : -1
    ),
  };
}

export function cost(order: Int32Array | number[], b: Bench): number {
  const n = b.n;
  const d = b.d;
  const shape = b.shape;
  const move = shape.movement;
  const arc = shape.arc;
  const fit = shape.shape;
  const W = WEIGHTS;
  let J = 0;

  // The handover from the previous side. Without this the one pair a listener
  // hears as the seam is the one pair no rule governs, and nine of every ten
  // adjacency defects landed exactly there.
  if (b.preCount > 0) {
    const last = b.preCount - 1;
    const head = order[0];
    const gap = b.preD[last * n + head];
    const over = gap - b.tauHi;
    const under = b.tauLo - gap;
    // A seam is allowed to be a bigger step than an ordinary pair: it is the one
    // moment the listener is guaranteed to be paying attention.
    if (over > 0) J += W.band * move * over * over * 0.5;
    if (under > 0) J += W.band * move * under * under;
    if (b.preStranger[last] && b.stranger[head]) J += W.strangerPair;
    if (b.preArtist[last] >= 0 && b.preArtist[last] === b.artist[head]) J += W.artistHard;
    if (b.preInstrumental[last] && b.instrumental[head]) J += W.instrumentalRun;
    if (b.stranger[head] && !b.preAnchor[last] && !(n > 1 && b.anchor[order[1]])) {
      J += W.strangerAnchor;
    }
  }

  // ---- adjacent pairs ---------------------------------------------------
  let stepSum = 0;
  let stepSquares = 0;
  let flips = 0;
  let run = 1;
  let longRuns = 0;
  let previousSign = 0;
  for (let i = 0; i + 1 < n; i++) {
    const a = order[i];
    const c = order[i + 1];
    const gap = d[a * n + c];
    stepSum += gap;
    stepSquares += gap * gap;

    // A band, not a floor. Too far apart jars; too close is the bland failure.
    const over = gap - b.tauHi;
    const under = b.tauLo - gap;
    if (over > 0) J += W.band * move * over * over;
    if (under > 0) J += W.band * move * under * under;

    // A ceiling on the arousal step, free below 1.6 SD — about two quintiles.
    const jump = Math.abs(b.arousal[c] - b.arousal[a]) - 1.6;
    if (jump > 0) J += W.stepCeiling * jump * jump;

    // Real playlists actively alternate sung and instrumental: adjacent pairs
    // differ on it *more* than random pairs do. A pure smoothness objective gets
    // this exactly backwards.
    if (b.instrumental[a] !== b.instrumental[c]) J -= W.instrumentalFlip;

    // Never two strangers in a row.
    if (b.stranger[a] && b.stranger[c]) J += W.strangerPair;

    const sign = b.arousal[c] > b.arousal[a] ? 1 : -1;
    if (i > 0) {
      if (sign !== previousSign) {
        flips++;
        if (run >= 3) longRuns++;
        run = 1;
      } else run++;
    }
    previousSign = sign;
  }
  if (run >= 3) longRuns++;

  const stepCount = Math.max(1, n - 1);
  const stepMean = stepSum / stepCount;
  J += W.equalStep * n * Math.sqrt(Math.max(0, stepSquares / stepCount - stepMean * stepMean));

  // Across 51,010 albums the direction of travel reverses about 68% of the time —
  // a zig-zag inside a band, never a ramp. But strict alternation reads as
  // machine-assembled, so this targets the *rate* and only forbids long runs.
  if (n > 3) {
    const rate = flips / (n - 2);
    J += W.alternate * move * n * (rate - 0.68) ** 2;
  }
  J += W.runGuard * longRuns;

  // ---- the anti-bland term ---------------------------------------------
  // Measured on 1,039 chords with 39 listeners: pleasure rises with surprise
  // (β +0.327), falls with uncertainty (β −0.143), and falls with the two
  // together (β −0.124). So a rupture after a settled run is rewarded, a clean
  // landing after a jumbled one is rewarded, and a small change after a settled
  // run — which is exactly what bland means — is not.
  if (n > 8) {
    const surprise = new Float64Array(n - 4);
    const uncertainty = new Float64Array(n - 4);
    for (let i = 4; i < n; i++) {
      const here = order[i];
      let within = 0;
      let toHere = 0;
      for (let a = i - 4; a < i; a++) {
        toHere += d[here * n + order[a]];
        for (let c = a + 1; c < i; c++) within += d[order[a] * n + order[c]];
      }
      surprise[i - 4] = toHere / 4;
      uncertainty[i - 4] = within / 6;
    }
    const sMean = mean(surprise);
    const sSd = deviation(surprise) || 1;
    const uMean = mean(uncertainty);
    const uSd = deviation(uncertainty) || 1;
    for (let k = 0; k < surprise.length; k++) {
      const s = (surprise[k] - sMean) / sSd;
      const u = (uncertainty[k] - uMean) / uSd;
      J -= W.surprise * move * (0.327 * s - 0.143 * u - 0.124 * s * u);
    }
  }

  // A track sitting wrong in its own neighbourhood — the one content-side signal
  // the skip literature actually endorses.
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - 5);
    const hi = Math.min(n - 1, i + 5);
    let sum = 0;
    let count = 0;
    for (let j = lo; j <= hi; j++) {
      if (j === i) continue;
      sum += d[order[i] * n + order[j]];
      count++;
    }
    if (count) {
      const out = sum / count - b.tauAbrupt;
      if (out > 0) J += W.outlier * out * out;
    }
  }

  // ---- separation -------------------------------------------------------
  // At most two in a row by one name, then eight slots off. Adjacency at lag one
  // or two is normal — artist is the single most coherent feature of real
  // playlists — so this only forbids the third, and only mildly discourages a
  // recurrence inside the window.
  for (let i = 0; i < n; i++) {
    const key = b.artist[order[i]];
    if (key < 0) continue;
    let straight = 1;
    for (let j = i + 1; j < n && j <= i + ARTIST_WINDOW; j++) {
      if (b.artist[order[j]] !== key) continue;
      if (j === i + straight) {
        straight++;
        if (straight > b.artistRun) J += W.artistHard;
      } else J += W.artistSoft;
    }
  }

  let languageRun = 1;
  let instrumentalRun = 1;
  for (let i = 1; i < n; i++) {
    const language = b.language[order[i]];
    languageRun = language >= 0 && language === b.language[order[i - 1]] ? languageRun + 1 : 1;
    if (languageRun >= 7) J += W.languageRun;
    instrumentalRun =
      b.instrumental[order[i]] && b.instrumental[order[i - 1]] ? instrumentalRun + 1 : 1;
    if (instrumentalRun >= 3) J += W.instrumentalRun;
  }

  // ---- the shape of the side -------------------------------------------
  const arousal = new Float64Array(n);
  for (let i = 0; i < n; i++) arousal[i] = b.arousal[order[i]];

  // The contour is fitted to the five-track moving average, never to a single
  // track. That is what lets the arc and the zig-zag coexist: the envelope moves
  // 0.7 SD across a whole side while the step-to-step ripple is about 1.0 SD, so
  // the ripple owns the local texture and the arc owns the hour.
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - 2);
    const hi = Math.min(n - 1, i + 2);
    let a = 0;
    let v = 0;
    let count = 0;
    for (let j = lo; j <= hi; j++) {
      a += arousal[j];
      v += b.valence[order[j]];
      count++;
    }
    const t = n > 1 ? i / (n - 1) : 0;
    J += W.envelopeA * fit * (a / count - contourArousal(arc, t)) ** 2;
    J += W.envelopeV * fit * (v / count - contourValence(arc, t)) ** 2;
  }

  // No fourteen-minute stretch may sit still. Perceived intensity falls by about
  // half after three minutes at a constant level, so a flat run does not merely
  // bore the listener — it stops being heard.
  //
  // A linear hinge, not a squared one: squared penalties vanish exactly where
  // this has to bite. A window at 0.20 against a 0.40 floor is 0.04 of squared
  // error, which every other term outbids.
  for (let i = 0; i + 4 <= n; i++) {
    let m = 0;
    for (let j = i; j < i + 4; j++) m += arousal[j];
    m /= 4;
    let v = 0;
    for (let j = i; j < i + 4; j++) v += (arousal[j] - m) ** 2;
    const short = b.floorTarget - Math.sqrt(v / 4);
    if (short > 0) J += W.floor * move * short;
  }

  // The term that makes "too smooth" unschedulable. Adjacent pairs should sit
  // 5-15% closer than random pairs from the same playlist, which is what 704,166
  // real playlists do. Below that band is the order the owner called bland.
  if (n > 3 && b.meanPair > 1e-9) {
    const ratio = stepMean / b.meanPair;
    const below = 0.85 - ratio;
    const above = ratio - 0.95;
    // Squared, so it is gentle just outside the band and unignorable far from
    // it — the opposite shape to the flatness floor, which has to bite at its
    // own threshold because that is where the failure lives.
    if (below > 0) J += W.smooth * move * n * below * below;
    if (above > 0) J += W.smooth * move * n * above * above;
  }

  if (!b.small) {
    if (arc === "album") {
      const rho = spearman(arousal);
      const tooFlat = rho + 0.05;
      const tooSteep = -0.32 - rho;
      if (tooFlat > 0) J += W.ramp * fit * n * tooFlat * tooFlat;
      if (tooSteep > 0) J += W.ramp * fit * n * tooSteep * tooSteep;
    }
    if (arc !== "even") {
      let peak = 0;
      for (let i = 1; i < n; i++) if (arousal[i] > arousal[peak]) peak = i;
      const want = arc === "party" ? 0.78 : 0.68;
      J += W.peakAt * fit * n * (peak / (n - 1) - want) ** 2;
      let before = 0;
      let count = 0;
      for (let j = Math.max(0, peak - 3); j < peak; j++) {
        before += arousal[j];
        count++;
      }
      // A peak built against a plateau is not a peak: loudness adaptation means
      // the run into it has to be quieter for the lift to be heard at all.
      const short = 0.8 - (arousal[peak] - (count ? before / count : 0));
      if (short > 0) J += W.peakLift * fit * n * short * short;
    }

    // How much unfamiliar material a rolling seven can carry, rising with
    // position: someone still listening at minute twenty has already decided to
    // stay, and is a different proposition from someone at minute one.
    for (let i = 0; i + 7 <= n; i++) {
      let strangers = 0;
      let anchors = 0;
      for (let j = i; j < i + 7; j++) {
        strangers += b.stranger[order[j]];
        anchors += b.anchor[order[j]];
      }
      const allowed = i < 5 ? 0 : i < 20 ? 1 : 2;
      const over = strangers - Math.round(allowed * (0.5 + shape.discovery));
      if (over > 0) J += W.strangerBudget * shape.discovery * over;
      if (anchors < 2) J += W.strangerAnchor * 0.35 * (2 - anchors);
    }
  }

  // Nothing unfamiliar in the first five. What spikes at the start of a session
  // is not skipping a track, it is leaving the playlist altogether, and a
  // stranger is what triggers it.
  // ...and every side is somebody's first five. Whoever puts the playlist on and
  // reaches side seven is starting a session too, just one that already went
  // well, so the rule holds there at a third of the weight.
  {
    const weight = b.opening ? W.strangerEarly : W.strangerEarly / 3;
    for (let i = 0; i < Math.min(5, n); i++) {
      if (b.stranger[order[i]]) J += weight * (5 - i);
    }
  }

  // Unfamiliar material earns its keep later in the side. Written as a bonus
  // that grows toward the end rather than a penalty that shrinks toward it —
  // the same objective, but only this form reads correctly to anything that
  // compares candidates one slot at a time.
  if (n > 1) {
    for (let i = 0; i < n; i++) {
      if (b.stranger[order[i]]) J -= W.strangerLate * shape.discovery * (i / (n - 1));
    }
  }

  // Every stranger needs a familiar face beside it. Radio has never put two
  // unknowns together, and a Pandora study measured the price of getting this
  // wrong at an eightfold swing in whether the listener leaves.
  for (let i = 0; i < n; i++) {
    if (!b.stranger[order[i]]) continue;
    const left = i > 0 && b.anchor[order[i - 1]];
    const right = i + 1 < n && b.anchor[order[i + 1]];
    if (!left && !right) J += W.strangerAnchor;
  }

  return J;
}

// ---------------------------------------------------------------------------
// Construction and search
// ---------------------------------------------------------------------------

/**
 * Rank the tracks by arousal, rank the slots by what the contour wants there,
 * and match them up. The arc is then right by construction, which is the thing
 * a nearest-neighbour walk can never manage.
 */
export function assignToContour(members: number[], b: Bench, shape: Shape): Int32Array {
  const n = members.length;
  if (n < 3) return Int32Array.from(members.map((_, i) => i));
  const slots = Array.from({ length: n }, (_, i) => i).sort(
    (x, y) => contourArousal(shape.arc, x / (n - 1)) - contourArousal(shape.arc, y / (n - 1))
  );
  const byArousal = Array.from({ length: n }, (_, i) => i).sort(
    (x, y) => b.arousal[x] - b.arousal[y]
  );
  const out = new Int32Array(n);
  slots.forEach((slot, rank) => (out[slot] = byArousal[rank]));

  // A perfect rank-to-rank assignment is a sort, and a sort has no local
  // movement at all. Rotating inside each group of four keeps the five-track
  // moving average — and so the contour — while giving every window something
  // to hear.
  for (let i = 0; i + 4 <= n; i += 4) {
    const g = [out[i], out[i + 1], out[i + 2], out[i + 3]];
    out[i] = g[1];
    out[i + 1] = g[3];
    out[i + 2] = g[0];
    out[i + 3] = g[2];
  }
  return out;
}

/**
 * Simulated annealing on the whole objective.
 *
 * Three move types, because the one that matters most is the one the old local
 * search did not have: relocating a short run. Swapping two positions cannot fix
 * a track that belongs three minutes earlier without also displacing whatever is
 * there. The budget is a fixed count rather than a wall clock, so the same input
 * always gives the same order.
 */
export function anneal(
  start: Int32Array,
  b: Bench,
  seed: number,
  budget = 30_000,
  frozen = 0
): Int32Array {
  const n = start.length;
  const span = n - frozen;
  if (span < 4) return Int32Array.from(start);
  const random = rng(seed);
  const current = Int32Array.from(start);
  let currentCost = cost(current, b);
  const best = Int32Array.from(current);
  let bestCost = currentCost;
  const hot = Math.max(1, Math.abs(currentCost) * 0.01);
  const cold = hot * 0.0012;
  const next = new Int32Array(n);
  const scratch: number[] = [];

  for (let step = 0; step < budget; step++) {
    const temperature = hot * Math.pow(cold / hot, step / budget);
    next.set(current);
    const kind = random();
    if (kind < 0.42) {
      const i = frozen + Math.floor(random() * span);
      const j = frozen + Math.floor(random() * span);
      const held = next[i];
      next[i] = next[j];
      next[j] = held;
    } else if (kind < 0.84) {
      const length = 1 + Math.floor(random() * 3);
      const from = frozen + Math.floor(random() * Math.max(1, span - length));
      const to = frozen + Math.floor(random() * Math.max(1, span - length));
      scratch.length = 0;
      for (let k = 0; k < n; k++) if (k < from || k >= from + length) scratch.push(next[k]);
      const segment: number[] = [];
      for (let k = from; k < from + length; k++) segment.push(next[k]);
      scratch.splice(to, 0, ...segment);
      for (let k = 0; k < n; k++) next[k] = scratch[k];
    } else {
      let i = frozen + Math.floor(random() * span);
      let j = frozen + Math.floor(random() * span);
      if (i > j) {
        const held = i;
        i = j;
        j = held;
      }
      if (j - i < 2) continue;
      for (let k = 0; k <= (j - i) >> 1; k++) {
        const held = next[i + k];
        next[i + k] = next[j - k];
        next[j - k] = held;
      }
    }
    const trial = cost(next, b);
    if (trial < currentCost || random() < Math.exp((currentCost - trial) / temperature)) {
      current.set(next);
      currentCost = trial;
      if (trial < bestCost) {
        best.set(next);
        bestCost = trial;
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

function occurrenceUids(trackIds: string[]): string[] {
  const seen = new Map<string, number>();
  return trackIds.map((id) => {
    const n = (seen.get(id) || 0) + 1;
    seen.set(id, n);
    return n === 1 ? id : `${id}#${n}`;
  });
}

const FALLBACK_LIMITS: FeelThresholds = {
  strangerBelow: 0.2,
  anchorAbove: 0.6,
  fittedAt: new Date(0).toISOString(),
};

type Held = {
  id: string | null;
  name?: string;
  artists: Array<{ id: string | null; name: string }>;
  album?: { images?: Array<{ url: string }> };
  duration_ms?: number;
  external_urls?: { spotify?: string };
};

/**
 * What the playlist holds, and whether we could actually ask Spotify.
 *
 * Spotify hands out multi-hour rate limits — a day of shaping earned a
 * Retry-After of 49,103 seconds — and the whole room went to a 500 behind it.
 * The local copy is a day old at worst and good enough to look at and shape
 * against; what it cannot support is applying, because an order is written as
 * moves between live positions. So it degrades to the copy, says so, and the
 * apply button turns itself off.
 */
async function readPlaylist(playlistId: string): Promise<{
  meta: {
    name: string;
    images?: Array<{ url: string }> | null;
    external_urls?: { spotify?: string } | null;
  };
  held: Array<{ id: string | null; track: Held | null }>;
  offline: boolean;
}> {
  try {
    const [meta, items] = await Promise.all([
      fetchPlaylistMeta(playlistId),
      fetchPlaylistTracks(playlistId),
    ]);
    return {
      meta,
      held: items.map((item) => ({ id: item.track?.id ?? null, track: item.track as Held | null })),
      offline: false,
    };
  } catch (error) {
    const supabase = createAdminClient();
    const [{ data: playlist }, { data: rows }] = await Promise.all([
      supabase
        .from("music_playlists")
        .select("name, image_url, url")
        .eq("playlist_id", playlistId)
        .maybeSingle(),
      supabase
        .from("music_playlist_tracks")
        .select("track_id, position")
        .eq("playlist_id", playlistId)
        .order("position", { ascending: true }),
    ]);
    if (!playlist || !rows?.length) throw error;
    return {
      meta: {
        name: (playlist.name as string) || playlistId,
        images: playlist.image_url ? [{ url: playlist.image_url as string }] : [],
        external_urls: { spotify: (playlist.url as string) || undefined },
      },
      held: rows.map((row) => ({
        id: row.track_id as string,
        track: { id: row.track_id as string, artists: [] },
      })),
      offline: true,
    };
  }
}

async function loadTracks(playlistId: string) {
  const supabase = createAdminClient();
  const { meta, held, offline } = await readPlaylist(playlistId);

  const live = held
    .map((item) => item.track)
    .filter((track): track is Held => Boolean(track?.id));
  const liveIds = live.map((track) => track.id!);
  const uids = occurrenceUids(liveIds);
  const uniqueIds = Array.from(new Set(liveIds));

  const [
    { data: rows },
    { data: lyricRows },
    { data: feelRows },
    { data: soundRows },
    { data: senseRows },
    { data: membershipRows },
    { data: playlistRows },
    limits,
  ] = await Promise.all([
    supabase
      .from("music_tracks")
      .select(
        "track_id, title, artist_display, artist_ids, album_image_url, song_url, duration_ms, release_year, affinity, unavailable"
      )
      .in("track_id", uniqueIds),
    supabase
      .from("music_track_lyrics")
      .select("track_id, status, language, words_per_min")
      .in("track_id", uniqueIds),
    supabase
      .from("music_track_feel")
      .select(
        "track_id, arousal, valence, familiarity, density, opens_well, texture, meaning"
      )
      .in("track_id", uniqueIds),
    supabase.from("music_track_sound").select("track_id, bpm").in("track_id", uniqueIds),
    supabase.from("music_track_sense").select("track_id").in("track_id", uniqueIds),
    supabase.from("music_playlist_tracks").select("track_id, playlist_id").in("track_id", uniqueIds),
    supabase.from("music_playlists").select("playlist_id, name").eq("role", "shelf").eq("active", true),
    getSetting<FeelThresholds>(THRESHOLD_KEY),
  ]);

  const byId = new Map((rows || []).map((row) => [row.track_id as string, row]));
  const lyricById = new Map((lyricRows || []).map((row) => [row.track_id as string, row]));
  const feelById = new Map((feelRows || []).map((row) => [row.track_id as string, row]));
  const soundById = new Map((soundRows || []).map((row) => [row.track_id as string, row]));
  const senseIds = new Set((senseRows || []).map((row) => row.track_id as string));
  const playlistNames = new Map(
    (playlistRows || []).map((row) => [row.playlist_id as string, row.name as string])
  );

  const kinById = new Map<string, string[]>();
  for (const row of membershipRows || []) {
    if (row.playlist_id === playlistId) continue;
    const name = playlistNames.get(row.playlist_id as string);
    if (!name) continue;
    const list = kinById.get(row.track_id as string) || [];
    list.push(name);
    kinById.set(row.track_id as string, list);
  }

  const edges = limits ?? FALLBACK_LIMITS;

  const tracks: SeqInternal[] = live.map((track, index) => {
    const row = byId.get(track.id!);
    const lyric = lyricById.get(track.id!);
    const feel = feelById.get(track.id!);
    const instrumental = lyric?.status === "instrumental";
    const unavailable = Boolean(row?.unavailable) || !((row?.title as string) || track.name);
    const familiarity = feel ? (feel.familiarity as number) : null;

    return {
      uid: uids[index],
      trackId: track.id!,
      title: (row?.title as string) || track.name || "gone from Spotify",
      artist:
        (row?.artist_display as string) || track.artists.map((a) => a.name).join(", ") || "—",
      artistId: (row?.artist_ids as string[] | null)?.[0] || track.artists[0]?.id || null,
      art: (row?.album_image_url as string) || track.album?.images?.[0]?.url || null,
      songUrl: (row?.song_url as string) || track.external_urls?.spotify || null,
      durationMs: (row?.duration_ms as number) ?? track.duration_ms,
      releaseYear: (row?.release_year as number) ?? null,
      affinity: (row?.affinity as number) ?? null,
      language: (lyric?.language as string) ?? null,
      wordsPerMin: (lyric?.words_per_min as number | null) ?? (instrumental ? 0 : null),
      instrumental,
      unavailable,
      arousal: feel ? (feel.arousal as number) : null,
      valence: feel ? (feel.valence as number) : null,
      familiarity,
      stranger: familiarity !== null && familiarity < edges.strangerBelow,
      anchor: familiarity !== null && familiarity >= edges.anchorAbove,
      opensWell: Boolean(feel?.opens_well),
      bpm: (soundById.get(track.id!)?.bpm as number) ?? null,
      heard: soundById.has(track.id!),
      read: senseIds.has(track.id!),
      felt: Boolean(feel),
      kin: kinById.get(track.id!) || [],
      texture: parseVector(feel?.texture),
      meaning: parseVector(feel?.meaning),
      density: (feel?.density as number | null) ?? null,
    };
  });

  return { meta, tracks, liveOrder: uids, limits: edges, offline };
}

// ---------------------------------------------------------------------------
// Sequencing a whole playlist
// ---------------------------------------------------------------------------

export type Sequenced = {
  order: SeqInternal[];
  sides: Array<{ tracks: SeqInternal[]; bench: Bench }>;
  distance: Distance;
  /** where each playable track sits in `distance` */
  slot: Map<string, number>;
  suspended: string[];
};

/**
 * Thresholds this playlist can actually meet.
 *
 * "Stranger" stays a library-wide idea wherever it can, because that is what a
 * visitor experiences — they do not know this playlist's context, only whether
 * they have heard the song. But an anchor has to exist to be useful, and an
 * artist rule has to be satisfiable. Where the library-wide version is
 * impossible, fall back to the best this playlist can offer and record what was
 * relaxed, so the scorecard never quietly reports a rule it never enforced.
 */
export function fitToPlaylist(
  tracks: SeqInternal[],
  limits: FeelThresholds,
  suspended: string[]
): FeelThresholds & { artistRun: number } {
  const n = tracks.length;
  const known = tracks
    .map((track) => track.familiarity)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);

  let { strangerBelow, anchorAbove } = limits;

  if (known.length >= 6) {
    const anchors = known.filter((value) => value >= anchorAbove).length;
    const strangers = known.filter((value) => value < strangerBelow).length;
    // One anchor has to serve at most two strangers for the rule to be keepable.
    if (anchors * 2 < strangers || anchors < Math.max(2, n * 0.12)) {
      anchorAbove = Math.min(anchorAbove, quantile(known, 0.65));
      suspended.push(
        "the familiar-neighbour rule now reads against this playlist rather than the library — nothing here is widely known"
      );
    }
    if (strangers > n * 0.45) {
      strangerBelow = Math.min(strangerBelow, quantile(known, 0.4));
      suspended.push("almost everything here is obscure, so \"a stranger\" means obscure for this playlist");
    }
  }

  // With `a` distinct artists over `n` tracks nothing can do better than
  // ceil(n/a) of them in a row, so asking for two is asking for the impossible.
  const artists = new Set(tracks.map((track) => track.artistId).filter(Boolean));
  const floor = artists.size > 0 ? Math.ceil(n / artists.size) : 1;
  const artistRun = Math.max(2, floor);
  if (artistRun > 2) {
    suspended.push(
      `artist separation — ${artists.size} artist${artists.size === 1 ? "" : "s"} across ${n} songs cannot do better than ${artistRun} in a row`
    );
  }

  return { strangerBelow, anchorAbove, fittedAt: limits.fittedAt, artistRun };
}

export function sequence(
  all: SeqInternal[],
  shape: Shape,
  limits: FeelThresholds,
  seed: number,
  budget = 30_000
): Sequenced {
  // Delisted tracks carry no signal and cannot be played; they go to the end
  // rather than distorting every rule with a run of blanks.
  const gone = all.filter((track) => track.unavailable);
  const tracks = all.filter((track) => !track.unavailable);
  const distance = buildDistance(tracks, shape.alike);
  const suspended: string[] = [];

  const slot = new Map(tracks.map((track, i) => [track.uid, i]));

  if (tracks.length < 6) {
    return {
      order: [...tracks, ...gone],
      sides: [],
      distance,
      slot,
      suspended: ["too short to shape at all"],
    };
  }

  // Some playlists cannot obey these rules and it is not their fault. `jojoi` is
  // twenty songs by one artist with nothing on it a stranger would recognise;
  // `postie` is twenty-two Post Malone tracks. Against library-wide thresholds
  // both have zero anchors and no artist separation is possible, so the search
  // would break some rule arbitrarily and silently. Measure what is actually
  // achievable here, adjust, and say out loud what was given up.
  const local = fitToPlaylist(tracks, limits, suspended);
  for (const track of tracks) {
    const familiarity = track.familiarity;
    track.stranger = familiarity !== null && familiarity < local.strangerBelow;
    track.anchor = familiarity !== null && familiarity >= local.anchorAbove;
  }

  const random = rng(seed);
  const sizes = planSides(tracks, shape.sideMinutes);
  let groups = assignSides(tracks, sizes, distance, random);

  // Which side goes first, and in what order the rest follow. Most familiar
  // first, so a stranger's share of the run rises the longer someone stays;
  // neighbouring sides then swap where that makes the handover more distinct
  // without disturbing the familiarity order much.
  const centroidOf = (group: number[]) => {
    const width = tracks[group[0]].texture?.length ?? 0;
    const out = new Float64Array(width);
    let counted = 0;
    for (const i of group) {
      const texture = tracks[i].texture;
      if (!texture) continue;
      for (let j = 0; j < width; j++) out[j] += texture[j];
      counted++;
    }
    if (counted) for (let j = 0; j < width; j++) out[j] /= counted;
    return out;
  };
  const apart = (a: Float64Array, b: Float64Array) => {
    let sum = 0;
    for (let j = 0; j < a.length; j++) sum += (a[j] - b[j]) ** 2;
    return Math.sqrt(sum);
  };
  const centroids = groups.map(centroidOf);
  const familiarityOf = (group: number[]) =>
    mean(group.map((i) => tracks[i].familiarity ?? 0.5));

  const running = groups.map((_, i) => i).sort((a, b) => {
    const score = (i: number) =>
      familiarityOf(groups[i]) + (groups[i].some((k) => tracks[k].opensWell) ? 0.03 : -0.3);
    return score(b) - score(a);
  });
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i + 2 < running.length; i++) {
      const now =
        apart(centroids[running[i - 1]], centroids[running[i]]) +
        apart(centroids[running[i + 1]], centroids[running[i + 2]]);
      const swapped =
        apart(centroids[running[i - 1]], centroids[running[i + 1]]) +
        apart(centroids[running[i]], centroids[running[i + 2]]);
      const drop = familiarityOf(groups[running[i]]) - familiarityOf(groups[running[i + 1]]);
      if (swapped > now * 1.12 && Math.abs(drop) < 0.05) {
        const held = running[i];
        running[i] = running[i + 1];
        running[i + 1] = held;
      }
    }
  }
  groups = running.map((i) => groups[i]);

  const sides: Array<{ tracks: SeqInternal[]; bench: Bench }> = [];
  let tail: number[] = [];
  groups.forEach((group, index) => {
    const bench = makeBench(group, tracks, distance, shape, local, tail);
    if (bench.small && index === 0) {
      suspended.push("the down-ramp, the peak and the discovery budget — too few songs to carry them");
    }
    const slots = Array.from({ length: group.length }, (_, i) => i);
    let order = anneal(assignToContour(slots, bench, shape), bench, seed + index * 7919, budget);

    // Hold the first slot of the first side for something a stranger can walk
    // into: a familiar, sung, normal-length song whose voice arrives inside ten
    // seconds. A forty-five second ambient intro at position one is the single
    // most expensive placement available, and we can see it coming.
    if (index === 0 && shape.openStrong) {
      const legal = Array.from(order).filter(
        (i) =>
          bench.members[i].opensWell &&
          bench.anchor[i] === 1 &&
          bench.arousal[i] >= 0.2 &&
          bench.arousal[i] <= 0.7
      );
      const relaxed = legal.length
        ? legal
        : Array.from(order).filter((i) => bench.members[i].opensWell);
      if (!legal.length && relaxed.length) suspended.push("the opening arousal window");
      if (relaxed.length) {
        const opener = relaxed.reduce((a, i) =>
          (bench.members[i].familiarity ?? 0) > (bench.members[a].familiarity ?? 0) ? i : a
        );
        const rest = Array.from(order).filter((i) => i !== opener);
        order = anneal(
          Int32Array.from([opener, ...rest]),
          bench,
          seed + 13,
          Math.round(budget * 0.6),
          1
        );
      } else suspended.push("the opening rule — nothing here opens cleanly");
    }

    const picked = Array.from(order).map((i) => bench.members[i]);
    sides.push({ tracks: picked, bench });
    const byId = new Map(group.map((m) => [tracks[m].uid, m]));
    tail = picked.slice(-3).map((track) => byId.get(track.uid)!);
  });

  return {
    order: [...sides.flatMap((side) => side.tracks), ...gone],
    sides,
    distance,
    slot,
    suspended,
  };
}

// ---------------------------------------------------------------------------
// Naming the sides
// ---------------------------------------------------------------------------

function mode<T>(values: T[]): { value: T; count: number } | null {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  let best: { value: T; count: number } | null = null;
  for (const entry of Array.from(counts.entries())) {
    if (!best || entry[1] > best.count) best = { value: entry[0], count: entry[1] };
  }
  return best;
}

/**
 * Name a side with the strongest thing that is actually true about it, and never
 * the same name twice — two stretches both called "the 2020s" tell you nothing
 * about either. Positional names are the last resort.
 */
function nameSide(
  side: SeqInternal[],
  index: number,
  count: number,
  dominantLanguage: string | null,
  taken: Set<string>
): { label: string; reason: string } {
  const size = side.length;
  const free = (label: string) => !taken.has(label);
  const arousal = side.map((track) => track.arousal ?? 0);
  const valence = side.map((track) => track.valence ?? 0);
  const meanArousal = mean(arousal);
  const meanValence = mean(valence);

  const languages = side.map((track) => track.language).filter(Boolean) as string[];
  const topLanguage = mode(languages);
  if (
    topLanguage &&
    topLanguage.value !== dominantLanguage &&
    topLanguage.count / size >= 0.5 &&
    free(`in ${topLanguage.value}`)
  ) {
    return {
      label: `in ${topLanguage.value}`,
      reason: `${topLanguage.count} of ${size} are ${topLanguage.value} songs`,
    };
  }

  if (meanArousal >= 0.75 && free("the loud one")) {
    return { label: "the loud one", reason: `runs ${meanArousal.toFixed(1)} SD above the library` };
  }
  if (meanArousal <= -0.75 && free("the quiet one")) {
    return { label: "the quiet one", reason: `runs ${Math.abs(meanArousal).toFixed(1)} SD below the library` };
  }
  if (meanValence >= 0.55 && free("the bright one")) {
    return { label: "the bright one", reason: "the warmest words on the record" };
  }
  if (meanValence <= -0.55 && free("the bleak one")) {
    return { label: "the bleak one", reason: "the darkest words on the record" };
  }

  const strangers = side.filter((track) => track.stranger).length;
  if (strangers / size >= 0.4 && free("the deep end")) {
    return { label: "the deep end", reason: `${strangers} of ${size} almost nobody knows` };
  }
  const anchors = side.filter((track) => track.anchor).length;
  if (anchors / size >= 0.6 && free("the ones everyone knows")) {
    return { label: "the ones everyone knows", reason: `${anchors} of ${size} are widely known` };
  }

  const kin = mode(side.flatMap((track) => track.kin));
  if (kin && kin.count / size >= 0.45 && free(`also in ${kin.value}`)) {
    return { label: `also in ${kin.value}`, reason: `${kin.count} of ${size} live in ${kin.value} too` };
  }

  const years = side.map((track) => track.releaseYear).filter(Boolean) as number[];
  if (years.length >= size * 0.6) {
    const decade = mode(years.map((year) => Math.floor(year / 10) * 10));
    if (decade && decade.count / years.length >= 0.7 && free(`the ${decade.value}s`)) {
      return {
        label: `the ${decade.value}s`,
        reason: `${decade.count} of ${size} are from the ${decade.value}s`,
      };
    }
  }

  const instrumental = side.filter((track) => track.instrumental).length;
  if (instrumental / size >= 0.4 && free("barely any words")) {
    return { label: "barely any words", reason: `${instrumental} of ${size} have no words` };
  }

  const tempos = side.map((track) => track.bpm).filter((v): v is number => Boolean(v));
  if (tempos.length >= size * 0.6) {
    const beat = mean(tempos);
    if (beat >= 132 && free("the fast one")) {
      return { label: "the fast one", reason: `around ${Math.round(beat)} bpm` };
    }
    if (beat <= 94 && free("the slow one")) {
      return { label: "the slow one", reason: `around ${Math.round(beat)} bpm` };
    }
  }

  const wordy = side.map((track) => track.wordsPerMin).filter((v): v is number => v !== null && v > 0);
  if (wordy.length >= size * 0.6) {
    const words = mean(wordy);
    if (words >= 130 && free("the wordy one")) {
      return { label: "the wordy one", reason: `about ${Math.round(words)} words a minute` };
    }
    if (words <= 55 && free("room to breathe")) {
      return { label: "room to breathe", reason: `about ${Math.round(words)} words a minute` };
    }
  }

  if (index === 0 && free("the way in")) return { label: "the way in", reason: `the first ${size}` };
  if (index === count - 1 && free("the last word")) {
    return { label: "the last word", reason: `the final ${size}` };
  }
  // Last resort, and still a fact about the music rather than a number: name a
  // side after the song it peaks on.
  let peak = 0;
  for (let i = 1; i < size; i++) if ((side[i].arousal ?? 0) > (side[peak].arousal ?? 0)) peak = i;
  const plain = side[peak].title
    .replace(/\s*[([].*$/, "")
    .replace(/\s+-\s.*$/, "")
    .toLowerCase()
    .trim();
  const around = `around ${plain.length > 26 ? `${plain.slice(0, 25).replace(/\s\S*$/, "")}…` : plain}`;
  if (free(around)) {
    return { label: around, reason: `${size} songs, loudest at number ${peak + 1}` };
  }
  return { label: `side ${index + 1}`, reason: `${size} songs` };
}

export function describeSides(run: Sequenced): Side[] {
  const dominant = mode(
    run.sides.flatMap((side) => side.tracks.map((track) => track.language).filter(Boolean) as string[])
  );
  const taken = new Set<string>();
  const sides: Side[] = run.sides.map((side, index) => {
    const tracks = side.tracks;
    const n = tracks.length;
    const arousal = tracks.map((track) => track.arousal ?? 0);
    const wanted = tracks.map((_, i) =>
      contourArousal(run.sides[index].bench.shape.arc, n > 1 ? i / (n - 1) : 0)
    );
    let peak = 0;
    for (let i = 1; i < n; i++) if (arousal[i] > arousal[peak]) peak = i;
    let before = 0;
    let counted = 0;
    for (let j = Math.max(0, peak - 3); j < peak; j++) {
      before += arousal[j];
      counted++;
    }
    let restless = true;
    for (let i = 0; i + 4 <= n; i++) {
      if (deviation(arousal.slice(i, i + 4)) < side.bench.floorTarget - 0.02) restless = false;
    }
    const { label, reason } = nameSide(tracks, index, run.sides.length, dominant?.value ?? null, taken);
    taken.add(label);

    return {
      id: `side${index}`,
      label,
      reason,
      uids: tracks.map((track) => track.uid),
      minutes: Math.round(tracks.reduce((sum, t) => sum + (t.durationMs || 0), 0) / 60_000),
      arousal: arousal.map((v) => Number(v.toFixed(2))),
      wanted: wanted.map((v) => Number(v.toFixed(2))),
      ramp: n >= 6 ? Number(spearman(arousal).toFixed(2)) : null,
      peakAt: n >= 6 ? Number((peak / (n - 1)).toFixed(2)) : null,
      peakLift: n >= 6 ? Number((arousal[peak] - (counted ? before / counted : 0)).toFixed(2)) : null,
      restless,
    };
  });

  const gone = run.order.filter((track) => track.unavailable);
  if (gone.length) {
    sides.push({
      id: "gone",
      label: "gone from spotify",
      reason: `${gone.length} delisted — nothing plays them`,
      uids: gone.map((track) => track.uid),
      minutes: 0,
      arousal: [],
      wanted: [],
      ramp: null,
      peakAt: null,
      peakLift: null,
      restless: true,
    });
  }
  return sides;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * How many songs `applySetlist` would actually have to move, and how many
 * requests that takes — the same run-batched selection sort it runs, so the
 * numbers the UI shows are the ones that will happen.
 */
export function movesNeeded(
  liveOrder: string[],
  target: string[]
): { songs: number; requests: number } {
  const present = new Set(liveOrder);
  const wanted: string[] = [];
  const taken = new Set<string>();
  for (const uid of target) {
    if (!present.has(uid) || taken.has(uid)) continue;
    taken.add(uid);
    wanted.push(uid);
  }
  for (const uid of liveOrder) {
    if (!taken.has(uid)) {
      taken.add(uid);
      wanted.push(uid);
    }
  }

  const working = [...liveOrder];
  let songs = 0;
  let requests = 0;

  for (let at = 0; at < wanted.length; at++) {
    if (working[at] === wanted[at]) continue;
    const from = working.indexOf(wanted[at]);
    if (from < 0) continue;

    let length = 1;
    while (
      at + length < wanted.length &&
      from + length < working.length &&
      working[from + length] === wanted[at + length]
    ) {
      length++;
    }

    working.splice(at, 0, ...working.splice(from, length));
    songs += length;
    requests++;
    at += length - 1;
  }

  return { songs, requests };
}

/**
 * What is measurably true about this order.
 *
 * Deliberately not the cost terms read back. The old scorecard's five judged
 * numbers were the five cost terms wearing a hat, so a bland order scored well
 * by construction and the notes advised turning up a knob that was multiplied by
 * zero. These are measurements a person can check against the list in front of
 * them, several of which the objective is not directly minimising.
 */
export function score(
  run: Sequenced,
  sides: Side[],
  liveOrder: string[],
  shape: Shape,
  artistRunFloor = 2
): Scorecard {
  const order = run.order.filter((track) => track.unavailable === false);
  const n = order.length;
  const gone = run.order.length - n;

  // The same distance the ordering was judged on, so "5% closer than average"
  // means what the "what counts as alike" slider says it means. This is still a
  // measurement rather than a cost term read back — the objective hinges on the
  // ratio through a band and is pulled fifteen other ways at the same time.
  const gap = (a: SeqInternal, b: SeqInternal): number | null => {
    const i = run.slot.get(a.uid);
    const j = run.slot.get(b.uid);
    if (i === undefined || j === undefined) return null;
    return run.distance.m[i * run.distance.n + j];
  };

  const steps: number[] = [];
  for (let i = 0; i + 1 < n; i++) {
    const value = gap(order[i], order[i + 1]);
    if (value !== null) steps.push(value);
  }
  const every: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const value = gap(order[i], order[j]);
      if (value !== null) every.push(value);
    }
  }
  every.sort((a, b) => a - b);
  const adjacency =
    steps.length >= 3 && every.length >= 3 && mean(every) > 1e-9
      ? Math.round((mean(steps) / mean(every)) * 100)
      : null;
  const abruptAbove = every.length ? quantile(every, 0.9) : Infinity;
  const abrupt = steps.filter((value) => value > abruptAbove).length;

  const arousal = order.map((track) => track.arousal).filter((v): v is number => v !== null);
  let flips = 0;
  let run_ = 1;
  let longestRun = 1;
  let previous = 0;
  for (let i = 0; i + 1 < arousal.length; i++) {
    const sign = arousal[i + 1] > arousal[i] ? 1 : -1;
    if (i > 0) {
      if (sign !== previous) {
        flips++;
        longestRun = Math.max(longestRun, run_);
        run_ = 1;
      } else run_++;
    }
    previous = sign;
  }
  longestRun = Math.max(longestRun, run_);
  const alternation = arousal.length > 3 ? Math.round((flips / (arousal.length - 2)) * 100) : null;

  let artistClumps = 0;
  let artistTriples = 0;
  for (let i = 1; i < n; i++) {
    if (order[i].artistId && order[i].artistId === order[i - 1].artistId) {
      artistClumps++;
      if (i > 1 && order[i - 1].artistId === order[i - 2].artistId) artistTriples++;
    }
  }

  // A run of one language is only a slab when nothing says so. A side the
  // sequencer gathered and then named "in Chinese" is the structure working: the
  // listener gets an hour of it and the label says exactly that. Runs inside a
  // side named for their own language are not counted.
  const dominant = mode(order.map((track) => track.language).filter(Boolean) as string[]);
  const declared = new Map<string, string | null>();
  for (const side of sides) {
    const named = /^in (.+)$/.exec(side.label);
    for (const uid of side.uids) declared.set(uid, named ? named[1] : null);
  }
  let slab = 1;
  let languageSlab = 1;
  for (let i = 1; i < n; i++) {
    const language = order[i].language;
    const continues =
      language && language !== dominant?.value && language === order[i - 1].language;
    slab = continues ? slab + 1 : 1;
    if (continues && declared.get(order[i].uid) === language) continue;
    languageSlab = Math.max(languageSlab, slab);
  }

  const strangers = order.filter((track) => track.stranger);
  let unanchored = 0;
  let strangerPairs = 0;
  for (let i = 0; i < n; i++) {
    if (!order[i].stranger) continue;
    const left = i > 0 && order[i - 1].anchor;
    const right = i + 1 < n && order[i + 1].anchor;
    if (!left && !right) unanchored++;
    if (i + 1 < n && order[i + 1].stranger) strangerPairs++;
  }

  const thirdOf = (values: SeqInternal[]): [number, number, number] => {
    const size = values.length;
    return [0, 1, 2].map((k) => {
      const window = values.slice(
        Math.floor((k * size) / 3),
        Math.floor(((k + 1) * size) / 3)
      );
      return window.length
        ? Math.round((window.filter((track) => track.stranger).length / window.length) * 100)
        : 0;
    }) as [number, number, number];
  };
  const bySide: [number, number, number] = [0, 1, 2].map((k) => {
    let count = 0;
    let total = 0;
    for (const side of run.sides) {
      const size = side.tracks.length;
      for (let i = Math.floor((k * size) / 3); i < Math.floor(((k + 1) * size) / 3); i++) {
        total++;
        if (side.tracks[i].stranger) count++;
      }
    }
    return total ? Math.round((count / total) * 100) : 0;
  }) as [number, number, number];

  const { songs, requests } = movesNeeded(
    liveOrder,
    run.order.map((track) => track.uid)
  );

  const real = sides.filter((side) => side.id !== "gone");

  return {
    adjacency,
    alternation,
    longestRun,
    restlessSides: real.filter((side) => side.restless).length,
    sideCount: real.length,
    abrupt,
    artistClumps,
    artistTriples,
    artistRunFloor,
    languageSlab,
    discovery: strangers.length >= 3 ? bySide : null,
    discoveryRun: strangers.length >= 3 ? thirdOf(order) : null,
    unanchored,
    strangerPairs,
    strangers: strangers.length,
    moves: songs,
    requests,
    gone,
    heard: order.filter((track) => track.heard).length,
    read: order.filter((track) => track.read).length,
    felt: order.filter((track) => track.felt).length,
    suspended: run.suspended,
  };
}

function buildNotes(run: Sequenced, sides: Side[], card: Scorecard, shape: Shape): string[] {
  const notes: string[] = [];
  const order = run.order.filter((track) => !track.unavailable);
  const opener = order[0];
  const real = sides.filter((side) => side.id !== "gone");

  if (opener) {
    const why = opener.anchor
      ? "one most people will know"
      : opener.opensWell
        ? "the voice is in early"
        : "nothing here opened cleanly, so this is the best of a bad set";
    notes.push(`Opens on ${opener.title} — ${why}.`);
  }

  if (real.length > 1) {
    notes.push(
      `${real.length} sides of about ${Math.round(mean(real.map((side) => side.minutes)))} minutes. Each one is its own arc, so whenever someone gives up they have heard a whole shape.`
    );
  }

  if (card.adjacency !== null) {
    notes.push(
      card.adjacency < 80
        ? `Neighbours sit ${100 - card.adjacency}% closer than average — too smooth. Turn "movement" up.`
        : card.adjacency > 100
          ? "Neighbours are further apart than average, which will read as a shuffle. Turn \"movement\" down."
          : `Neighbours sit ${100 - card.adjacency}% closer than average, which is where real playlists sit.`
    );
  }

  const landed = real.filter((side) => side.peakAt !== null && side.peakAt >= 0.55 && side.peakAt <= 0.8);
  if (real.length && shape.arc !== "even") {
    notes.push(`${landed.length} of ${real.length} sides put their loudest moment two thirds of the way in.`);
  }

  if (card.restlessSides < card.sideCount) {
    notes.push(
      `${card.sideCount - card.restlessSides} side${card.sideCount - card.restlessSides === 1 ? " has" : "s have"} a stretch that sits still for four songs running.`
    );
  }

  if (card.discovery) {
    notes.push(
      `Across a side, the share of songs almost nobody knows runs ${card.discovery[0]}% → ${card.discovery[1]}% → ${card.discovery[2]}%.`
    );
  }
  if (card.strangers > 0) {
    notes.push(
      card.unanchored === 0
        ? `All ${card.strangers} of the unknown songs have something familiar next to them.`
        : `${card.unanchored} of ${card.strangers} unknown songs have nothing familiar beside them.`
    );
  }

  if (card.artistTriples > 0 && card.artistRunFloor <= 2) {
    notes.push(
      `${card.artistTriples} place${card.artistTriples === 1 ? "" : "s"} put the same artist three deep.`
    );
  }

  const unfelt = order.length - card.felt;
  if (unfelt > 0) {
    notes.push(`${unfelt} song${unfelt === 1 ? " has" : "s have"} never been measured — re-read the library from the desk.`);
  }

  if (card.suspended.length) {
    notes.push(`Switched off here: ${card.suspended.join("; ")}.`);
  }

  if (card.gone > 0) {
    notes.push(
      `${card.gone} song${card.gone === 1 ? " has" : "s have"} been delisted by Spotify and sit at the end.`
    );
  }

  notes.push(
    card.moves === 0
      ? "Spotify already looks like this."
      : `Applying moves ${card.moves} song${card.moves === 1 ? "" : "s"}, in ${card.requests} request${card.requests === 1 ? "" : "s"}.`
  );

  return notes;
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

function strip(track: SeqInternal): SeqTrack {
  const { texture: _texture, meaning: _meaning, density: _density, ...rest } = track;
  return rest;
}

export async function getSetlist(
  playlistId: string,
  options?: { shape?: Shape; order?: string[]; resequence?: boolean }
): Promise<Setlist> {
  const supabase = createAdminClient();
  const { meta, tracks, liveOrder, limits, offline } = await loadTracks(playlistId);

  const { data: saved } = await supabase
    .from("music_sequences")
    .select("shape, order_uids, updated_at, applied_at")
    .eq("playlist_id", playlistId)
    .maybeSingle();

  // An order saved by the engine this replaced was built on knobs that no longer
  // exist, so keeping it would attribute a dead engine's work to this one. The
  // presence of `arc` is what tells the two apart.
  const savedShape = (saved?.shape as Partial<Shape> | null) || null;
  const stale = Boolean(saved?.order_uids?.length) && !savedShape?.arc;
  const shape: Shape = {
    ...DEFAULT_SHAPE,
    ...(stale ? {} : savedShape || {}),
    ...(options?.shape || {}),
  };

  // The same playlist and the same knobs must always give the same order, so the
  // search is seeded from both and stops on a fixed count of evaluations.
  const seed = seedOf(`${playlistId}|${JSON.stringify(shape)}`);
  const byUid = new Map(tracks.map((track) => [track.uid, track]));

  let run: Sequenced;
  if (options?.order?.length) {
    const wanted = new Set(options.order);
    const held = options.order
      .map((uid) => byUid.get(uid))
      .filter((track): track is SeqInternal => Boolean(track));
    for (const track of tracks) if (!wanted.has(track.uid)) held.push(track);
    run = rebuildFrom(held, shape, limits);
  } else if (!options?.resequence && !stale && saved?.order_uids?.length) {
    const savedOrder = saved.order_uids as string[];
    const held = savedOrder
      .map((uid) => byUid.get(uid))
      .filter((track): track is SeqInternal => Boolean(track));
    const present = new Set(held.map((track) => track.uid));
    // Songs added since the last save land at the end rather than silently
    // wiping the saved order.
    for (const track of tracks) if (!present.has(track.uid)) held.push(track);
    run = rebuildFrom(held, shape, limits);
  } else {
    run = sequence(tracks, shape, limits, seed);
  }

  const sides = describeSides(run);
  const card = score(run, sides, liveOrder, shape, run.sides[0]?.bench.artistRun ?? 2);

  return {
    playlist: {
      id: playlistId,
      name: meta.name,
      imageUrl: meta.images?.[0]?.url || null,
      url: meta.external_urls?.spotify || null,
      trackCount: tracks.length,
    },
    tracks: tracks.map(strip),
    liveOrder,
    order: run.order.map((track) => track.uid),
    sides,
    shape,
    scorecard: card,
    notes: buildNotes(run, sides, card, shape),
    savedAt: (saved?.updated_at as string) || null,
    appliedAt: (saved?.applied_at as string) || null,
    lyricsPending: tracks.filter((track) => !track.unavailable && track.wordsPerMin === null).length,
    feelPending: tracks.filter((track) => !track.unavailable && !track.felt).length,
    offline,
  };
}

/**
 * Take an order someone else decided — a saved one, or one dragged by hand — and
 * cut it into sides at the same places the sequencer would, so the arc readouts
 * describe what is actually there rather than what the machine would have done.
 */
function rebuildFrom(order: SeqInternal[], shape: Shape, limits: FeelThresholds): Sequenced {
  const gone = order.filter((track) => track.unavailable);
  const live = order.filter((track) => !track.unavailable);
  const distance = buildDistance(live, shape.alike);

  // The same fitting a fresh sequence gets, so an order that was saved or
  // dragged by hand is judged by the rules this playlist can actually keep
  // rather than by the library-wide ones. Without this the scorecard would
  // report a saved order against a stricter standard than the one that built it.
  const suspended: string[] = [];
  const local = fitToPlaylist(live, limits, suspended);
  for (const track of live) {
    const familiarity = track.familiarity;
    track.stranger = familiarity !== null && familiarity < local.strangerBelow;
    track.anchor = familiarity !== null && familiarity >= local.anchorAbove;
  }

  const sizes = planSides(live, shape.sideMinutes);
  const sides: Array<{ tracks: SeqInternal[]; bench: Bench }> = [];
  let at = 0;
  let tail: number[] = [];
  for (const size of sizes) {
    const members = Array.from({ length: Math.min(size, live.length - at) }, (_, i) => at + i);
    if (members.length === 0) break;
    const bench = makeBench(members, live, distance, shape, local, tail);
    sides.push({ tracks: members.map((i) => live[i]), bench });
    tail = members.slice(-3);
    at += members.length;
  }
  return {
    order: [...live, ...gone],
    sides,
    distance,
    slot: new Map(live.map((track, i) => [track.uid, i])),
    suspended,
  };
}

export async function saveSetlist(
  playlistId: string,
  shape: Shape,
  order: string[],
  sides: Side[]
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("music_sequences").upsert(
    {
      playlist_id: playlistId,
      shape,
      order_uids: order,
      sides,
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "playlist_id" }
  );
  if (error) throw new Error(`could not save the order: ${error.message}`);
}
// Apply
// ---------------------------------------------------------------------------

/**
 * Write the order back to Spotify.
 *
 * Only ever by moving things. There was a second strategy that replaced the
 * playlist wholesale — one PUT of the first hundred URIs, then POSTs for the
 * rest — which is far fewer requests but leaves a 216-song playlist holding 100
 * songs if anything fails in between, with no record of the rest. A reorder
 * cannot lose a song no matter where it stops, so it is the only strategy now;
 * contiguous runs move in a single request, which brings the cost back down.
 *
 * Indices are Spotify's, which count EVERY item in the playlist — podcast
 * episodes and the null placeholders it returns for items it can no longer
 * resolve, not just the tracks we know about. Numbering from a filtered list
 * would silently shift every move.
 */
export async function applySetlist(
  playlistId: string,
  order: string[]
): Promise<{ moved: number; requests: number }> {
  const supabase = createAdminClient();

  // Only a shelf playlist is ours to reorder. The visitor-suggestion inbox is
  // linked from the desk like any other, and applying to it would rewrite
  // membership rows that the sorter then reads as real filings.
  const { data: playlist } = await supabase
    .from("music_playlists")
    .select("role, name")
    .eq("playlist_id", playlistId)
    .maybeSingle();
  if (playlist && playlist.role !== "shelf") {
    throw new Error(
      `"${playlist.name}" is a ${playlist.role} playlist — those aren't ordered from here.`
    );
  }

  // Never against a remembered copy: an order is written as moves between live
  // positions, and a stale index would move the wrong songs.
  forgetPlaylist(playlistId);
  const items = await fetchPlaylistTracks(playlistId);

  // One slot per playlist item. Anything that isn't a track we can identify
  // gets a slot with no uid: it holds its position and is never moved.
  const seenIds = new Map<string, number>();
  const slots = items.map((item) => {
    const id = item.track?.id;
    if (!id) return { uid: null as string | null, addedAt: item.added_at };
    const n = (seenIds.get(id) || 0) + 1;
    seenIds.set(id, n);
    return { uid: n === 1 ? id : `${id}#${n}`, addedAt: item.added_at };
  });

  const placed = new Set(slots.map((slot) => slot.uid).filter(Boolean) as string[]);
  const addedAtByUid = new Map(
    slots.filter((s) => s.uid).map((s) => [s.uid as string, s.addedAt])
  );

  // A uid may appear once. A repeat would make `indexOf` find the wrong slot
  // and desync every move after it.
  const wanted: string[] = [];
  const taken = new Set<string>();
  for (const uid of order) {
    if (!placed.has(uid) || taken.has(uid)) continue;
    taken.add(uid);
    wanted.push(uid);
  }
  for (const slot of slots) {
    if (slot.uid && !taken.has(slot.uid)) {
      taken.add(slot.uid);
      wanted.push(slot.uid);
    }
  }

  // The positions the tracks occupy, in playlist order. Everything else stays
  // exactly where it is, so we only permute within these slots.
  const trackSlots = slots
    .map((slot, index) => ({ ...slot, index }))
    .filter((slot) => slot.uid);
  const working = trackSlots.map((slot) => slot.uid as string);
  const positionOf = trackSlots.map((slot) => slot.index);

  let snapshot = (await fetchPlaylistMeta(playlistId)).snapshot_id || null;
  let moved = 0;
  let requests = 0;

  for (let at = 0; at < wanted.length; at++) {
    if (working[at] === wanted[at]) continue;
    const from = working.indexOf(wanted[at]);
    if (from < 0) continue;

    // How much of the run starting here is already in the order we want? Moving
    // it as one range costs one request instead of `length`.
    let length = 1;
    while (
      at + length < wanted.length &&
      from + length < working.length &&
      working[from + length] === wanted[at + length]
    ) {
      length++;
    }

    const response = await api<{ snapshot_id: string }>(
      `/playlists/${playlistId}/tracks`,
      {
        method: "PUT",
        body: JSON.stringify({
          range_start: positionOf[from],
          insert_before: positionOf[at],
          range_length: length,
          ...(snapshot ? { snapshot_id: snapshot } : {}),
        }),
      }
    );
    snapshot = response?.snapshot_id || snapshot;

    working.splice(at, 0, ...working.splice(from, length));
    moved += length;
    requests++;
    at += length - 1;
  }

  await supabase.from("music_sequences").upsert(
    {
      playlist_id: playlistId,
      order_uids: wanted,
      applied_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "playlist_id" }
  );

  // One membership row per track — a playlist that holds the same song twice
  // still only belongs to it once. Written before the delete so a failure here
  // can't leave the playlist looking empty, which is what the sorter reads to
  // decide "unfiled" and "adrift".
  const written = new Set<string>();
  const rows = wanted
    .map((uid, index) => ({ trackId: uid.split("#")[0], uid, index }))
    .filter(({ trackId }) => !written.has(trackId) && written.add(trackId))
    .map(({ trackId, uid, index }) => ({
      playlist_id: playlistId,
      track_id: trackId,
      position: index,
      added_at: addedAtByUid.get(uid) ?? null,
    }));

  if (rows.length > 0) {
    await supabase.from("music_playlist_tracks").delete().eq("playlist_id", playlistId);
    const { error } = await supabase.from("music_playlist_tracks").insert(rows);
    if (error) {
      throw new Error(
        `Spotify was reordered, but the local copy of "${playlistId}" could not be rewritten: ${error.message}. Re-read Spotify from the desk.`
      );
    }
  }

  // What Spotify holds is now different from what anyone read a moment ago.
  forgetPlaylist(playlistId);

  return { moved, requests };
}

