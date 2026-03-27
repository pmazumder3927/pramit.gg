import type { Noise2D, Rgb } from "./types";

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function mix(a: number, b: number, amount: number) {
  return a + (b - a) * amount;
}

export function mixColor(a: Rgb, b: Rgb, amount: number): Rgb {
  return [
    mix(a[0], b[0], amount),
    mix(a[1], b[1], amount),
    mix(a[2], b[2], amount),
  ];
}

export function rgba(color: Rgb, alpha: number) {
  return `rgba(${Math.round(color[0])}, ${Math.round(color[1])}, ${Math.round(color[2])}, ${alpha})`;
}

export function hexToRgb(hex: string, fallback: Rgb): Rgb {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return fallback;

  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ];
}

export function hashString(value: string) {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function createRng(seed: number) {
  let state = seed >>> 0 || 1;

  return function randomValue() {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function chance(randomValue: () => number, threshold: number) {
  return randomValue() < threshold;
}

export function pick<T>(randomValue: () => number, items: readonly T[]): T {
  return items[Math.floor(randomValue() * items.length)];
}

export function pickMany<T>(randomValue: () => number, items: readonly T[], count: number): T[] {
  const pool = [...items];
  const result: T[] = [];
  const limit = Math.min(count, pool.length);

  for (let i = 0; i < limit; i++) {
    const index = Math.floor(randomValue() * pool.length);
    result.push(pool.splice(index, 1)[0]);
  }

  return result;
}

export function createNoise(seed: number): Noise2D {
  const perm = new Uint8Array(512);
  const grad = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [0, 1], [0, -1],
  ];
  const randomValue = createRng(seed);

  for (let i = 0; i < 256; i++) perm[i] = i;

  for (let i = 255; i > 0; i--) {
    const j = Math.floor(randomValue() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }

  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];

  return function noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const g00 = grad[perm[X + perm[Y]] & 7];
    const g10 = grad[perm[X + 1 + perm[Y]] & 7];
    const g01 = grad[perm[X + perm[Y + 1]] & 7];
    const g11 = grad[perm[X + 1 + perm[Y + 1]] & 7];
    const n00 = g00[0] * xf + g00[1] * yf;
    const n10 = g10[0] * (xf - 1) + g10[1] * yf;
    const n01 = g01[0] * xf + g01[1] * (yf - 1);
    const n11 = g11[0] * (xf - 1) + g11[1] * (yf - 1);
    const nx0 = n00 + u * (n10 - n00);
    const nx1 = n01 + u * (n11 - n01);

    return nx0 + v * (nx1 - nx0);
  };
}

export function fbm(noise: Noise2D, x: number, y: number, octaves: number, gain: number) {
  let sum = 0;
  let amplitude = 1;
  let frequency = 1;
  let totalAmplitude = 0;

  for (let i = 0; i < octaves; i++) {
    sum += noise(x * frequency, y * frequency) * amplitude;
    totalAmplitude += amplitude;
    amplitude *= gain;
    frequency *= 2;
  }

  return sum / totalAmplitude;
}

export function snap(value: number, size: number) {
  return Math.round(value / size) * size;
}
