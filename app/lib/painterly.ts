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

// Build the flow field from analysis-resolution RGBA pixels. Generator so the
// sliced planner can breathe between the analysis stages (Sobel, the three
// tensor blurs, the field resolve each cost a few ms); buildField below drains
// it for synchronous callers.
function* buildFieldGen(
  rgb: Uint8ClampedArray,
  AW: number,
  AH: number,
  seed: number,
): Generator<void, Field, void> {
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
  yield;
  const Eb = blurF32(E, AW, AH, 3);
  yield;
  const Fb = blurF32(F, AW, AH, 3);
  yield;
  const Gb = blurF32(G, AW, AH, 3);
  yield;

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

export function buildField(
  rgb: Uint8ClampedArray,
  AW: number,
  AH: number,
  seed: number,
): Field {
  const g = buildFieldGen(rgb, AW, AH, seed);
  let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
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

export interface AvoidBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface PaintOptions {
  dark?: boolean;
  seed?: number;
  speed?: number; // px/s the brush travels (→ stroke duration)
  hold?: number;
  fade?: number;
  maxStrokes?: number;
  /** rects (canvas css px) the paint flows AROUND — the page's readable
   *  content. Strokes never seed inside them and deflect along their edges. */
  avoid?: AvoidBox[];
}

/* ----------------------------- obstacles ------------------------------- */
// The avoid rects, inflated by a margin and rasterized into a coarse cell mask
// for O(1) hit tests along stroke growth. On a hit the containing box supplies
// an edge tangent, so a stroke SLIDES along the content's border instead of
// stopping dead — the paint squiggles around the words rather than leaving
// stamped-out rectangles.
function makeObstacles(boxes: AvoidBox[], w: number, h: number, margin: number) {
  const cell = 8;
  const gw = Math.max(1, Math.ceil(w / cell));
  const gh = Math.max(1, Math.ceil(h / cell));
  const mask = new Uint8Array(gw * gh);
  const inflated = boxes.map((b) => ({
    x0: b.x0 - margin,
    y0: b.y0 - margin,
    x1: b.x1 + margin,
    y1: b.y1 + margin,
  }));
  for (const b of inflated) {
    if (b.x1 < 0 || b.y1 < 0 || b.x0 > w || b.y0 > h) continue;
    const cx0 = clamp(Math.floor(b.x0 / cell), 0, gw - 1);
    const cy0 = clamp(Math.floor(b.y0 / cell), 0, gh - 1);
    const cx1 = clamp(Math.ceil(b.x1 / cell), 0, gw - 1);
    const cy1 = clamp(Math.ceil(b.y1 / cell), 0, gh - 1);
    for (let cy = cy0; cy <= cy1; cy++)
      mask.fill(1, cy * gw + cx0, cy * gw + cx1 + 1);
  }
  return {
    hit(x: number, y: number): boolean {
      // clamp INTO the grid rather than treating off-canvas as clear — strokes
      // may run slightly off-screen, and content boxes touching a screen edge
      // inflate past it; bailing here let those strokes sail through the words
      const cx = clamp((x / cell) | 0, 0, gw - 1);
      const cy = clamp((y / cell) | 0, 0, gh - 1);
      return mask[cy * gw + cx] === 1;
    },
    // direction to continue with when (x,y) landed inside content: the tangent
    // of the containing box's nearest edge, oriented with the heading and eased
    // a touch outward so the stroke skims the boundary. Null when not resolvable.
    slide(x: number, y: number, dx: number, dy: number): [number, number] | null {
      for (const b of inflated) {
        if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) continue;
        const dl = x - b.x0,
          dr = b.x1 - x,
          dt = y - b.y0,
          db = b.y1 - y;
        const m = Math.min(dl, dr, dt, db);
        const n: [number, number] =
          m === dl ? [-1, 0] : m === dr ? [1, 0] : m === dt ? [0, -1] : [0, 1];
        const s = -n[1] * dx + n[0] * dy >= 0 ? 1 : -1; // tangent that keeps the heading
        const tx = -n[1] * s + n[0] * 0.35;
        const ty = n[0] * s + n[1] * 0.35;
        const l = Math.hypot(tx, ty) || 1;
        return [tx / l, ty / l];
      }
      return null;
    },
  };
}
type Obstacles = ReturnType<typeof makeObstacles>;

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
  obstacles?: Obstacles | null,
  jx = 0, // per-stroke wobble of the content boundary (jitters the sample
  jy = 0, // point, so the avoided edge reads hand-rough, not ruled)
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
      let nx = x + dx * step,
        ny = y + dy * step;
      // about to run into the page's content → slide along its edge instead;
      // give up (end the stroke) only when cornered
      if (obstacles && obstacles.hit(nx + jx, ny + jy)) {
        const t = obstacles.slide(nx + jx, ny + jy, dx, dy);
        if (!t) break;
        dx = t[0];
        dy = t[1];
        nx = x + dx * step;
        ny = y + dy * step;
        if (obstacles.hit(nx + jx, ny + jy)) break;
      }
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
  } else {
    // deepen the pigment so the multiply blend leaves real body on the cream
    // paper — bright/pastel covers otherwise multiply to almost nothing.
    // proportional scale keeps the hue and just lowers the value.
    r *= 0.84;
    g *= 0.84;
    b *= 0.84;
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
// The planner core is a generator: it yields at cheap checkpoints (between
// layers and every batch of seeds) so callers choose their scheduling.
// planPainting drains it synchronously (dev harness); planPaintingAsync slices
// it across frames so a song change never blocks the main thread mid-frame.
function* planPaintingGen(
  rgb: Uint8ClampedArray,
  AW: number,
  AH: number,
  w: number,
  h: number,
  opts: PaintOptions = {},
): Generator<void, Painting, void> {
  const dark = !!opts.dark;
  const seed = opts.seed ?? 1;
  const speed = opts.speed ?? 900;
  const maxStrokes = opts.maxStrokes ?? 2600;
  // drain the field analysis, yielding at each of its stage boundaries
  // (manual loop — `yield*` needs a newer TS target than this project's)
  const fieldGen = buildFieldGen(rgb, AW, AH, seed);
  let fieldStep = fieldGen.next();
  while (!fieldStep.done) {
    yield;
    fieldStep = fieldGen.next();
  }
  const field = fieldStep.value;
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

  // Content avoidance is deliberately LOOSE — the painting must still read as
  // the cover, with the strokes only ROUGHLY parting around the words. Small
  // clearance (a thin halo, capped so wide brushes' bodies still swing over
  // the text edges), and only MOST strokes dodge: the rest paint straight
  // through, so the cover's forms persist across the text column instead of
  // leaving it a blank hole.
  //
  // The exception is CONTRAST-AWARE: a stroke over the words only hurts when
  // its pigment sits near the text ink (dark paint under dark type by day,
  // pale paint under pale type by night — that's when the page went
  // unreadable until the wash dried). Each stroke knows its colour before it
  // paints, so ink-like strokes dodge almost always and with a clearance wide
  // enough for their whole bristle fan, while far-from-ink strokes cross
  // freely — they physically can't cost legibility, and they're what keeps
  // the cover alive across the text column.
  const AVOID_PAD = 5;
  const avoid = opts.avoid && opts.avoid.length ? opts.avoid : null;

  const strokes: Stroke[] = [];
  for (let li = 0; li < layers.length && strokes.length < maxStrokes; li++) {
    const L = layers[li];
    const step = L.R * 0.55;
    const colorThresh = 70;
    // two clearances: the thin halo for harmless strokes (bodies graze the
    // words — the rough look), and a fan-wide one for ink-like strokes so
    // none of their bristles can land on the type
    const obstNear = avoid
      ? makeObstacles(avoid, w, h, Math.min(20, AVOID_PAD + L.R * 0.3))
      : null;
    // fan reach = spread/2 ≈ R·0.675, plus the ±9px boundary jitter — the
    // margin must cover both or ink-like bristles still graze the type
    const obstFar = avoid
      ? makeObstacles(avoid, w, h, Math.min(70, 8 + L.R * 0.7))
      : null;
    // fine strokes are the visible squiggle and dodge most; broad strokes
    // carry the cover's forms and cross more often
    const dodgeP = L.R > unit * 0.05 ? 0.62 : 0.9;
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
    let sinceYield = 0;
    for (const [sxp, syp] of seeds) {
      if (strokes.length >= maxStrokes) break;
      if (++sinceYield >= 48) {
        sinceYield = 0;
        yield;
      }
      if (sxp < 0 || syp < 0 || sxp > w || syp > h) continue;
      if (occ.taken(sxp, syp)) continue;
      if (L.edgeMin > 0 && anisAt(field, sxp / scale, syp / scale) < L.edgeMin)
        continue;
      const seedCol = colorAt(field, sxp / scale, syp / scale);
      // per-stroke: does this one dodge the words, and with what boundary
      // wobble? Ink-likeness raises the odds to a certainty and widens the
      // clearance to the full bristle fan. (the rng draws happen only on the
      // avoiding path, so a plan with no avoid rects stays bit-identical)
      let obst: Obstacles | null = null;
      let jx = 0;
      let jy = 0;
      if (obstNear) {
        const Y = 0.299 * seedCol[0] + 0.587 * seedCol[1] + 0.114 * seedCol[2];
        // how close this pigment sits to the text ink: dark ink by day,
        // pale ink by night (ramps chosen so multiply/screen buildup under a
        // few overlapping strokes keeps the type at a readable contrast; they
        // saturate to certainty well before the genuinely harmful range)
        const inkLike = dark ? smoothstep(115, 200, Y) : 1 - smoothstep(100, 190, Y);
        const dodge = rng() < dodgeP + (1 - dodgeP) * inkLike;
        jx = (rng() - 0.5) * 18;
        jy = (rng() - 0.5) * 18;
        if (dodge) obst = inkLike >= 0.5 ? obstFar : obstNear;
      }
      if (obst && obst.hit(sxp + jx, syp + jy)) continue;
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
        obst,
        jx,
        jy,
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

// Drain the planner in one go. Identical output to the async path (same seed →
// same painting); used by the dev harness where a blocking plan is fine.
export function planPainting(
  rgb: Uint8ClampedArray,
  AW: number,
  AH: number,
  w: number,
  h: number,
  opts: PaintOptions = {},
): Painting {
  const g = planPaintingGen(rgb, AW, AH, w, h, opts);
  let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}

// Run the planner in frame-budgeted slices (~budgetMs of work per frame) so
// the plan never stalls a frame. Resolves null if cancelled mid-plan.
export function planPaintingAsync(
  rgb: Uint8ClampedArray,
  AW: number,
  AH: number,
  w: number,
  h: number,
  opts: PaintOptions = {},
  budgetMs = 6,
): { promise: Promise<Painting | null>; cancel: () => void } {
  const g = planPaintingGen(rgb, AW, AH, w, h, opts);
  let cancelled = false;
  const promise = new Promise<Painting | null>((resolve) => {
    const slice = () => {
      if (cancelled) {
        resolve(null);
        return;
      }
      const t0 = performance.now();
      let r = g.next();
      while (!r.done && performance.now() - t0 < budgetMs) r = g.next();
      if (r.done) resolve(r.value);
      else requestAnimationFrame(slice);
    };
    requestAnimationFrame(slice);
  });
  return {
    promise,
    cancel: () => {
      cancelled = true;
    },
  };
}

/* ------------------------------ animate -------------------------------- */
// (caller sets the constant lineCap/lineJoin once — not per bristle)
function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, p: number) {
  for (const b of s.bristles) {
    const n = b.pts.length / 2;
    if (n < 2) continue;
    const cnt = p >= 1 ? n : Math.max(2, Math.ceil(p * n));
    ctx.strokeStyle = b.color;
    ctx.lineWidth = b.w;
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
  // constant stroke state, set once instead of per bristle
  dctx.lineCap = ctx.lineCap = "round";
  dctx.lineJoin = ctx.lineJoin = "round";

  let raf = 0;
  let t0 = -1;
  let idx = 0;
  let active: Stroke[] = [];
  let cancelled = false;
  let prevT = -1;
  let slow = 0; // consecutive over-budget frames
  let wasWet = false; // did the LAST frame leave wet strokes on the canvas?

  const frame = () => {
    if (cancelled) return;
    const tn = now();
    if (t0 < 0) t0 = tn;
    const t = (tn - t0) / 1000;

    // Watch the real frame cadence. When frames run long two in a row, bake the
    // oldest wet strokes early (they complete instantly instead of finishing
    // their last fraction) — invisible among hundreds of marks, and it sheds
    // exactly the per-frame redraw work that was causing the stutter. Never
    // triggers while the machine keeps up.
    if (prevT >= 0 && tn - prevT > 28) slow++;
    else slow = Math.max(0, slow - 1);
    prevT = tn;
    if (slow >= 2 && active.length > 24) {
      const shed = Math.ceil(active.length * 0.15);
      for (let i = 0; i < shed; i++) drawStroke(dctx, active[i], 1);
      active.splice(0, shed);
      slow = 0;
    }

    let baked = false;
    while (idx < strokes.length && strokes[idx].start <= t)
      active.push(strokes[idx++]);
    if (active.length) {
      const still: Stroke[] = [];
      for (const s of active) {
        if (t >= s.start + s.dur) {
          drawStroke(dctx, s, 1); // finished → bake into dry
          baked = true;
        } else still.push(s);
      }
      active = still;
    }

    // Repaint only when something moved: wet strokes advanced, a stroke baked,
    // or wet marks from last frame need replacing with their dry state.
    if (active.length || baked || wasWet) {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(dry, 0, 0, w, h);
      for (const s of active) drawStroke(ctx, s, (t - s.start) / s.dur);
    }
    wasWet = active.length > 0;

    if (idx >= strokes.length && active.length === 0) {
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
