"use client";

import { useEffect, useRef } from "react";
import { useNowPlayingContext } from "./NowPlayingContext";

type Rgb = [number, number, number];
type Noise2D = (x: number, y: number) => number;
type WeatherKind = "rain" | "comet";
type ShipDirection = -1 | 1;

interface TerrainLayer {
  amplitude: number;
  baseY: number;
  frequency: number;
  detail: number;
  opacity: number;
  lineOpacity: number;
}

interface WeatherParticle {
  x: number;
  y: number;
  speed: number;
  length: number;
  size: number;
  alpha: number;
  phase: number;
  angleOffset: number;
  paletteMix: number;
  kind: WeatherKind;
}

interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
  twinkle: number;
  phase: number;
  paletteMix: number;
}

interface Ship {
  x: number;
  y: number;
  speed: number;
  size: number;
  alpha: number;
  phase: number;
  paletteMix: number;
  direction: ShipDirection;
}

interface Beacon {
  x: number;
  alpha: number;
  phase: number;
  paletteMix: number;
}

interface SceneAssets {
  pixelSize: number;
  stars: Star[];
  weather: WeatherParticle[];
  ships: Ship[];
  beacons: Beacon[];
}

interface SceneConfig {
  seed: number;
  intensity: number;
  skyDrift: number;
  pulseSpeed: number;
  weatherAngle: number;
  weatherCount: number;
  cometBias: number;
  starCount: number;
  shipCount: number;
  beaconCount: number;
  terrainLayers: TerrainLayer[];
}

interface Palette {
  accent: Rgb;
  cyan: Rgb;
  magenta: Rgb;
  warm: Rgb;
  haze: Rgb;
  star: Rgb;
  terrain: Rgb;
}

const FALLBACK_COLOR: Rgb = [130, 144, 176];
const SPACE_TOP: Rgb = [0, 1, 5];
const SPACE_BOTTOM: Rgb = [1, 2, 8];
const TERRAIN_FLOOR: Rgb = [2, 3, 7];
const SHIP_SPRITE = [
  "..2.2..",
  ".21112.",
  "2111112",
  "..3.3..",
];

function createNoise(): Noise2D {
  const perm = new Uint8Array(512);
  const grad = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [0, 1], [0, -1],
  ];

  for (let i = 0; i < 256; i++) perm[i] = i;

  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mix(a: number, b: number, amount: number) {
  return a + (b - a) * amount;
}

function mixColor(a: Rgb, b: Rgb, amount: number): Rgb {
  return [
    mix(a[0], b[0], amount),
    mix(a[1], b[1], amount),
    mix(a[2], b[2], amount),
  ];
}

function rgba(color: Rgb, alpha: number) {
  return `rgba(${Math.round(color[0])}, ${Math.round(color[1])}, ${Math.round(color[2])}, ${alpha})`;
}

function hexToRgb(hex: string): Rgb {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return FALLBACK_COLOR;

  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ];
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seeded(seed: number) {
  return Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
}

function fbm(noise: Noise2D, x: number, y: number, octaves: number, gain: number) {
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

function makePalette(base: Rgb): Palette {
  return {
    accent: mixColor(base, [255, 111, 61], 0.26),
    cyan: mixColor(base, [88, 228, 255], 0.78),
    magenta: mixColor(base, [255, 72, 156], 0.82),
    warm: mixColor(base, [255, 202, 92], 0.76),
    haze: mixColor(base, [72, 94, 180], 0.42),
    star: mixColor(base, [236, 244, 255], 0.88),
    terrain: mixColor(base, [20, 26, 48], 0.24),
  };
}

function featureColor(palette: Palette, amount: number): Rgb {
  if (amount < 0.2) return palette.star;
  if (amount < 0.45) return palette.cyan;
  if (amount < 0.7) return palette.magenta;
  if (amount < 0.88) return palette.accent;
  return palette.warm;
}

function makeSceneConfig(seed: number, isPlaying: boolean, variant: string): SceneConfig {
  const variantBoost =
    variant === "neon" ? 1.18 :
    variant === "accent" ? 1.04 :
    variant === "glassy" ? 0.96 :
    0.84;
  const motion = isPlaying ? 1 : 0.72;
  const intensity = variantBoost * motion;

  return {
    seed,
    intensity,
    skyDrift: mix(0.05, 0.1, seeded(seed + 1)),
    pulseSpeed: mix(1.15, 2.15, seeded(seed + 2)),
    weatherAngle: mix(Math.PI * 0.22, Math.PI * 0.33, seeded(seed + 3)),
    weatherCount: Math.round(mix(7, 12, seeded(seed + 4)) * (0.82 + intensity * 0.28)),
    cometBias: clamp(mix(0.26, 0.42, seeded(seed + 5)) + (variant === "neon" ? 0.06 : 0), 0.24, 0.5),
    starCount: Math.round(mix(54, 98, seeded(seed + 6)) * variantBoost),
    shipCount: variant === "minimal" ? 1 : variant === "neon" ? 3 : 2,
    beaconCount: Math.round(mix(8, 14, seeded(seed + 7))),
    terrainLayers: [
      {
        amplitude: 0.04,
        baseY: 0.64,
        frequency: mix(0.82, 1.08, seeded(seed + 8)),
        detail: 0.32,
        opacity: 0.09,
        lineOpacity: 0.08,
      },
      {
        amplitude: 0.07,
        baseY: 0.76,
        frequency: mix(1.08, 1.4, seeded(seed + 9)),
        detail: 0.46,
        opacity: 0.15,
        lineOpacity: 0.12,
      },
      {
        amplitude: 0.11,
        baseY: 0.88,
        frequency: mix(1.42, 1.86, seeded(seed + 10)),
        detail: 0.62,
        opacity: 0.22,
        lineOpacity: 0.18,
      },
    ],
  };
}

function makeWeatherParticle(
  randomValue: () => number,
  width: number,
  height: number,
  pixelSize: number,
  scene: SceneConfig
): WeatherParticle {
  const weatherSpread = Math.max(width, height) * 0.72;
  const kind: WeatherKind = randomValue() > 1 - scene.cometBias ? "comet" : "rain";

  return {
    kind,
    x: randomValue() * (width + weatherSpread) - weatherSpread * 0.35,
    y: -height * mix(0.08, 0.7, randomValue()),
    speed: kind === "comet"
      ? mix(180, 320, randomValue()) * scene.intensity
      : mix(110, 190, randomValue()) * scene.intensity,
    length: kind === "comet"
      ? mix(72, 156, randomValue()) * pixelSize
      : mix(12, 26, randomValue()) * pixelSize,
    size: pixelSize * (
      kind === "comet"
        ? mix(1.15, 2.2, randomValue())
        : mix(0.65, 0.9, randomValue())
    ),
    alpha: kind === "comet"
      ? mix(0.24, 0.42, randomValue())
      : mix(0.07, 0.14, randomValue()),
    phase: randomValue() * Math.PI * 2,
    angleOffset: kind === "comet"
      ? mix(-0.035, 0.035, randomValue())
      : mix(-0.05, 0.05, randomValue()),
    paletteMix: randomValue(),
  };
}

function createSceneAssets(width: number, height: number, config: SceneConfig): SceneAssets {
  const pixelSize = width < 768 ? 2 : 3;
  const stars: Star[] = [];
  const weather: WeatherParticle[] = [];
  const ships: Ship[] = [];
  const beacons: Beacon[] = [];

  for (let i = 0; i < config.starCount; i++) {
    const seed = config.seed + i * 17.3;
    stars.push({
      x: seeded(seed) * width,
      y: Math.pow(seeded(seed + 1), 1.35) * height * 0.62,
      size: pixelSize * (seeded(seed + 2) > 0.82 ? 2 : 1),
      alpha: mix(0.18, 0.72, seeded(seed + 3)),
      twinkle: mix(0.7, 2.1, seeded(seed + 4)),
      phase: seeded(seed + 5) * Math.PI * 2,
      paletteMix: seeded(seed + 6),
    });
  }

  for (let i = 0; i < config.weatherCount; i++) {
    const seed = config.seed + i * 23.7;
    let cursor = 1;

    weather.push(
      makeWeatherParticle(
        () => seeded(seed + cursor++),
        width,
        height,
        pixelSize,
        config
      )
    );
  }

  for (let i = 0; i < config.shipCount; i++) {
    const seed = config.seed + i * 41.9;
    const direction: ShipDirection = seeded(seed + 1) > 0.5 ? 1 : -1;
    const size = pixelSize * mix(1.35, 2.1, seeded(seed + 2));
    const spriteWidth = SHIP_SPRITE[0].length * size;

    ships.push({
      x: direction === 1 ? -spriteWidth - seeded(seed + 3) * width * 0.2 : width + seeded(seed + 3) * width * 0.2,
      y: height * mix(0.2, 0.46, seeded(seed + 4)),
      speed: mix(18, 42, seeded(seed + 5)) * (0.85 + config.intensity * 0.25),
      size,
      alpha: mix(0.55, 0.8, seeded(seed + 6)),
      phase: seeded(seed + 7) * Math.PI * 2,
      paletteMix: seeded(seed + 8),
      direction,
    });
  }

  for (let i = 0; i < config.beaconCount; i++) {
    const seed = config.seed + i * 13.4;
    beacons.push({
      x: mix(width * 0.06, width * 0.94, seeded(seed)),
      alpha: mix(0.2, 0.55, seeded(seed + 1)),
      phase: seeded(seed + 2) * Math.PI * 2,
      paletteMix: seeded(seed + 3),
    });
  }

  return { pixelSize, stars, weather, ships, beacons };
}

function snap(value: number, size: number) {
  return Math.round(value / size) * size;
}

function drawPixel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: Rgb,
  alpha: number
) {
  ctx.fillStyle = rgba(color, alpha);
  ctx.fillRect(snap(x, size), snap(y, size), size, size);
}

function ridgeHeight(
  noise: Noise2D,
  x: number,
  width: number,
  height: number,
  layer: TerrainLayer,
  seed: number
) {
  const nx = (x / width) * layer.frequency * 3.8;
  const macro = fbm(noise, nx + seed * 0.0008, seed * 0.0028, 4, 0.55);
  const micro = fbm(noise, nx * 2.6 + seed * 0.0014, seed * 0.0031 + 19, 3, 0.5);
  const shape = macro * 0.76 + micro * layer.detail * 0.24;

  return height * (layer.baseY + shape * layer.amplitude);
}

export default function AuroraBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const redrawRef = useRef<(() => void) | null>(null);
  const viewportRef = useRef({ width: 0, height: 0 });
  const noiseRef = useRef<Noise2D | null>(null);
  const sceneRef = useRef<SceneConfig | null>(null);
  const assetsRef = useRef<SceneAssets>({
    pixelSize: 2,
    stars: [],
    weather: [],
    ships: [],
    beacons: [],
  });
  const currentColorRef = useRef<Rgb>(FALLBACK_COLOR);
  const targetColorRef = useRef<Rgb>(FALLBACK_COLOR);
  const reducedMotionRef = useRef(false);

  const { albumColor, track, variant } = useNowPlayingContext();

  useEffect(() => {
    if (!noiseRef.current) {
      noiseRef.current = createNoise();
    }
  }, []);

  useEffect(() => {
    const seedSource = track
      ? `${track.title}:${track.artist}:${track.album}:${variant}`
      : `ambient-space:${variant}`;
    const nextScene = makeSceneConfig(hashString(seedSource), !!track?.isPlaying, variant);

    sceneRef.current = nextScene;

    if (viewportRef.current.width && viewportRef.current.height) {
      assetsRef.current = createSceneAssets(
        viewportRef.current.width,
        viewportRef.current.height,
        nextScene
      );
    }

    targetColorRef.current =
      albumColor && albumColor !== "#888888"
        ? hexToRgb(albumColor)
        : FALLBACK_COLOR;

    if (reducedMotionRef.current) {
      redrawRef.current?.();
    }
  }, [albumColor, track, variant]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const noise = noiseRef.current;

    if (!canvas || !noise) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const mountedCanvas = canvas;
    const ctx = context;
    const terrainNoise: Noise2D = noise;
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = reducedMotionQuery.matches;

    let width = 0;
    let height = 0;
    let previousTime = 0;
    let skyTime = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const scene = sceneRef.current ?? makeSceneConfig(hashString("ambient-space:minimal"), false, "minimal");

      width = window.innerWidth;
      height = window.innerHeight;
      viewportRef.current = { width, height };

      mountedCanvas.width = Math.round(width * dpr);
      mountedCanvas.height = Math.round(height * dpr);
      mountedCanvas.style.width = `${width}px`;
      mountedCanvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      assetsRef.current = createSceneAssets(width, height, scene);
    }

    function resetWeatherParticle(particle: WeatherParticle, scene: SceneConfig) {
      Object.assign(
        particle,
        makeWeatherParticle(Math.random, width, height, assetsRef.current.pixelSize, scene)
      );
    }

    function resetShip(ship: Ship) {
      const spriteWidth = SHIP_SPRITE[0].length * ship.size;

      ship.direction = Math.random() > 0.5 ? 1 : -1;
      ship.size = assetsRef.current.pixelSize * mix(1.35, 2.1, Math.random());
      ship.x = ship.direction === 1 ? -spriteWidth : width + spriteWidth;
      ship.y = height * mix(0.18, 0.46, Math.random());
      ship.speed = mix(18, 42, Math.random());
      ship.alpha = mix(0.55, 0.82, Math.random());
      ship.phase = Math.random() * Math.PI * 2;
      ship.paletteMix = Math.random();
    }

    function drawSky(scene: SceneConfig, palette: Palette) {
      const baseGradient = ctx.createLinearGradient(0, 0, 0, height);
      baseGradient.addColorStop(0, rgba(SPACE_TOP, 1));
      baseGradient.addColorStop(0.45, rgba(mixColor(SPACE_TOP, palette.haze, 0.02), 1));
      baseGradient.addColorStop(1, rgba(SPACE_BOTTOM, 1));

      ctx.fillStyle = baseGradient;
      ctx.fillRect(0, 0, width, height);

      const horizon = ctx.createLinearGradient(0, height * 0.58, 0, height);
      horizon.addColorStop(0, "rgba(0, 0, 0, 0)");
      horizon.addColorStop(0.5, rgba(palette.haze, 0.012 * scene.intensity));
      horizon.addColorStop(0.76, rgba(palette.accent, 0.028 * scene.intensity));
      horizon.addColorStop(1, rgba(TERRAIN_FLOOR, 0.48));
      ctx.fillStyle = horizon;
      ctx.fillRect(0, height * 0.5, width, height * 0.5);
    }

    function drawStars(palette: Palette, timeSeconds: number) {
      const { pixelSize, stars } = assetsRef.current;

      ctx.save();
      ctx.globalCompositeOperation = "screen";

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        const pulse = Math.round((0.35 + 0.65 * (0.5 + 0.5 * Math.sin(timeSeconds * star.twinkle + star.phase))) * 4) / 4;
        const color = star.paletteMix < 0.72 ? palette.star : featureColor(palette, star.paletteMix);
        const alpha = star.alpha * pulse * 0.9;

        drawPixel(ctx, star.x, star.y, star.size, color, alpha);

        if (pulse > 0.7) {
          drawPixel(ctx, star.x - star.size, star.y, pixelSize, color, alpha * 0.6);
          drawPixel(ctx, star.x + star.size, star.y, pixelSize, color, alpha * 0.6);
          drawPixel(ctx, star.x, star.y - star.size, pixelSize, color, alpha * 0.55);
          drawPixel(ctx, star.x, star.y + star.size, pixelSize, color, alpha * 0.55);
        }
      }

      ctx.restore();
    }

    function drawWeather(scene: SceneConfig, palette: Palette, deltaSeconds: number, timeSeconds: number) {
      const weather = assetsRef.current.weather;

      ctx.save();
      ctx.globalCompositeOperation = "screen";

      for (let i = 0; i < weather.length; i++) {
        const particle = weather[i];
        const angle = scene.weatherAngle + particle.angleOffset;
        const directionX = Math.cos(angle);
        const directionY = Math.sin(angle);

        particle.x += directionX * particle.speed * deltaSeconds;
        particle.y += directionY * particle.speed * deltaSeconds;

        if (
          particle.y - particle.length > height * 0.98 ||
          particle.x - particle.length > width + Math.max(width, height) * 0.2
        ) {
          resetWeatherParticle(particle, scene);
        }

        const pulseBase = 0.5 + 0.5 * Math.sin(timeSeconds * scene.pulseSpeed + particle.phase);
        const pulse = particle.kind === "comet"
          ? 0.82 + pulseBase * 0.18
          : Math.round((0.28 + pulseBase * 0.34) * 3) / 3;
        const color = particle.kind === "comet"
          ? featureColor(palette, particle.paletteMix)
          : particle.paletteMix > 0.52 ? palette.cyan : palette.magenta;
        const segments = Math.max(4, Math.floor(particle.length / Math.max(particle.size * 1.35, 1)));

        if (particle.kind === "comet") {
          const halo = ctx.createRadialGradient(
            particle.x,
            particle.y,
            0,
            particle.x,
            particle.y,
            particle.length * 0.16
          );

          halo.addColorStop(0, rgba(color, particle.alpha * 0.38));
          halo.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = halo;
          ctx.fillRect(
            particle.x - particle.length * 0.16,
            particle.y - particle.length * 0.16,
            particle.length * 0.32,
            particle.length * 0.32
          );
        }

        for (let segment = 0; segment < segments; segment++) {
          const progress = segment / segments;
          const alpha = particle.alpha * (1 - progress) * pulse;

          if (particle.kind === "rain" && (segment + Math.floor(timeSeconds * 10 + particle.phase * 5)) % 2 === 0) {
            continue;
          }

          drawPixel(
            ctx,
            particle.x - directionX * progress * particle.length,
            particle.y - directionY * progress * particle.length,
            particle.size,
            color,
            alpha
          );
        }
      }

      ctx.restore();
    }

    function drawShips(palette: Palette, deltaSeconds: number, timeSeconds: number) {
      const ships = assetsRef.current.ships;

      ctx.save();
      ctx.globalCompositeOperation = "screen";

      for (let i = 0; i < ships.length; i++) {
        const ship = ships[i];
        const spriteWidth = SHIP_SPRITE[0].length * ship.size;

        ship.x += ship.speed * ship.direction * deltaSeconds;

        if (
          (ship.direction === 1 && ship.x > width + spriteWidth) ||
          (ship.direction === -1 && ship.x < -spriteWidth * 2)
        ) {
          resetShip(ship);
        }

        const bob = Math.sin(timeSeconds * 0.8 + ship.phase) * ship.size * 1.5;
        const thrusterPulse = Math.round((0.45 + 0.55 * (0.5 + 0.5 * Math.sin(timeSeconds * 6 + ship.phase))) * 3) / 3;
        const canopy = featureColor(palette, ship.paletteMix);
        const hull = mixColor(TERRAIN_FLOOR, palette.terrain, 0.4);
        const thruster = ship.paletteMix > 0.5 ? palette.warm : palette.accent;
        const halo = ctx.createRadialGradient(
          ship.x + spriteWidth * 0.5,
          ship.y + bob,
          0,
          ship.x + spriteWidth * 0.5,
          ship.y + bob,
          spriteWidth
        );

        halo.addColorStop(0, rgba(canopy, 0.035 * ship.alpha));
        halo.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = halo;
        ctx.fillRect(ship.x - spriteWidth, ship.y - spriteWidth, spriteWidth * 3, spriteWidth * 2);

        for (let row = 0; row < SHIP_SPRITE.length; row++) {
          const line = SHIP_SPRITE[row];

          for (let col = 0; col < line.length; col++) {
            const cell = line[col];

            if (cell === ".") continue;

            const mappedCol = ship.direction === 1 ? col : line.length - 1 - col;
            const px = ship.x + mappedCol * ship.size;
            const py = ship.y + bob + row * ship.size;

            if (cell === "1") {
              drawPixel(ctx, px, py, ship.size, hull, ship.alpha * 0.75);
            }

            if (cell === "2") {
              drawPixel(ctx, px, py, ship.size, canopy, ship.alpha);
            }

            if (cell === "3") {
              drawPixel(ctx, px, py, ship.size, thruster, ship.alpha * thrusterPulse);
            }
          }
        }
      }

      ctx.restore();
    }

    function drawTerrain(scene: SceneConfig, palette: Palette, timeSeconds: number) {
      const { pixelSize, beacons } = assetsRef.current;

      for (let i = 0; i < scene.terrainLayers.length; i++) {
        const layer = scene.terrainLayers[i];
        const seed = scene.seed + i * 31;
        const fill = mixColor(TERRAIN_FLOOR, palette.terrain, layer.opacity);
        const line = featureColor(palette, 0.26 + i * 0.18);
        const step = Math.max(8, Math.round(width / 92));

        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, ridgeHeight(terrainNoise, 0, width, height, layer, seed));

        for (let x = 0; x <= width + step; x += step) {
          ctx.lineTo(x, ridgeHeight(terrainNoise, x, width, height, layer, seed));
        }

        ctx.lineTo(width, height);
        ctx.closePath();

        const gradient = ctx.createLinearGradient(0, height * layer.baseY, 0, height);
        gradient.addColorStop(0, rgba(fill, 0.86));
        gradient.addColorStop(1, rgba(TERRAIN_FLOOR, 1));

        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = rgba(line, layer.lineOpacity);
        ctx.lineWidth = i === scene.terrainLayers.length - 1 ? 1.25 : 0.9;
        ctx.stroke();

        const haze = ctx.createLinearGradient(0, height * (layer.baseY - 0.05), 0, height);
        haze.addColorStop(0, rgba(line, 0.022));
        haze.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = haze;
        ctx.fillRect(0, height * (layer.baseY - 0.08), width, height * 0.22);
      }

      const frontLayer = scene.terrainLayers[scene.terrainLayers.length - 1];
      const frontSeed = scene.seed + (scene.terrainLayers.length - 1) * 31;

      ctx.save();
      ctx.globalCompositeOperation = "screen";

      for (let i = 0; i < beacons.length; i++) {
        const beacon = beacons[i];
        const pop = Math.round((0.45 + 0.55 * (0.5 + 0.5 * Math.sin(timeSeconds * scene.pulseSpeed * 1.7 + beacon.phase))) * 3) / 3;
        const color = featureColor(palette, beacon.paletteMix);
        const y = ridgeHeight(terrainNoise, beacon.x, width, height, frontLayer, frontSeed) - pixelSize * 1.5;

        drawPixel(ctx, beacon.x, y, pixelSize, color, beacon.alpha * pop);

        if (pop > 0.66) {
          drawPixel(ctx, beacon.x + pixelSize, y, pixelSize, color, beacon.alpha * pop * 0.45);
        }
      }

      ctx.restore();
    }

    function drawFrame(time: number) {
      const scene = sceneRef.current ?? makeSceneConfig(hashString("ambient-space:minimal"), false, "minimal");
      const deltaSeconds = previousTime ? Math.min((time - previousTime) / 1000, 0.032) : 0.016;
      const timeSeconds = time / 1000;

      previousTime = time;
      skyTime += deltaSeconds;
      currentColorRef.current = mixColor(currentColorRef.current, targetColorRef.current, 0.03);

      const palette = makePalette(currentColorRef.current);

      ctx.clearRect(0, 0, width, height);
      drawSky(scene, palette);
      drawStars(palette, timeSeconds);
      drawWeather(scene, palette, reducedMotionRef.current ? 0 : deltaSeconds, timeSeconds);
      drawShips(palette, reducedMotionRef.current ? 0 : deltaSeconds, timeSeconds);
      drawTerrain(scene, palette, timeSeconds);

      const vignette = ctx.createRadialGradient(
        width * 0.5,
        height * 0.3,
        height * 0.18,
        width * 0.5,
        height * 0.58,
        Math.max(width, height) * 0.82
      );

      vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
      vignette.addColorStop(1, "rgba(0, 0, 0, 0.56)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      if (!reducedMotionRef.current) {
        animationRef.current = window.requestAnimationFrame(drawFrame);
      }
    }

    redrawRef.current = () => {
      previousTime = 0;
      window.cancelAnimationFrame(animationRef.current);
      drawFrame(0);
    };

    function handleReducedMotionChange(event: MediaQueryListEvent) {
      reducedMotionRef.current = event.matches;

      if (event.matches) {
        redrawRef.current?.();
        return;
      }

      animationRef.current = window.requestAnimationFrame(drawFrame);
    }

    resize();
    drawFrame(0);

    window.addEventListener("resize", resize);
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);

    return () => {
      window.cancelAnimationFrame(animationRef.current);
      redrawRef.current = null;
      window.removeEventListener("resize", resize);
      reducedMotionQuery.removeEventListener("change", handleReducedMotionChange);
    };
  }, []);

  const fallbackAccent = makePalette(
    albumColor && albumColor !== "#888888" ? hexToRgb(albumColor) : FALLBACK_COLOR
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[2]" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, rgba(0,1,5,1) 0%, rgba(1,2,7,1) 58%, rgba(1,2,6,1) 100%), linear-gradient(180deg, rgba(0,0,0,0) 58%, ${rgba(fallbackAccent.haze, 0.02)} 78%, rgba(0,0,0,0.2) 100%)`,
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-100" />
    </div>
  );
}
