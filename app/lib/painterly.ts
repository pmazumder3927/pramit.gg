// Painterly album renderer — turns an album cover into flowing brush strokes that
// follow the cover's OWN contours, painted coarse→fine and animated on like a hand
// laying down paint. Built on three grounded techniques:
//   · placement  — Hertzmann, "Painterly Rendering with Curved Brush Strokes of
//                  Multiple Sizes" (SIGGRAPH '98): coarse→fine layers; each stroke
//                  a curved spline; one constant colour per stroke sampled from the
//                  cover; finer layers only where there's edge detail.
//   · direction  — strokes flow PERPENDICULAR to the luminance gradient (along
//                  iso-contours), via a Gaussian-smoothed structure tensor (Kang
//                  ETF / structure-tensor), blended toward a smooth global field in
//                  flat regions so backgrounds don't go noisy (Tyler Hobbs flow fields).
//   · brush      — sumi-e: tapered multi-bristle marks, low-alpha buildup, the band
//                  thins to dry at the ends. Drawn into an offscreen buffer.
// Pure DOM/canvas (no React) so a dev harness and the component share one code path.

/* ------------------------------ rng / math ----------------------------- */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0 || 1));
  return t * t * (3 - 2 * t);
};

/* ------------------------------- field --------------------------------- */
export interface Field {
  AW: number;
  AH: number;
  cos: Float32Array; // unit direction the strokes flow along (per analysis cell)
  sin: Float32Array;
  anis: Float32Array; // 0 flat … 1 strong edge (drives fine-layer placement)
  rgb: Uint8ClampedArray; // analysis colour, AW*AH*4
}

// separable Gaussian blur of a scalar Float32 buffer
function blurF32(
  src: Float32Array,
  w: number,
  h: number,
  radius: number,
): Float32Array {
  if (radius < 1) return src;
  const k: number[] = [];
  let ksum = 0;
  const sigma = radius / 2 || 1;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k.push(v);
    ksum += v;
  }
  for (let i = 0; i < k.length; i++) k[i] /= ksum;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -radius; i <= radius; i++)
        s += src[y * w + clamp(x + i, 0, w - 1)] * k[i + radius];
      tmp[y * w + x] = s;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -radius; i <= radius; i++)
        s += tmp[clamp(y + i, 0, h - 1) * w + x] * k[i + radius];
      out[y * w + x] = s;
    }
  }
  return out;
}

// Build the flow field from analysis-resolution RGBA pixels.
export function buildField(
  rgb: Uint8ClampedArray,
  AW: number,
  AH: number,
  seed: number,
): Field {
  const N = AW * AH;
  const L = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const j = i * 4;
    L[i] = 0.299 * rgb[j] + 0.587 * rgb[j + 1] + 0.114 * rgb[j + 2];
  }
  // Sobel → gradient
  const gx = new Float32Array(N);
  const gy = new Float32Array(N);
  const at = (x: number, y: number) =>
    L[clamp(y, 0, AH - 1) * AW + clamp(x, 0, AW - 1)];
  for (let y = 0; y < AH; y++) {
    for (let x = 0; x < AW; x++) {
      const i = y * AW + x;
      gx[i] =
        at(x + 1, y - 1) +
        2 * at(x + 1, y) +
        at(x + 1, y + 1) -
        at(x - 1, y - 1) -
        2 * at(x - 1, y) -
        at(x - 1, y + 1);
      gy[i] =
        at(x - 1, y + 1) +
        2 * at(x, y + 1) +
        at(x + 1, y + 1) -
        at(x - 1, y - 1) -
        2 * at(x, y - 1) -
        at(x + 1, y - 1);
    }
  }
  // structure tensor, smoothed → coherent direction + anisotropy
  const E = new Float32Array(N);
  const F = new Float32Array(N);
  const G = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    E[i] = gx[i] * gx[i];
    F[i] = gx[i] * gy[i];
    G[i] = gy[i] * gy[i];
  }
  const Eb = blurF32(E, AW, AH, 3);
  const Fb = blurF32(F, AW, AH, 3);
  const Gb = blurF32(G, AW, AH, 3);

  const rng = mulberry32(seed);
  const baseAng = rng() * TAU;
  const sa = rng() * TAU;
  const sb = rng() * TAU;

  const cos = new Float32Array(N);
  const sin = new Float32Array(N);
  const anis = new Float32Array(N);
  for (let y = 0; y < AH; y++) {
    for (let x = 0; x < AW; x++) {
      const i = y * AW + x;
      const e = Eb[i],
        f = Fb[i],
        g = Gb[i];
      // principal gradient orientation; rotate +90° → flow along the edge
      const theta = 0.5 * Math.atan2(2 * f, e - g);
      const edge = theta + Math.PI / 2;
      const d = Math.sqrt(((e - g) / 2) ** 2 + f * f);
      const tr = (e + g) / 2;
      const an = d / (tr + 1e-3); // anisotropy 0..1
      anis[i] = an;
      // smooth global field for the flat regions (no reliable edge there)
      const gAng =
        baseAng +
        0.8 * Math.sin((x / AW) * TAU * 1.4 + sa) +
        0.6 * Math.sin((y / AH) * TAU * 1.1 + sb);
      const w = smoothstep(0.015, 0.16, an);
      const cx = lerp(Math.cos(gAng), Math.cos(edge), w);
      const cy = lerp(Math.sin(gAng), Math.sin(edge), w);
      const l = Math.hypot(cx, cy) || 1;
      cos[i] = cx / l;
      sin[i] = cy / l;
    }
  }
  return { AW, AH, cos, sin, anis, rgb };
}

// bilinear field direction at analysis coords (interpolate the VECTOR, not the angle)
function fieldDir(field: Field, ax: number, ay: number): [number, number] {
  const { AW, AH, cos, sin } = field;
  const x = clamp(ax, 0, AW - 1.001);
  const y = clamp(ay, 0, AH - 1.001);
  const ix = x | 0,
    iy = y | 0;
  const fx = x - ix,
    fy = y - iy;
  const i00 = iy * AW + ix,
    i10 = i00 + 1,
    i01 = i00 + AW,
    i11 = i01 + 1;
  const cx =
    cos[i00] * (1 - fx) * (1 - fy) +
    cos[i10] * fx * (1 - fy) +
    cos[i01] * (1 - fx) * fy +
    cos[i11] * fx * fy;
  const cy =
    sin[i00] * (1 - fx) * (1 - fy) +
    sin[i10] * fx * (1 - fy) +
    sin[i01] * (1 - fx) * fy +
    sin[i11] * fx * fy;
  const l = Math.hypot(cx, cy) || 1;
  return [cx / l, cy / l];
}
const colorAt = (
  field: Field,
  ax: number,
  ay: number,
): [number, number, number] => {
  const x = clamp(ax | 0, 0, field.AW - 1);
  const y = clamp(ay | 0, 0, field.AH - 1);
  const j = (y * field.AW + x) * 4;
  return [field.rgb[j], field.rgb[j + 1], field.rgb[j + 2]];
};
const anisAt = (field: Field, ax: number, ay: number): number => {
  const x = clamp(ax | 0, 0, field.AW - 1);
  const y = clamp(ay | 0, 0, field.AH - 1);
  return field.anis[y * field.AW + x];
};

/* ------------------------------ strokes -------------------------------- */
export interface Bristle {
  pts: number[]; // flat x,y,x,y…
  w: number;
  color: string;
}
export interface Stroke {
  bristles: Bristle[];
  start: number; // s
  dur: number; // s
}
export interface Painting {
  strokes: Stroke[]; // sorted by start
  paintDur: number; // s to fully paint
  w: number; // css px
  h: number;
}

interface LayerSpec {
  R: number;
  dsep: number;
  maxSteps: number;
  alpha: number;
  edgeMin: number; // place strokes only where anisotropy ≥ this (fine layers)
  win0: number;
  win1: number; // paint-time window (s)
}

export interface PaintOptions {
  dark?: boolean;
  seed?: number;
  speed?: number; // px/s the brush travels (→ stroke duration)
  hold?: number;
  fade?: number;
  maxStrokes?: number;
}

const colDist = (a: number[], b: number[]) =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

// grow one curved centreline through the field, both directions from the seed
function growCenterline(
  field: Field,
  scale: number,
  w: number,
  h: number,
  sx: number,
  sy: number,
  maxSteps: number,
  step: number,
  colorThresh: number,
): number[] {
  const seedCol = colorAt(field, sx / scale, sy / scale);
  const walk = (sign: number): number[] => {
    const out: number[] = [];
    let x = sx,
      y = sy,
      pdx = 0,
      pdy = 0,
      has = false;
    for (let i = 0; i < maxSteps; i++) {
      if (x < -step || y < -step || x > w + step || y > h + step) break;
      let [dx, dy] = fieldDir(field, x / scale, y / scale);
      if (sign < 0) {
        dx = -dx;
        dy = -dy;
      }
      if (has && dx * pdx + dy * pdy < 0) {
        dx = -dx;
        dy = -dy;
      } // no 180° flips
      if (has) {
        dx = 0.55 * dx + 0.45 * pdx;
        dy = 0.55 * dy + 0.45 * pdy;
        const l = Math.hypot(dx, dy) || 1;
        dx /= l;
        dy /= l;
      }
      const nx = x + dx * step,
        ny = y + dy * step;
      if (
        i > 0 &&
        colDist(colorAt(field, nx / scale, ny / scale), seedCol) > colorThresh
      )
        break;
      out.push(nx, ny);
      x = nx;
      y = ny;
      pdx = dx;
      pdy = dy;
      has = true;
    }
    return out;
  };
  const fwd = walk(1);
  const bwd = walk(-1);
  const line: number[] = [];
  for (let i = bwd.length - 2; i >= 0; i -= 2) {
    line.push(bwd[i], bwd[i + 1]);
  }
  line.push(sx, sy);
  for (let i = 0; i < fwd.length; i += 2) {
    line.push(fwd[i], fwd[i + 1]);
  }
  return line;
}

// occupancy grid (cell = dsep) → even-ish seed spacing per layer
function makeOccupancy(dsep: number) {
  const set = new Set<number>();
  const key = (cx: number, cy: number) => cx * 100003 + cy;
  return {
    taken(x: number, y: number): boolean {
      const cx = Math.floor(x / dsep),
        cy = Math.floor(y / dsep);
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          if (set.has(key(cx + dx, cy + dy))) return true;
      return false;
    },
    add(x: number, y: number) {
      set.add(key(Math.floor(x / dsep), Math.floor(y / dsep)));
    },
  };
}

// ink the cover's colour a touch toward its own value so it reads as pigment, not print
function inkColor(
  rgb: number[],
  dark: boolean,
  jit: number,
): [number, number, number] {
  const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  const ease = dark ? 0.16 : 0.12;
  let r = lerp(rgb[0], lum, ease) + jit;
  let g = lerp(rgb[1], lum, ease) + jit;
  let b = lerp(rgb[2], lum, ease) + jit;
  if (dark) {
    r = lerp(r, 255, 0.05);
    g = lerp(g, 255, 0.05);
    b = lerp(b, 255, 0.05);
  }
  return [clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)];
}

// turn a centreline into a tapered multi-bristle sumi mark
function buildBristles(
  line: number[],
  R: number,
  baseColor: number[],
  alpha: number,
  dark: boolean,
  rng: () => number,
): Bristle[] {
  const N = line.length / 2;
  if (N < 2) return [];
  // per-point normals from the local tangent
  const nx = new Float32Array(N);
  const ny = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = Math.max(0, i - 1),
      b = Math.min(N - 1, i + 1);
    const tx = line[b * 2] - line[a * 2];
    const ty = line[b * 2 + 1] - line[a * 2 + 1];
    const l = Math.hypot(tx, ty) || 1;
    nx[i] = -ty / l;
    ny[i] = tx / l;
  }
  const nB = clamp(Math.round(R / 13), 2, 6);
  const spread = R * 1.35;
  const bw = Math.max(1.1, R * 0.2);
  const prof = (t: number) => Math.pow(Math.sin(Math.PI * clamp01(t)), 0.45); // thin→fat→thin band
  const bristles: Bristle[] = [];
  for (let k = 0; k < nB; k++) {
    const off = (nB === 1 ? 0 : k / (nB - 1) - 0.5) * spread;
    const central = Math.abs(off) < spread * 0.22;
    // outer bristles run dry early → ragged, tapered tip
    const endFrac = central
      ? 1
      : 1 - (Math.abs(off) / (spread / 2)) * (0.25 + rng() * 0.3);
    const cnt = Math.max(2, Math.floor(N * endFrac));
    const jit = (rng() - 0.5) * (dark ? 16 : 22);
    const col = inkColor(baseColor, dark, jit);
    const a = alpha * (central ? 1 : 0.78);
    const pts: number[] = [];
    for (let i = 0; i < cnt; i++) {
      const t = i / (N - 1);
      const o = off * prof(t);
      pts.push(line[i * 2] + nx[i] * o, line[i * 2 + 1] + ny[i] * o);
    }
    bristles.push({
      pts,
      w: bw * (central ? 1.15 : 0.85),
      color: `rgba(${Math.round(col[0])},${Math.round(col[1])},${Math.round(col[2])},${a.toFixed(3)})`,
    });
  }
  return bristles;
}

/* --------------------------- plan a painting --------------------------- */
// rgb = analysis RGBA at AW×AH (cover already cropped to the frame's aspect).
export function planPainting(
  rgb: Uint8ClampedArray,
  AW: number,
  AH: number,
  w: number,
  h: number,
  opts: PaintOptions = {},
): Painting {
  const dark = !!opts.dark;
  const seed = opts.seed ?? 1;
  const speed = opts.speed ?? 900;
  const maxStrokes = opts.maxStrokes ?? 2600;
  const field = buildField(rgb, AW, AH, seed);
  const scale = w / AW;
  const rng = mulberry32(seed ^ 0x9e3779b9);

  // seeded sweep corner → paint travels corner-to-corner
  const sxCorner = rng() < 0.5 ? 0 : 1;
  const syCorner = rng() < 0.5 ? 0 : 1;

  const unit = Math.min(w, h);
  const layers: LayerSpec[] = [
    {
      R: unit * 0.01,
      dsep: unit * 0.045,
      maxSteps: 16,
      alpha: dark ? 0.26 : 0.3,
      edgeMin: 0,
      win0: 0.0,
      win1: 1.5,
    },
    {
      R: unit * 0.03,
      dsep: unit * 0.024,
      maxSteps: 20,
      alpha: dark ? 0.24 : 0.27,
      edgeMin: 0,
      win0: 0.95,
      win1: 2.35,
    },
    {
      R: unit * 0.09,
      dsep: unit * 0.013,
      maxSteps: 14,
      alpha: dark ? 0.3 : 0.34,
      edgeMin: 0.07,
      win0: 1.8,
      win1: 3.0,
    },
  ];

  const strokes: Stroke[] = [];
  for (let li = 0; li < layers.length && strokes.length < maxStrokes; li++) {
    const L = layers[li];
    const step = L.R * 0.55;
    const colorThresh = 70;
    const occ = makeOccupancy(L.dsep);
    // jittered seed grid, shuffled
    const seeds: [number, number][] = [];
    for (let y = L.dsep * 0.5; y < h; y += L.dsep)
      for (let x = L.dsep * 0.5; x < w; x += L.dsep)
        seeds.push([
          x + (rng() - 0.5) * L.dsep * 0.7,
          y + (rng() - 0.5) * L.dsep * 0.7,
        ]);
    for (let i = seeds.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      [seeds[i], seeds[j]] = [seeds[j], seeds[i]];
    }
    for (const [sxp, syp] of seeds) {
      if (strokes.length >= maxStrokes) break;
      if (sxp < 0 || syp < 0 || sxp > w || syp > h) continue;
      if (occ.taken(sxp, syp)) continue;
      if (L.edgeMin > 0 && anisAt(field, sxp / scale, syp / scale) < L.edgeMin)
        continue;
      const line = growCenterline(
        field,
        scale,
        w,
        h,
        sxp,
        syp,
        L.maxSteps,
        step,
        colorThresh,
      );
      const N = line.length / 2;
      if (N < 2) continue;
      // length + centroid, register occupancy along the line
      let len = 0;
      for (let p = 1; p < N; p++) {
        len += Math.hypot(
          line[p * 2] - line[(p - 1) * 2],
          line[p * 2 + 1] - line[(p - 1) * 2 + 1],
        );
        occ.add(line[p * 2], line[p * 2 + 1]);
      }
      occ.add(sxp, syp);
      const mid = (N >> 1) * 2;
      const cxN = line[mid] / w;
      const cyN = line[mid + 1] / h;
      const seedCol = colorAt(field, sxp / scale, syp / scale);
      const bristles = buildBristles(line, L.R, seedCol, L.alpha, dark, rng);
      if (!bristles.length) continue;
      const sweep =
        ((sxCorner ? 1 - cxN : cxN) + (syCorner ? 1 - cyN : cyN)) / 2;
      const start = L.win0 + sweep * (L.win1 - L.win0) + rng() * 0.06;
      const dur = clamp(len / speed, 0.26, 0.95);
      strokes.push({ bristles, start, dur });
    }
  }

  strokes.sort((a, b) => a.start - b.start);
  let paintDur = 0;
  for (const s of strokes) paintDur = Math.max(paintDur, s.start + s.dur);
  return { strokes, paintDur, w, h };
}

/* ------------------------------ animate -------------------------------- */
function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, p: number) {
  for (const b of s.bristles) {
    const n = b.pts.length / 2;
    if (n < 2) continue;
    const cnt = p >= 1 ? n : Math.max(2, Math.ceil(p * n));
    ctx.strokeStyle = b.color;
    ctx.lineWidth = b.w;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(b.pts[0], b.pts[1]);
    // quadratic smoothing through midpoints → organic curve
    for (let i = 1; i < cnt - 1; i++) {
      const xc = (b.pts[i * 2] + b.pts[(i + 1) * 2]) / 2;
      const yc = (b.pts[i * 2 + 1] + b.pts[(i + 1) * 2 + 1]) / 2;
      ctx.quadraticCurveTo(b.pts[i * 2], b.pts[i * 2 + 1], xc, yc);
    }
    ctx.lineTo(b.pts[(cnt - 1) * 2], b.pts[(cnt - 1) * 2 + 1]);
    ctx.stroke();
  }
}

export interface PaintController {
  cancel: () => void;
}

// Animate the painting onto an already-dpr-scaled 2D context. Completed strokes
// accumulate in an offscreen "dry" buffer; only the wet front is redrawn per frame.
export function animatePainting(
  ctx: CanvasRenderingContext2D,
  painting: Painting,
  dpr: number,
  now: () => number,
  onDone: () => void,
): PaintController {
  const { w, h, strokes } = painting;
  const dry = document.createElement("canvas");
  dry.width = Math.max(1, Math.round(w * dpr));
  dry.height = Math.max(1, Math.round(h * dpr));
  const dctx = dry.getContext("2d")!;
  dctx.scale(dpr, dpr);

  let raf = 0;
  let t0 = -1;
  let idx = 0;
  let active: Stroke[] = [];
  let cancelled = false;

  const frame = () => {
    if (cancelled) return;
    const tn = now();
    if (t0 < 0) t0 = tn;
    const t = (tn - t0) / 1000;

    while (idx < strokes.length && strokes[idx].start <= t)
      active.push(strokes[idx++]);
    if (active.length) {
      const still: Stroke[] = [];
      for (const s of active) {
        if (t >= s.start + s.dur)
          drawStroke(dctx, s, 1); // finished → bake into dry
        else still.push(s);
      }
      active = still;
    }

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(dry, 0, 0, w, h);
    for (const s of active) drawStroke(ctx, s, (t - s.start) / s.dur);

    if (idx >= strokes.length && active.length === 0) {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(dry, 0, 0, w, h);
      onDone();
      return;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return {
    cancel: () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    },
  };
}

/* --------------------------- image → analysis -------------------------- */
// Draw the (square) cover cropped to the frame aspect at analysis resolution, and
// return its RGBA + dims. Returns null if the pixels can't be read (CORS).
export function analyzeCover(
  img: CanvasImageSource,
  imgW: number,
  imgH: number,
  frameW: number,
  frameH: number,
  longSide = 240,
): { rgb: Uint8ClampedArray; AW: number; AH: number } | null {
  const aspect = frameW / frameH;
  let AW: number, AH: number;
  if (aspect >= 1) {
    AW = longSide;
    AH = Math.max(1, Math.round(longSide / aspect));
  } else {
    AH = longSide;
    AW = Math.max(1, Math.round(longSide * aspect));
  }
  const c = document.createElement("canvas");
  c.width = AW;
  c.height = AH;
  const cx = c.getContext("2d", { willReadFrequently: true });
  if (!cx) return null;
  // cover-fit the square source into AW×AH (crop overflow, no distortion)
  const s = Math.max(AW / imgW, AH / imgH);
  const dw = imgW * s,
    dh = imgH * s;
  cx.drawImage(img, (AW - dw) / 2, (AH - dh) / 2, dw, dh);
  try {
    const rgb = cx.getImageData(0, 0, AW, AH).data;
    return { rgb, AW, AH };
  } catch {
    return null;
  }
}
