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

// Get variant styles based on accent color
export function getVariantStyles(variant: CardVariant, accentColor: string) {
  const rgb = hexToRgb(accentColor);
  const rgbaLight = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`;
  const rgbaMed = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`;

  switch (variant) {
    case "neon":
      return {
        bg: "bg-void-black",
        border: `border-2`,
        borderColor: accentColor,
        shadow: `0 0 20px ${rgbaLight}`,
        hoverShadow: `0 0 30px ${rgbaMed}`,
      };
    case "brutalist":
      return {
        bg: "",
        bgColor: accentColor,
        textColor: "#000",
        border: "border-4 border-black",
        shadow: "8px 8px 0px 0px rgba(0,0,0,1)",
        hoverShadow: "12px 12px 0px 0px rgba(0,0,0,1)",
      };
    case "inverted":
      return {
        bg: "bg-white",
        textColor: "#000",
        border: "border-2 border-black",
        shadow: "6px 6px 0px 0px rgba(0,0,0,1)",
        hoverShadow: "10px 10px 0px 0px rgba(0,0,0,1)",
      };
    case "glassy":
      return {
        bg: "bg-white/10",
        border: "border border-white/20",
        shadow: "",
        hoverShadow: "",
      };
    case "outlined":
      return {
        bg: "bg-transparent",
        border: "border-2 border-dashed border-white/30",
        shadow: "",
        hoverShadow: "",
      };
    case "accent":
      return {
        bg: "",
        bgGradient: `linear-gradient(135deg, ${rgbaLight}, transparent, rgba(124, 119, 198, 0.2))`,
        border: "border border-white/10",
        shadow: "",
        hoverShadow: `0 25px 50px -12px ${rgbaLight}`,
      };
    default:
      return {
        bg: "bg-gradient-to-br from-charcoal-black/95 via-charcoal-black/80 to-void-black/95",
        border: "border border-white/5",
        shadow: "",
        hoverShadow: "",
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
