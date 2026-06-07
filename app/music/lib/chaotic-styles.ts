// Seeded random for consistent chaos across renders
export function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return Math.round((x - Math.floor(x)) * 100) / 100;
}

export type CardVariant =
  | "default"
  | "glassy"
  | "neon"
  | "brutalist"
  | "inverted"
  | "outlined"
  | "accent";

export interface ChaoticStyle {
  rotation: number;
  offsetX: number;
  offsetY: number;
  variant: CardVariant;
  scale: number;
}

export function generateChaoticStyle(index: number): ChaoticStyle {
  const seed = index * 7919;

  const rotation = (seededRandom(seed + 1) * 8 - 4) * 0.6;
  const offsetX = (seededRandom(seed + 2) * 30 - 15) * 0.4;
  const offsetY = (seededRandom(seed + 3) * 20 - 10) * 0.4;
  const scale = 0.98 + seededRandom(seed + 4) * 0.04;

  const variantRoll = seededRandom(seed + 5);
  let variant: CardVariant;
  if (variantRoll > 0.88) {
    variant = "neon";
  } else if (variantRoll > 0.76) {
    variant = "brutalist";
  } else if (variantRoll > 0.62) {
    variant = "inverted";
  } else if (variantRoll > 0.48) {
    variant = "glassy";
  } else if (variantRoll > 0.32) {
    variant = "outlined";
  } else if (variantRoll > 0.18) {
    variant = "accent";
  } else {
    variant = "default";
  }

  return { rotation, offsetX, offsetY, variant, scale };
}

// Get variant styles based on accent color.
// All variants render as warm "sketch cards" that read in both light + dark.
// The album-derived accentColor is used only as a personal tint, never as the
// card surface, so contrast holds regardless of theme.
export function getVariantStyles(variant: CardVariant, accentColor: string) {
  const rgb = hexToRgb(accentColor);
  const rgbaTint = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.10)`;
  const rgbaTintHover = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18)`;
  const rgbaBorder = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`;

  // Shared sketchbook surface: warm raised card on paper, ink-wash border.
  const paperShadow = "2px 5px 16px -6px rgb(var(--fg) / 0.30)";
  const paperShadowHover = "6px 12px 30px -10px rgb(var(--fg) / 0.32)";

  switch (variant) {
    case "neon":
      // accent-outlined card — uses the album tint as a hand-drawn ring
      return {
        bg: "bg-card",
        border: `border-2`,
        borderColor: rgbaBorder,
        shadow: `0 0 0 1px ${rgbaTint}, ${paperShadow}`,
        hoverShadow: `0 0 0 1px ${rgbaTintHover}, ${paperShadowHover}`,
      };
    case "brutalist":
      // bold offset-shadow card, still on warm paper with an ink border
      return {
        bg: "bg-card",
        border: "border-2 border-line",
        shadow: "5px 5px 0 0 rgb(var(--line))",
        hoverShadow: "8px 8px 0 0 rgb(var(--accent-orange) / 0.55)",
      };
    case "inverted":
      // contrast card — the alternate paper surface
      return {
        bg: "bg-paper-2",
        border: "border border-line",
        shadow: paperShadow,
        hoverShadow: paperShadowHover,
      };
    case "glassy":
      return {
        bg: "bg-card/70 backdrop-blur-sm",
        border: "border border-line",
        shadow: paperShadow,
        hoverShadow: paperShadowHover,
      };
    case "outlined":
      // sketchy dashed card — very "notebook"
      return {
        bg: "bg-paper-2/50",
        border: "border-2 border-dashed border-line",
        shadow: "",
        hoverShadow: paperShadowHover,
      };
    case "accent":
      return {
        bg: "bg-card",
        bgGradient: `linear-gradient(135deg, ${rgbaTint}, transparent 55%, rgba(124, 119, 198, 0.12))`,
        border: "border border-line",
        shadow: paperShadow,
        hoverShadow: `0 18px 44px -16px ${rgbaTintHover}`,
      };
    default:
      return {
        bg: "bg-card",
        border: "border border-line",
        shadow: paperShadow,
        hoverShadow: paperShadowHover,
      };
  }
}

// Convert hex to RGB
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 255, g: 107, b: 61 }; // fallback to accent-orange
}

// Determine if color is light or dark
export function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5;
}

// Generate complementary color
export function getComplementaryColor(hex: string): string {
  const rgb = hexToRgb(hex);
  return `#${(255 - rgb.r).toString(16).padStart(2, "0")}${(255 - rgb.g).toString(16).padStart(2, "0")}${(255 - rgb.b).toString(16).padStart(2, "0")}`;
}

// Adjust color brightness
export function adjustBrightness(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  const adjust = (c: number) =>
    Math.min(255, Math.max(0, Math.round(c + (255 * percent) / 100)));
  return `#${adjust(rgb.r).toString(16).padStart(2, "0")}${adjust(rgb.g).toString(16).padStart(2, "0")}${adjust(rgb.b).toString(16).padStart(2, "0")}`;
}
