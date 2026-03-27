import { HORIZON_SPRITES, SATELLITE_SPRITES, SHIP_SPRITES, VARIANT_THEME_POOLS, WORLD_THEMES } from "./sprites";
import {
  chance,
  clamp,
  createRng,
  mix,
  mixColor,
  pick,
  pickMany,
} from "./math";
import type {
  CelestialBody,
  Constellation,
  HorizonProp,
  Palette,
  Rgb,
  Satellite,
  SceneAssets,
  SceneConfig,
  Ship,
  SkyFeature,
  SkyTrail,
  Star,
  TerrainLayer,
  VisualVariant,
  WeatherParticle,
  WeatherKind,
  WorldThemeId,
} from "./types";

export const FALLBACK_COLOR: Rgb = [130, 144, 176];
export const SPACE_TOP: Rgb = [0, 1, 5];
export const SPACE_BOTTOM: Rgb = [1, 2, 8];
export const TERRAIN_FLOOR: Rgb = [2, 3, 7];

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function mergeThemeValues<T extends keyof (typeof WORLD_THEMES)[WorldThemeId]>(
  theme: WorldThemeId,
  accentTheme: WorldThemeId | null,
  key: T
) {
  const primary = WORLD_THEMES[theme][key] as unknown as Array<(typeof WORLD_THEMES)[WorldThemeId][T][number]>;
  const secondary = accentTheme
    ? (WORLD_THEMES[accentTheme][key] as unknown as Array<(typeof WORLD_THEMES)[WorldThemeId][T][number]>)
    : [];

  return unique([...primary, ...secondary]);
}

export function makePalette(base: Rgb): Palette {
  return {
    accent: mixColor(base, [255, 111, 61], 0.26),
    cyan: mixColor(base, [88, 228, 255], 0.78),
    magenta: mixColor(base, [255, 72, 156], 0.82),
    warm: mixColor(base, [255, 202, 92], 0.76),
    haze: mixColor(base, [72, 94, 180], 0.42),
    star: mixColor(base, [236, 244, 255], 0.88),
    terrain: mixColor(base, [20, 26, 48], 0.24),
    signal: mixColor(base, [150, 216, 255], 0.64),
    deep: mixColor(base, [10, 14, 28], 0.16),
  };
}

export function featureColor(palette: Palette, amount: number): Rgb {
  if (amount < 0.16) return palette.star;
  if (amount < 0.38) return palette.signal;
  if (amount < 0.58) return palette.cyan;
  if (amount < 0.78) return palette.magenta;
  if (amount < 0.92) return palette.accent;
  return palette.warm;
}

function makeTerrainLayers(style: SceneConfig["terrainStyle"], randomValue: () => number): TerrainLayer[] {
  switch (style) {
    case "mesas":
      return [
        { amplitude: 0.032, baseY: 0.65, frequency: mix(0.58, 0.84, randomValue()), detail: 0.18, opacity: 0.08, lineOpacity: 0.06 },
        { amplitude: 0.058, baseY: 0.77, frequency: mix(0.92, 1.18, randomValue()), detail: 0.3, opacity: 0.14, lineOpacity: 0.1 },
        { amplitude: 0.094, baseY: 0.89, frequency: mix(1.24, 1.52, randomValue()), detail: 0.4, opacity: 0.22, lineOpacity: 0.16 },
      ];
    case "dunes":
      return [
        { amplitude: 0.026, baseY: 0.66, frequency: mix(0.74, 0.98, randomValue()), detail: 0.14, opacity: 0.07, lineOpacity: 0.04 },
        { amplitude: 0.048, baseY: 0.79, frequency: mix(1.0, 1.22, randomValue()), detail: 0.22, opacity: 0.12, lineOpacity: 0.07 },
        { amplitude: 0.078, baseY: 0.9, frequency: mix(1.22, 1.46, randomValue()), detail: 0.3, opacity: 0.2, lineOpacity: 0.12 },
      ];
    case "crags":
      return [
        { amplitude: 0.05, baseY: 0.62, frequency: mix(1.0, 1.26, randomValue()), detail: 0.48, opacity: 0.1, lineOpacity: 0.09 },
        { amplitude: 0.086, baseY: 0.74, frequency: mix(1.36, 1.72, randomValue()), detail: 0.64, opacity: 0.16, lineOpacity: 0.15 },
        { amplitude: 0.126, baseY: 0.86, frequency: mix(1.76, 2.18, randomValue()), detail: 0.82, opacity: 0.24, lineOpacity: 0.22 },
      ];
    case "ridges":
    default:
      return [
        { amplitude: 0.04, baseY: 0.64, frequency: mix(0.82, 1.08, randomValue()), detail: 0.32, opacity: 0.09, lineOpacity: 0.08 },
        { amplitude: 0.07, baseY: 0.76, frequency: mix(1.08, 1.4, randomValue()), detail: 0.46, opacity: 0.15, lineOpacity: 0.12 },
        { amplitude: 0.11, baseY: 0.88, frequency: mix(1.42, 1.86, randomValue()), detail: 0.62, opacity: 0.22, lineOpacity: 0.18 },
      ];
  }
}

export function makeSceneConfig(seed: number, isPlaying: boolean, variant: VisualVariant): SceneConfig {
  const randomValue = createRng(seed ^ 0x9e3779b9);
  const variantBoost =
    variant === "neon" ? 1.18 :
    variant === "accent" ? 1.04 :
    variant === "glassy" ? 0.96 :
    0.84;
  const motion = isPlaying ? 1 : 0.72;
  const intensity = variantBoost * motion;
  const theme = pick(randomValue, VARIANT_THEME_POOLS[variant]);
  const accentPool = VARIANT_THEME_POOLS[variant].filter((item) => item !== theme);
  const accentTheme =
    accentPool.length > 0 && chance(randomValue, variant === "minimal" ? 0.18 : 0.42)
      ? pick(randomValue, accentPool)
      : null;
  const primaryTheme = WORLD_THEMES[theme];
  const terrainStyle = chance(randomValue, accentTheme ? 0.24 : 0)
    ? pick(randomValue, WORLD_THEMES[accentTheme!].terrainStyles)
    : pick(randomValue, primaryTheme.terrainStyles);
  const weatherMode = chance(randomValue, accentTheme ? 0.22 : 0)
    ? pick(randomValue, WORLD_THEMES[accentTheme!].weatherModes)
    : pick(randomValue, primaryTheme.weatherModes);
  const celestialMode = chance(randomValue, accentTheme ? 0.26 : 0)
    ? pick(randomValue, WORLD_THEMES[accentTheme!].celestialModes)
    : pick(randomValue, primaryTheme.celestialModes);
  const shipPool = mergeThemeValues(theme, accentTheme, "shipPacks");
  const shipPack = chance(randomValue, variant === "minimal" ? 0.35 : 0.16)
    ? "none"
    : pick(randomValue, shipPool);
  const skyFeaturePool = mergeThemeValues(theme, accentTheme, "skyFeatures") as SkyFeature[];
  const skyFeatureCount =
    variant === "minimal"
      ? (chance(randomValue, 0.5) ? 1 : 0)
      : 1 + (chance(randomValue, variant === "neon" ? 0.6 : 0.4) ? 1 : 0);
  const skyFeatures = pickMany(randomValue, skyFeaturePool, skyFeatureCount) as SkyFeature[];
  const satelliteSpriteIds = skyFeatures.includes("satellite")
    ? pickMany(
        randomValue,
        mergeThemeValues(theme, accentTheme, "satelliteSprites"),
        1 + (chance(randomValue, 0.28) ? 1 : 0)
      )
    : [];
  const horizonSpriteIds = pickMany(
    randomValue,
    mergeThemeValues(theme, accentTheme, "horizonSprites"),
    2 + (chance(randomValue, variant === "neon" ? 0.58 : 0.36) ? 1 : 0)
  );
  const terrainLayers = makeTerrainLayers(terrainStyle, randomValue);

  let weatherAngle = Math.PI * 0.28;
  let weatherCount = 6;
  let cometBias = 0.3;

  switch (weatherMode) {
    case "comet-field":
      weatherAngle = mix(Math.PI * 0.18, Math.PI * 0.26, randomValue());
      weatherCount = Math.round(mix(4, 7, randomValue()) * (0.9 + intensity * 0.12));
      cometBias = mix(0.72, 0.9, randomValue());
      break;
    case "meteor-shower":
      weatherAngle = mix(Math.PI * 0.24, Math.PI * 0.36, randomValue());
      weatherCount = Math.round(mix(5, 9, randomValue()) * (0.88 + intensity * 0.18));
      cometBias = mix(0.52, 0.74, randomValue());
      break;
    case "crosswind":
      weatherAngle = mix(Math.PI * 0.12, Math.PI * 0.21, randomValue());
      weatherCount = Math.round(mix(5, 8, randomValue()) * (0.86 + intensity * 0.15));
      cometBias = mix(0.34, 0.56, randomValue());
      break;
    case "sparse-rain":
    default:
      weatherAngle = mix(Math.PI * 0.24, Math.PI * 0.33, randomValue());
      weatherCount = Math.round(mix(5, 8, randomValue()) * (0.8 + intensity * 0.12));
      cometBias = mix(0.18, 0.32, randomValue());
      break;
  }

  let starCount = Math.round(mix(48, 90, randomValue()) * variantBoost);
  if (celestialMode !== "none") starCount -= 6;
  if (skyFeatures.includes("constellation")) starCount += 6;
  if (terrainStyle === "dunes") starCount += 4;

  return {
    seed,
    theme,
    accentTheme,
    intensity,
    skyDrift: mix(0.05, 0.1, randomValue()),
    pulseSpeed: mix(1.1, 2.2, randomValue()),
    weatherAngle,
    weatherCount: clamp(weatherCount, 4, 10),
    cometBias: clamp(cometBias + (variant === "neon" ? 0.04 : 0), 0.16, 0.92),
    starCount: clamp(starCount, 38, 104),
    shipCount:
      shipPack === "none"
        ? 0
        : shipPack === "barge" || shipPack === "frigate"
          ? 1
          : 1 + (chance(randomValue, variant === "neon" || shipPack === "probe" || shipPack === "wisp" ? 0.56 : 0.3) ? 1 : 0),
    horizonCount: Math.round(mix(4, 8, randomValue())) + Math.max(0, horizonSpriteIds.length - 1),
    terrainStyle,
    weatherMode,
    celestialMode,
    shipPack,
    satelliteSpriteIds,
    horizonSpriteIds,
    skyFeatures,
    terrainLayers,
  };
}

export function makeWeatherParticle(
  randomValue: () => number,
  width: number,
  height: number,
  pixelSize: number,
  scene: SceneConfig
): WeatherParticle {
  const weatherSpread = Math.max(width, height) * 0.72;
  const kind: WeatherKind = randomValue() > 1 - scene.cometBias ? "comet" : "rain";

  let cometSpeedMin = 180;
  let cometSpeedMax = 320;
  let cometLengthMin = 72;
  let cometLengthMax = 156;
  let rainSpeedMin = 110;
  let rainSpeedMax = 190;
  let rainLengthMin = 12;
  let rainLengthMax = 26;

  switch (scene.weatherMode) {
    case "comet-field":
      cometSpeedMin = 140;
      cometSpeedMax = 240;
      cometLengthMin = 108;
      cometLengthMax = 198;
      rainSpeedMin = 90;
      rainSpeedMax = 130;
      rainLengthMin = 10;
      rainLengthMax = 18;
      break;
    case "meteor-shower":
      cometSpeedMin = 240;
      cometSpeedMax = 420;
      cometLengthMin = 94;
      cometLengthMax = 178;
      rainSpeedMin = 130;
      rainSpeedMax = 220;
      rainLengthMin = 12;
      rainLengthMax = 22;
      break;
    case "crosswind":
      cometSpeedMin = 170;
      cometSpeedMax = 300;
      cometLengthMin = 84;
      cometLengthMax = 144;
      rainSpeedMin = 120;
      rainSpeedMax = 200;
      rainLengthMin = 10;
      rainLengthMax = 18;
      break;
    case "sparse-rain":
    default:
      break;
  }

  return {
    kind,
    x: randomValue() * (width + weatherSpread) - weatherSpread * 0.35,
    y: -height * mix(0.08, 0.72, randomValue()),
    speed: kind === "comet"
      ? mix(cometSpeedMin, cometSpeedMax, randomValue()) * scene.intensity
      : mix(rainSpeedMin, rainSpeedMax, randomValue()) * scene.intensity,
    length: kind === "comet"
      ? mix(cometLengthMin, cometLengthMax, randomValue()) * pixelSize
      : mix(rainLengthMin, rainLengthMax, randomValue()) * pixelSize,
    size: pixelSize * (
      kind === "comet"
        ? mix(1.15, 2.25, randomValue())
        : mix(0.6, 0.92, randomValue())
    ),
    alpha: kind === "comet"
      ? mix(0.24, 0.44, randomValue())
      : mix(0.06, 0.14, randomValue()),
    phase: randomValue() * Math.PI * 2,
    angleOffset: kind === "comet"
      ? mix(-0.035, 0.035, randomValue())
      : mix(-0.05, 0.05, randomValue()),
    paletteMix: randomValue(),
  };
}

export function makeShip(
  randomValue: () => number,
  width: number,
  height: number,
  pixelSize: number,
  scene: SceneConfig
): Ship {
  const pack = scene.shipPack === "none" ? pick(randomValue, WORLD_THEMES[scene.theme].shipPacks) : scene.shipPack;
  const spec = SHIP_SPRITES[pack];
  const direction = randomValue() > 0.5 ? 1 : -1;
  const size = pixelSize * mix(spec.sizeRange[0], spec.sizeRange[1], randomValue());
  const spriteWidth = spec.sprite[0].length * size;

  return {
    x: direction === 1 ? -spriteWidth - randomValue() * width * 0.24 : width + randomValue() * width * 0.24,
    y: height * mix(0.16, 0.46, randomValue()),
    speed: mix(spec.speedRange[0], spec.speedRange[1], randomValue()) * (0.84 + scene.intensity * 0.22),
    size,
    alpha: mix(0.54, 0.84, randomValue()),
    phase: randomValue() * Math.PI * 2,
    paletteMix: randomValue(),
    direction,
    pack,
    trailLength: mix(spec.trailRange[0], spec.trailRange[1], randomValue()) * pixelSize,
  };
}

export function makeCelestials(
  randomValue: () => number,
  width: number,
  height: number,
  scene: SceneConfig
): CelestialBody[] {
  const bodies: CelestialBody[] = [];
  const baseX = width * mix(0.18, 0.82, randomValue());
  const baseY = height * mix(0.12, 0.28, randomValue());
  const sizeBase = Math.min(width, height);

  if (scene.celestialMode === "none") return bodies;

  if (scene.celestialMode === "moon") {
    bodies.push({
      x: baseX,
      y: baseY,
      radius: sizeBase * mix(0.035, 0.07, randomValue()),
      alpha: mix(0.18, 0.34, randomValue()),
      paletteMix: randomValue(),
      phase: randomValue() * Math.PI * 2,
      kind: "moon",
      ringTilt: 0,
      shadowOffset: mix(0.18, 0.32, randomValue()),
      bandCount: 0,
    });
  }

  if (scene.celestialMode === "twin-moons") {
    const radiusA = sizeBase * mix(0.028, 0.052, randomValue());
    const radiusB = radiusA * mix(0.55, 0.82, randomValue());
    bodies.push({
      x: baseX,
      y: baseY,
      radius: radiusA,
      alpha: mix(0.16, 0.28, randomValue()),
      paletteMix: randomValue(),
      phase: randomValue() * Math.PI * 2,
      kind: "moon",
      ringTilt: 0,
      shadowOffset: mix(0.16, 0.3, randomValue()),
      bandCount: 0,
    });
    bodies.push({
      x: baseX + radiusA * mix(1.8, 2.7, randomValue()),
      y: baseY + radiusA * mix(-0.35, 0.35, randomValue()),
      radius: radiusB,
      alpha: mix(0.12, 0.22, randomValue()),
      paletteMix: randomValue(),
      phase: randomValue() * Math.PI * 2,
      kind: "moon",
      ringTilt: 0,
      shadowOffset: mix(0.14, 0.28, randomValue()),
      bandCount: 0,
    });
  }

  if (scene.celestialMode === "ringed-planet") {
    bodies.push({
      x: baseX,
      y: baseY,
      radius: sizeBase * mix(0.046, 0.086, randomValue()),
      alpha: mix(0.16, 0.28, randomValue()),
      paletteMix: randomValue(),
      phase: randomValue() * Math.PI * 2,
      kind: "ringed",
      ringTilt: mix(-0.4, 0.4, randomValue()),
      shadowOffset: mix(0.14, 0.26, randomValue()),
      bandCount: 0,
    });
  }

  if (scene.celestialMode === "gas-giant") {
    bodies.push({
      x: baseX,
      y: baseY,
      radius: sizeBase * mix(0.06, 0.1, randomValue()),
      alpha: mix(0.14, 0.24, randomValue()),
      paletteMix: randomValue(),
      phase: randomValue() * Math.PI * 2,
      kind: "giant",
      ringTilt: 0,
      shadowOffset: mix(0.12, 0.22, randomValue()),
      bandCount: 3 + Math.floor(randomValue() * 3),
    });
  }

  return bodies;
}

export function makeConstellations(
  randomValue: () => number,
  width: number,
  height: number
): Constellation[] {
  const count = 1 + (chance(randomValue, 0.42) ? 1 : 0);
  const constellations: Constellation[] = [];

  for (let i = 0; i < count; i++) {
    const centerX = width * mix(0.16, 0.84, randomValue());
    const centerY = height * mix(0.12, 0.38, randomValue());
    const pointCount = 3 + Math.floor(randomValue() * 3);
    const points = Array.from({ length: pointCount }, () => ({
      x: centerX + mix(-width * 0.08, width * 0.08, randomValue()),
      y: centerY + mix(-height * 0.06, height * 0.06, randomValue()),
    })).sort((a, b) => a.x - b.x);

    constellations.push({
      points,
      alpha: mix(0.12, 0.22, randomValue()),
      paletteMix: randomValue(),
      phase: randomValue() * Math.PI * 2,
    });
  }

  return constellations;
}

export function makeSatellite(
  randomValue: () => number,
  width: number,
  height: number,
  pixelSize: number,
  scene: SceneConfig
): Satellite {
  const spriteId = pick(randomValue, scene.satelliteSpriteIds.length > 0 ? scene.satelliteSpriteIds : WORLD_THEMES[scene.theme].satelliteSprites);
  const spec = SATELLITE_SPRITES[spriteId];
  const direction = randomValue() > 0.5 ? 1 : -1;
  const size = pixelSize * mix(spec.sizeRange[0], spec.sizeRange[1], randomValue());
  const spriteWidth = spec.sprite[0].length * size;

  return {
    x: direction === 1 ? -spriteWidth - randomValue() * width * 0.16 : width + randomValue() * width * 0.16,
    y: height * mix(0.1, 0.34, randomValue()),
    speed: mix(spec.speedRange[0], spec.speedRange[1], randomValue()) * (0.8 + scene.intensity * 0.18),
    size,
    alpha: mix(0.38, 0.62, randomValue()),
    phase: randomValue() * Math.PI * 2,
    paletteMix: randomValue(),
    direction,
    spriteId,
  };
}

export function makeSkyTrails(
  randomValue: () => number,
  width: number,
  height: number,
  scene: SceneConfig
): SkyTrail[] {
  const trails: SkyTrail[] = [];

  if (scene.skyFeatures.includes("data-arc")) {
    trails.push({
      kind: "arc",
      x: width * mix(0.22, 0.78, randomValue()),
      y: height * mix(0.12, 0.24, randomValue()),
      radius: Math.min(width, height) * mix(0.12, 0.24, randomValue()),
      start: mix(Math.PI * 1.12, Math.PI * 1.28, randomValue()),
      end: mix(Math.PI * 1.72, Math.PI * 1.88, randomValue()),
      stepX: 0,
      stepY: 0,
      segments: 16 + Math.floor(randomValue() * 10),
      alpha: mix(0.08, 0.14, randomValue()) * (0.9 + scene.intensity * 0.08),
      paletteMix: randomValue(),
      phase: randomValue() * Math.PI * 2,
    });
  }

  if (scene.skyFeatures.includes("signal-ladder")) {
    trails.push({
      kind: "ladder",
      x: width * mix(0.12, 0.78, randomValue()),
      y: height * mix(0.16, 0.34, randomValue()),
      radius: 0,
      start: 0,
      end: 0,
      stepX: mix(8, 18, randomValue()),
      stepY: mix(2, 8, randomValue()) * (randomValue() > 0.5 ? 1 : -1),
      segments: 10 + Math.floor(randomValue() * 8),
      alpha: mix(0.08, 0.16, randomValue()) * (0.88 + scene.intensity * 0.08),
      paletteMix: randomValue(),
      phase: randomValue() * Math.PI * 2,
    });
  }

  return trails;
}

export function makeHorizonProps(
  randomValue: () => number,
  width: number,
  scene: SceneConfig
): HorizonProp[] {
  const props: HorizonProp[] = [];
  const count = Math.max(3, scene.horizonCount);
  const spacing = width * 0.84 / count;

  for (let i = 0; i < count; i++) {
    const spriteId = scene.horizonSpriteIds[i % scene.horizonSpriteIds.length];
    const spec = HORIZON_SPRITES[spriteId];
    const layerIndex = clamp(
      scene.terrainLayers.length - 1 - spec.layerBias - (chance(randomValue, 0.2) ? 1 : 0),
      0,
      scene.terrainLayers.length - 1
    );

    props.push({
      spriteId,
      x: width * 0.08 + spacing * i + mix(-spacing * 0.28, spacing * 0.28, randomValue()),
      alpha: mix(0.18, 0.34, randomValue()),
      phase: randomValue() * Math.PI * 2,
      paletteMix: randomValue(),
      layerIndex,
      scale: mix(spec.scaleRange[0], spec.scaleRange[1], randomValue()),
    });
  }

  return props;
}

export function createSceneAssets(width: number, height: number, config: SceneConfig): SceneAssets {
  const pixelSize = width < 768 ? 2 : 3;
  const randomValue = createRng(config.seed ^ 0x9e3779b9);
  const stars: Star[] = [];
  const weather: WeatherParticle[] = [];
  const ships: Ship[] = [];

  for (let i = 0; i < config.starCount; i++) {
    stars.push({
      x: randomValue() * width,
      y: Math.pow(randomValue(), 1.35) * height * 0.62,
      size: pixelSize * (chance(randomValue, 0.16) ? 2 : 1),
      alpha: mix(0.18, 0.72, randomValue()),
      twinkle: mix(0.7, 2.1, randomValue()),
      phase: randomValue() * Math.PI * 2,
      paletteMix: randomValue(),
    });
  }

  for (let i = 0; i < config.weatherCount; i++) {
    weather.push(makeWeatherParticle(randomValue, width, height, pixelSize, config));
  }

  for (let i = 0; i < config.shipCount; i++) {
    ships.push(makeShip(randomValue, width, height, pixelSize, config));
  }

  return {
    pixelSize,
    stars,
    weather,
    ships,
    celestials: makeCelestials(randomValue, width, height, config),
    constellations: config.skyFeatures.includes("constellation")
      ? makeConstellations(randomValue, width, height)
      : [],
    satellites: config.skyFeatures.includes("satellite")
      ? Array.from({ length: 1 + (chance(randomValue, 0.28) ? 1 : 0) }, () =>
          makeSatellite(randomValue, width, height, pixelSize, config)
        )
      : [],
    skyTrails: makeSkyTrails(randomValue, width, height, config),
    horizonProps: makeHorizonProps(randomValue, width, config),
  };
}
