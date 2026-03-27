"use client";

import { useEffect, useRef } from "react";
import { useNowPlayingContext } from "./NowPlayingContext";

type Noise2D = (x: number, y: number) => number;

interface TerrainLayer {
  amplitude: number;
  baseY: number;
  frequency: number;
  detail: number;
  opacity: number;
  haze: number;
}

interface WeatherParticle {
  x: number;
  y: number;
  speed: number;
  length: number;
  width: number;
  alpha: number;
  glow: number;
}

interface SceneConfig {
  seed: number;
  intensity: number;
  angle: number;
  skyDrift: number;
  terrainRoughness: number;
  weatherDensity: number;
  weatherSpeed: number;
  terrainLayers: TerrainLayer[];
}

const FALLBACK_COLOR: [number, number, number] = [128, 144, 176];
const BASE_SKY_TOP: [number, number, number] = [2, 4, 8];
const BASE_SKY_BOTTOM: [number, number, number] = [5, 8, 12];
const LANDSCAPE_FLOOR: [number, number, number] = [2, 3, 5];

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

function mix(a: number, b: number, amount: number) {
  return a + (b - a) * amount;
}

function mixColor(
  a: [number, number, number],
  b: [number, number, number],
  amount: number
): [number, number, number] {
  return [
    mix(a[0], b[0], amount),
    mix(a[1], b[1], amount),
    mix(a[2], b[2], amount),
  ];
}

function rgba(color: [number, number, number], alpha: number) {
  return `rgba(${Math.round(color[0])}, ${Math.round(color[1])}, ${Math.round(color[2])}, ${alpha})`;
}

function hexToRgb(hex: string): [number, number, number] {
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

function makeSceneConfig(seed: number, isPlaying: boolean): SceneConfig {
  const terrainRoughness = mix(0.75, 1.25, seeded(seed + 1));
  const intensity = isPlaying ? 1 : 0.65;

  return {
    seed,
    intensity,
    angle: mix(Math.PI * 0.18, Math.PI * 0.31, seeded(seed + 2)),
    skyDrift: mix(0.05, 0.11, seeded(seed + 3)),
    terrainRoughness,
    weatherDensity: Math.round(mix(22, 42, seeded(seed + 4)) * intensity),
    weatherSpeed: mix(260, 460, seeded(seed + 5)) * intensity,
    terrainLayers: [
      {
        amplitude: 0.045 * terrainRoughness,
        baseY: 0.63,
        frequency: mix(0.8, 1.2, seeded(seed + 6)),
        detail: 0.35,
        opacity: 0.1,
        haze: 0.08,
      },
      {
        amplitude: 0.075 * terrainRoughness,
        baseY: 0.74,
        frequency: mix(1.1, 1.5, seeded(seed + 7)),
        detail: 0.48,
        opacity: 0.16,
        haze: 0.11,
      },
      {
        amplitude: 0.11 * terrainRoughness,
        baseY: 0.86,
        frequency: mix(1.4, 2, seeded(seed + 8)),
        detail: 0.62,
        opacity: 0.22,
        haze: 0.14,
      },
    ],
  };
}

function createParticles(
  width: number,
  height: number,
  config: SceneConfig
): WeatherParticle[] {
  const particles: WeatherParticle[] = [];
  const travel = Math.max(width, height) * 0.45;
  const spreadX = width + Math.cos(config.angle) * travel;
  const spreadY = height * 0.58;

  for (let i = 0; i < config.weatherDensity; i++) {
    const seed = config.seed + i * 17.17;
    const x = seeded(seed) * spreadX - travel * 0.1;
    const y = seeded(seed + 3) * spreadY - height * 0.55;
    const cometBias = seeded(seed + 9) > 0.8 ? 1.45 : 1;

    particles.push({
      x,
      y,
      speed: config.weatherSpeed * mix(0.65, 1.25, seeded(seed + 5)) * cometBias,
      length: mix(55, 180, seeded(seed + 7)) * cometBias,
      width: mix(0.6, 1.6, seeded(seed + 11)),
      alpha: mix(0.07, 0.18, seeded(seed + 13)) * config.intensity,
      glow: seeded(seed + 15) > 0.82 ? 0.55 : 0.22,
    });
  }

  return particles;
}

export default function AuroraBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const redrawRef = useRef<(() => void) | null>(null);
  const sceneRef = useRef<SceneConfig | null>(null);
  const particlesRef = useRef<WeatherParticle[]>([]);
  const viewportRef = useRef({ width: 0, height: 0 });
  const noiseRef = useRef<Noise2D | null>(null);
  const currentColorRef = useRef<[number, number, number]>(FALLBACK_COLOR);
  const targetColorRef = useRef<[number, number, number]>(FALLBACK_COLOR);
  const reducedMotionRef = useRef(false);

  const { albumColor, track } = useNowPlayingContext();

  useEffect(() => {
    if (!noiseRef.current) noiseRef.current = createNoise();
  }, []);

  useEffect(() => {
    const seedSource = track
      ? `${track.title}:${track.artist}:${track.album}`
      : "ambient-landscape";
    const nextScene = makeSceneConfig(hashString(seedSource), !!track?.isPlaying);

    sceneRef.current = nextScene;

    if (viewportRef.current.width && viewportRef.current.height) {
      particlesRef.current = createParticles(
        viewportRef.current.width,
        viewportRef.current.height,
        nextScene
      );
    }

    if (albumColor && albumColor !== "#888888") {
      targetColorRef.current = hexToRgb(albumColor);
    } else {
      targetColorRef.current = FALLBACK_COLOR;
    }

    if (reducedMotionRef.current) {
      redrawRef.current?.();
    }
  }, [albumColor, track]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const noise = noiseRef.current;

    if (!canvas || !noise) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = reducedMotionQuery.matches;

    let width = 0;
    let height = 0;
    let previousTime = 0;
    let skyTime = 0;

    function resize() {
      const nextScene = sceneRef.current ?? makeSceneConfig(hashString("ambient-landscape"), false);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);

      width = window.innerWidth;
      height = window.innerHeight;
      viewportRef.current = { width, height };

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      particlesRef.current = createParticles(width, height, nextScene);
    }

    function drawSkyWash(config: SceneConfig, accent: [number, number, number]) {
      const accentSoft = mixColor(accent, [148, 171, 205], 0.58);
      const accentWarm = mixColor(accent, [228, 196, 164], 0.7);
      const topGradient = context.createLinearGradient(0, 0, 0, height);

      topGradient.addColorStop(0, rgba(BASE_SKY_TOP, 1));
      topGradient.addColorStop(0.55, rgba(mixColor(BASE_SKY_BOTTOM, accentSoft, 0.08), 1));
      topGradient.addColorStop(1, rgba(mixColor(BASE_SKY_BOTTOM, LANDSCAPE_FLOOR, 0.5), 1));

      context.fillStyle = topGradient;
      context.fillRect(0, 0, width, height);

      const driftX = width * (0.5 + Math.sin(skyTime * config.skyDrift) * 0.08);
      const driftY = height * (0.18 + Math.cos(skyTime * config.skyDrift * 0.7) * 0.03);
      const skyGlow = context.createRadialGradient(
        driftX,
        driftY,
        0,
        driftX,
        driftY,
        Math.max(width, height) * 0.7
      );

      skyGlow.addColorStop(0, rgba(accentSoft, 0.13 * config.intensity));
      skyGlow.addColorStop(0.45, rgba(accentWarm, 0.05 * config.intensity));
      skyGlow.addColorStop(1, rgba(accentSoft, 0));
      context.fillStyle = skyGlow;
      context.fillRect(0, 0, width, height);

      const horizonGlow = context.createLinearGradient(0, height * 0.45, 0, height);
      horizonGlow.addColorStop(0, "rgba(0, 0, 0, 0)");
      horizonGlow.addColorStop(0.58, rgba(mixColor(accentWarm, LANDSCAPE_FLOOR, 0.75), 0.06));
      horizonGlow.addColorStop(1, rgba(LANDSCAPE_FLOOR, 0.45));
      context.fillStyle = horizonGlow;
      context.fillRect(0, height * 0.4, width, height * 0.6);
    }

    function ridgeHeight(
      x: number,
      widthValue: number,
      heightValue: number,
      layer: TerrainLayer,
      seed: number
    ) {
      const nx = (x / widthValue) * layer.frequency * 3.6;
      const macro = fbm(noise, nx + seed * 0.001, seed * 0.003, 4, 0.55);
      const micro = fbm(noise, nx * 2.4 + seed * 0.002, seed * 0.004 + 18, 3, 0.5);
      const shape = macro * 0.72 + micro * layer.detail * 0.28;

      return heightValue * (layer.baseY + shape * layer.amplitude);
    }

    function drawTerrain(config: SceneConfig, accent: [number, number, number]) {
      const shadowAccent = mixColor(accent, LANDSCAPE_FLOOR, 0.82);
      const farAccent = mixColor(accent, [94, 111, 139], 0.7);

      for (let i = 0; i < config.terrainLayers.length; i++) {
        const layer = config.terrainLayers[i];
        const step = Math.max(8, Math.round(width / 90));
        const fill = mixColor(LANDSCAPE_FLOOR, i === 0 ? farAccent : shadowAccent, layer.opacity);
        const line = mixColor(fill, accent, 0.22);

        context.beginPath();
        context.moveTo(0, height);
        context.lineTo(0, ridgeHeight(0, width, height, layer, config.seed + i * 29));

        for (let x = 0; x <= width + step; x += step) {
          context.lineTo(x, ridgeHeight(x, width, height, layer, config.seed + i * 29));
        }

        context.lineTo(width, height);
        context.closePath();

        const layerGradient = context.createLinearGradient(0, height * layer.baseY, 0, height);
        layerGradient.addColorStop(0, rgba(fill, 0.78));
        layerGradient.addColorStop(1, rgba(LANDSCAPE_FLOOR, 0.98));
        context.fillStyle = layerGradient;
        context.fill();

        context.strokeStyle = rgba(line, 0.24);
        context.lineWidth = i === config.terrainLayers.length - 1 ? 1.25 : 0.8;
        context.stroke();

        const haze = context.createLinearGradient(0, height * (layer.baseY - 0.03), 0, height);
        haze.addColorStop(0, rgba(accent, layer.haze * 0.22));
        haze.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = haze;
        context.fillRect(0, height * (layer.baseY - 0.08), width, height * 0.22);
      }
    }

    function drawWeather(config: SceneConfig, accent: [number, number, number], deltaSeconds: number) {
      const directionX = Math.cos(config.angle);
      const directionY = Math.sin(config.angle);
      const weatherColor = mixColor(accent, [220, 232, 245], 0.62);
      const maxTravel = Math.max(width, height) * 0.75;

      context.save();
      context.globalCompositeOperation = "screen";

      for (let i = 0; i < particlesRef.current.length; i++) {
        const particle = particlesRef.current[i];
        particle.x += directionX * particle.speed * deltaSeconds;
        particle.y += directionY * particle.speed * deltaSeconds;

        if (particle.y - particle.length > height * 0.92 || particle.x - particle.length > width + maxTravel * 0.15) {
          particle.x = -maxTravel * seeded(config.seed + i * 33.1);
          particle.y = -height * mix(0.15, 0.6, seeded(config.seed + i * 11.4));
        }

        const tailX = particle.x - directionX * particle.length;
        const tailY = particle.y - directionY * particle.length;
        const trail = context.createLinearGradient(particle.x, particle.y, tailX, tailY);

        trail.addColorStop(0, rgba(weatherColor, particle.alpha + particle.glow * 0.14));
        trail.addColorStop(0.3, rgba(weatherColor, particle.alpha * 0.6));
        trail.addColorStop(1, "rgba(255, 255, 255, 0)");

        context.strokeStyle = trail;
        context.lineWidth = particle.width;
        context.beginPath();
        context.moveTo(tailX, tailY);
        context.lineTo(particle.x, particle.y);
        context.stroke();

        if (particle.glow > 0.3) {
          const headGlow = context.createRadialGradient(
            particle.x,
            particle.y,
            0,
            particle.x,
            particle.y,
            particle.length * 0.12
          );

          headGlow.addColorStop(0, rgba(weatherColor, particle.alpha * 1.6));
          headGlow.addColorStop(1, "rgba(255, 255, 255, 0)");
          context.fillStyle = headGlow;
          context.fillRect(
            particle.x - particle.length * 0.12,
            particle.y - particle.length * 0.12,
            particle.length * 0.24,
            particle.length * 0.24
          );
        }
      }

      context.restore();
    }

    function drawFrame(time: number) {
      const config = sceneRef.current ?? makeSceneConfig(hashString("ambient-landscape"), false);
      const deltaSeconds = previousTime ? Math.min((time - previousTime) / 1000, 0.032) : 0.016;
      previousTime = time;
      skyTime += deltaSeconds;

      currentColorRef.current = mixColor(currentColorRef.current, targetColorRef.current, 0.02);
      const accent = currentColorRef.current;

      context.clearRect(0, 0, width, height);
      drawSkyWash(config, accent);
      drawWeather(config, accent, reducedMotionRef.current ? 0 : deltaSeconds);
      drawTerrain(config, accent);

      const vignette = context.createRadialGradient(
        width * 0.5,
        height * 0.35,
        height * 0.2,
        width * 0.5,
        height * 0.55,
        Math.max(width, height) * 0.8
      );
      vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
      vignette.addColorStop(1, "rgba(0, 0, 0, 0.42)");
      context.fillStyle = vignette;
      context.fillRect(0, 0, width, height);

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
      previousTime = 0;

      if (event.matches) {
        window.cancelAnimationFrame(animationRef.current);
        drawFrame(0);
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

  const fallbackAccent = mixColor(
    albumColor && albumColor !== "#888888" ? hexToRgb(albumColor) : FALLBACK_COLOR,
    [168, 186, 216],
    0.6
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[2]" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, rgba(2,4,8,1) 0%, rgba(3,6,10,1) 54%, rgba(1,2,4,1) 100%), radial-gradient(circle at 50% 18%, ${rgba(fallbackAccent, 0.12)} 0%, rgba(0,0,0,0) 56%)`,
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-95" />
    </div>
  );
}
