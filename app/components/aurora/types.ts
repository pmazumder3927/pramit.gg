export type VisualVariant = "neon" | "glassy" | "minimal" | "accent";
export type Rgb = [number, number, number];
export type Noise2D = (x: number, y: number) => number;
export type ShipDirection = -1 | 1;
export type TerrainStyle = "ridges" | "mesas" | "dunes" | "crags";
export type WeatherMode = "sparse-rain" | "comet-field" | "meteor-shower" | "crosswind";
export type WeatherKind = "rain" | "comet";
export type CelestialMode = "none" | "moon" | "twin-moons" | "ringed-planet" | "gas-giant";
export type ShipPackId =
  | "runner"
  | "barge"
  | "probe"
  | "diamond"
  | "manta"
  | "frigate"
  | "shuttle"
  | "wisp"
  | "skiff"
  | "hauler"
  | "spire";
export type ShipPack = ShipPackId | "none";
export type SatelliteSpriteId =
  | "relay"
  | "dish"
  | "kite"
  | "shard"
  | "lantern"
  | "solar"
  | "drifter"
  | "cluster";
export type HorizonSpriteId =
  | "relay_spire"
  | "dish_array"
  | "signal_gate"
  | "antenna_tripod"
  | "monolith_gate"
  | "citadel_wall"
  | "ruin_arch"
  | "buried_dome"
  | "crystal_fan"
  | "crystal_pylon"
  | "refinery_stack"
  | "quarry_rig"
  | "shrine_gate"
  | "lantern_spires"
  | "dock_towers"
  | "orbital_lift"
  | "vault_steps"
  | "scanner_grid"
  | "wave_temple"
  | "bone_field";
export type SkyFeature = "constellation" | "satellite" | "data-arc" | "signal-ladder";
export type WorldThemeId =
  | "relay"
  | "citadel"
  | "sanctum"
  | "quarry"
  | "reef"
  | "graveyard"
  | "harbor"
  | "watchtower"
  | "catacomb"
  | "mirage";
export type CelestialKind = "moon" | "ringed" | "giant";
export type SpriteDefinition = string[];

export interface TerrainLayer {
  amplitude: number;
  baseY: number;
  frequency: number;
  detail: number;
  opacity: number;
  lineOpacity: number;
}

export interface WeatherParticle {
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

export interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
  twinkle: number;
  phase: number;
  paletteMix: number;
}

export interface Ship {
  x: number;
  y: number;
  speed: number;
  size: number;
  alpha: number;
  phase: number;
  paletteMix: number;
  direction: ShipDirection;
  pack: ShipPackId;
  trailLength: number;
}

export interface CelestialBody {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  paletteMix: number;
  phase: number;
  kind: CelestialKind;
  ringTilt: number;
  shadowOffset: number;
  bandCount: number;
}

export interface Constellation {
  points: Array<{ x: number; y: number }>;
  alpha: number;
  paletteMix: number;
  phase: number;
}

export interface Satellite {
  x: number;
  y: number;
  speed: number;
  size: number;
  alpha: number;
  phase: number;
  paletteMix: number;
  direction: ShipDirection;
  spriteId: SatelliteSpriteId;
}

export interface SkyTrail {
  kind: "arc" | "ladder";
  x: number;
  y: number;
  radius: number;
  start: number;
  end: number;
  stepX: number;
  stepY: number;
  segments: number;
  alpha: number;
  paletteMix: number;
  phase: number;
}

export interface HorizonProp {
  x: number;
  alpha: number;
  phase: number;
  paletteMix: number;
  layerIndex: number;
  scale: number;
  spriteId: HorizonSpriteId;
}

export interface SceneAssets {
  pixelSize: number;
  stars: Star[];
  weather: WeatherParticle[];
  ships: Ship[];
  celestials: CelestialBody[];
  constellations: Constellation[];
  satellites: Satellite[];
  skyTrails: SkyTrail[];
  horizonProps: HorizonProp[];
  terrainPaths: Path2D[];
  horizonGroundY: number[];
}

export interface SceneConfig {
  seed: number;
  theme: WorldThemeId;
  accentTheme: WorldThemeId | null;
  intensity: number;
  skyDrift: number;
  pulseSpeed: number;
  weatherAngle: number;
  weatherCount: number;
  cometBias: number;
  starCount: number;
  shipCount: number;
  horizonCount: number;
  terrainStyle: TerrainStyle;
  weatherMode: WeatherMode;
  celestialMode: CelestialMode;
  shipPack: ShipPack;
  satelliteSpriteIds: SatelliteSpriteId[];
  horizonSpriteIds: HorizonSpriteId[];
  skyFeatures: SkyFeature[];
  terrainLayers: TerrainLayer[];
}

export interface Palette {
  accent: Rgb;
  cyan: Rgb;
  magenta: Rgb;
  warm: Rgb;
  haze: Rgb;
  star: Rgb;
  terrain: Rgb;
  signal: Rgb;
  deep: Rgb;
}

export interface ShipSpriteSpec {
  sprite: SpriteDefinition;
  sizeRange: [number, number];
  speedRange: [number, number];
  trailRange: [number, number];
}

export interface SatelliteSpriteSpec {
  sprite: SpriteDefinition;
  sizeRange: [number, number];
  speedRange: [number, number];
}

export interface HorizonSpriteSpec {
  sprite: SpriteDefinition;
  scaleRange: [number, number];
  layerBias: number;
}

export interface ThemeDefinition {
  terrainStyles: TerrainStyle[];
  weatherModes: WeatherMode[];
  celestialModes: CelestialMode[];
  shipPacks: ShipPackId[];
  satelliteSprites: SatelliteSpriteId[];
  horizonSprites: HorizonSpriteId[];
  skyFeatures: SkyFeature[];
}

export interface DrawState {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  scene: SceneConfig;
  assets: SceneAssets;
  palette: Palette;
  terrainNoise: Noise2D;
  spawnRandom: () => number;
  timeSeconds: number;
  deltaSeconds: number;
  skyTime: number;
}
