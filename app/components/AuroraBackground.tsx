"use client";

import { useEffect, useRef } from "react";
import { useNowPlayingContext } from "./NowPlayingContext";
import { createNoise, createRng, hashString, hexToRgb, mixColor, rgba } from "./aurora/math";
import { createSceneAssets, FALLBACK_COLOR, makePalette, makeSceneConfig } from "./aurora/scene";
import { drawSceneFrame } from "./aurora/render";
import type { Noise2D, Palette, Rgb, SceneAssets, SceneConfig, VisualVariant } from "./aurora/types";

const FALLBACK_VARIANT: VisualVariant = "minimal";
const INITIAL_SEED = hashString("ambient-space:minimal");
const INITIAL_SCENE = makeSceneConfig(INITIAL_SEED, false, FALLBACK_VARIANT);
const TARGET_FRAME_MS = 1000 / 30; // cap at ~30fps — imperceptible for this subtle ambient scene

function createEmptyAssets(): SceneAssets {
  return {
    pixelSize: 2,
    stars: [],
    weather: [],
    ships: [],
    celestials: [],
    constellations: [],
    satellites: [],
    skyTrails: [],
    horizonProps: [],
    terrainPaths: [],
    horizonGroundY: [],
  };
}

function getSceneSeedSource(
  track: { title: string; artist: string; album: string } | null,
  variant: VisualVariant
) {
  return track
    ? `${track.title}:${track.artist}:${track.album}:${variant}`
    : `ambient-space:${variant}`;
}

function resolveAlbumColor(albumColor: string): Rgb {
  return albumColor && albumColor !== "#888888"
    ? hexToRgb(albumColor, FALLBACK_COLOR)
    : FALLBACK_COLOR;
}

export default function AuroraBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const redrawRef = useRef<(() => void) | null>(null);
  const viewportRef = useRef({ width: 0, height: 0 });
  const sceneRef = useRef<SceneConfig>(INITIAL_SCENE);
  const terrainNoiseRef = useRef<Noise2D>(createNoise(INITIAL_SEED ^ 0x85ebca6b));
  const spawnRandomRef = useRef(createRng(INITIAL_SEED ^ 0xc2b2ae35));
  const assetsRef = useRef<SceneAssets>(createEmptyAssets());
  const currentColorRef = useRef<Rgb>(FALLBACK_COLOR);
  const targetColorRef = useRef<Rgb>(FALLBACK_COLOR);
  const reducedMotionRef = useRef(false);

  const { albumColor, track, variant } = useNowPlayingContext();

  useEffect(() => {
    const nextColor = resolveAlbumColor(albumColor);
    const seed = hashString(getSceneSeedSource(track, variant));
    const nextScene = makeSceneConfig(seed, !!track?.isPlaying, variant);
    const nextNoise = createNoise(seed ^ 0x85ebca6b);

    sceneRef.current = nextScene;
    terrainNoiseRef.current = nextNoise;
    spawnRandomRef.current = createRng(seed ^ 0xc2b2ae35);
    targetColorRef.current = nextColor;

    if (viewportRef.current.width && viewportRef.current.height) {
      assetsRef.current = createSceneAssets(
        viewportRef.current.width,
        viewportRef.current.height,
        nextScene,
        nextNoise
      );
    }

    if (reducedMotionRef.current) {
      currentColorRef.current = nextColor;
      redrawRef.current?.();
    }
  }, [albumColor, track, variant]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const mountedCanvas = canvas;
    const ctx = context;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = reducedMotionQuery.matches;

    let width = 0;
    let height = 0;
    let previousTime = 0;
    let skyTime = 0;
    let lastRenderTime = 0;
    let cachedPalette: Palette | null = null;
    let cachedPaletteKey: Rgb = [-1, -1, -1];

    function getPalette(color: Rgb): Palette {
      // Rebuild the palette only when the underlying color has drifted enough
      // to be perceptible. Saves 9 color allocations and 9 mixColor calls per frame
      // while the palette is settled.
      if (
        !cachedPalette ||
        Math.abs(color[0] - cachedPaletteKey[0]) > 0.5 ||
        Math.abs(color[1] - cachedPaletteKey[1]) > 0.5 ||
        Math.abs(color[2] - cachedPaletteKey[2]) > 0.5
      ) {
        cachedPalette = makePalette(color);
        cachedPaletteKey = [color[0], color[1], color[2]];
      }
      return cachedPalette;
    }

    function renderFrame(time: number) {
      if (!width || !height) return;

      const deltaSeconds = previousTime ? Math.min((time - previousTime) / 1000, 0.032) : 0.016;
      previousTime = time;
      skyTime += deltaSeconds;
      currentColorRef.current = mixColor(
        currentColorRef.current,
        targetColorRef.current,
        reducedMotionRef.current ? 1 : 0.03
      );

      drawSceneFrame({
        ctx,
        width,
        height,
        scene: sceneRef.current,
        assets: assetsRef.current,
        palette: getPalette(currentColorRef.current),
        terrainNoise: terrainNoiseRef.current,
        spawnRandom: spawnRandomRef.current,
        timeSeconds: time / 1000,
        deltaSeconds: reducedMotionRef.current ? 0 : deltaSeconds,
        skyTime,
      });
    }

    function drawFrame(time: number) {
      if (reducedMotionRef.current) {
        renderFrame(time);
        return;
      }

      if (document.hidden) {
        // Pause entirely; visibility listener re-schedules on return.
        return;
      }

      // Throttle to ~30fps to halve per-frame CPU and GPU work without
      // visible stutter for this slow-moving ambient scene.
      if (time - lastRenderTime >= TARGET_FRAME_MS) {
        lastRenderTime = time;
        renderFrame(time);
      }

      animationRef.current = window.requestAnimationFrame(drawFrame);
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);

      width = window.innerWidth;
      height = window.innerHeight;
      viewportRef.current = { width, height };

      mountedCanvas.width = Math.round(width * dpr);
      mountedCanvas.height = Math.round(height * dpr);
      mountedCanvas.style.width = `${width}px`;
      mountedCanvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      assetsRef.current = createSceneAssets(width, height, sceneRef.current, terrainNoiseRef.current);

      if (reducedMotionRef.current) {
        previousTime = 0;
        renderFrame(0);
      }
    }

    redrawRef.current = () => {
      previousTime = 0;
      lastRenderTime = 0;
      renderFrame(0);
    };

    function handleReducedMotionChange(event: MediaQueryListEvent) {
      reducedMotionRef.current = event.matches;
      previousTime = 0;
      lastRenderTime = 0;
      window.cancelAnimationFrame(animationRef.current);

      if (event.matches) {
        currentColorRef.current = targetColorRef.current;
        renderFrame(0);
        return;
      }

      animationRef.current = window.requestAnimationFrame(drawFrame);
    }

    function handleVisibilityChange() {
      if (document.hidden || reducedMotionRef.current) return;
      // Reset timing so we don't burst several frames on wake.
      previousTime = 0;
      lastRenderTime = 0;
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = window.requestAnimationFrame(drawFrame);
    }

    resize();
    if (reducedMotionRef.current) {
      renderFrame(0);
    } else {
      animationRef.current = window.requestAnimationFrame(drawFrame);
    }

    window.addEventListener("resize", resize);
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.cancelAnimationFrame(animationRef.current);
      redrawRef.current = null;
      window.removeEventListener("resize", resize);
      reducedMotionQuery.removeEventListener("change", handleReducedMotionChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const fallbackAccent = makePalette(resolveAlbumColor(albumColor));

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
