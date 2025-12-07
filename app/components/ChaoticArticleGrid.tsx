"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
} from "motion/react";
import { Post, analyzeContent } from "@/app/lib/supabase";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import Image from "next/image";

interface ChaoticArticleGridProps {
  posts: Post[];
}

// Apple-style search with subtle personality
function ChaoticSearch({
  value,
  onChange,
  resultCount,
  totalCount,
}: {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <motion.div
      className="flex justify-center mb-6 md:mb-12 px-2 md:px-0"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <motion.div
        className={`
          relative w-full max-w-xs md:max-w-sm transition-all duration-500 ease-out
          ${isFocused ? "max-w-sm md:max-w-md" : ""}
        `}
      >
        {/* Main search container */}
        <motion.div
          className={`
            relative flex items-center gap-2.5 md:gap-3 px-4 md:px-5 py-2.5 md:py-3 rounded-full
            transition-all duration-300
            ${
              isFocused
                ? "bg-white/[0.18] shadow-xl shadow-black/20 ring-1 ring-white/25"
                : "bg-white/[0.12] ring-1 ring-white/[0.12] hover:bg-white/[0.15] hover:ring-white/[0.18]"
            }
          `}
          animate={{
            scale: isFocused ? 1.02 : 1,
          }}
          transition={{ duration: 0.2 }}
        >
          {/* Search icon */}
          <motion.svg
            className={`w-4 h-4 md:w-5 md:h-5 flex-shrink-0 transition-colors duration-300 ${
              isFocused ? "text-white/80" : "text-white/50"
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            animate={{
              scale: isFocused ? 1.05 : 1,
            }}
            transition={{ duration: 0.2 }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </motion.svg>

          {/* Input */}
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Search"
            className="flex-1 bg-transparent text-white/90 text-sm md:text-base placeholder-white/40 outline-none min-w-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />

          {/* Result count - minimal pill */}
          <AnimatePresence mode="wait">
            {value && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8, x: 10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: 10 }}
                transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                className={`
                  text-xs font-medium tabular-nums px-2 py-0.5 rounded-full flex-shrink-0
                  ${
                    resultCount === 0
                      ? "text-white/40 bg-white/[0.06]"
                      : "text-white/60 bg-white/[0.08]"
                  }
                `}
              >
                {resultCount}
              </motion.span>
            )}
          </AnimatePresence>

          {/* Clear button */}
          <AnimatePresence>
            {value && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                onClick={() => onChange("")}
                className="flex-shrink-0 p-0.5 rounded-full hover:bg-white/10 transition-colors"
              >
                <svg
                  className="w-3.5 h-3.5 text-white/40 hover:text-white/60 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </motion.button>
            )}
          </AnimatePresence>

          {/* Subtle accent line on focus */}
          <motion.div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
            initial={{ width: 0, opacity: 0 }}
            animate={{
              width: isFocused ? "60%" : "0%",
              opacity: isFocused ? 1 : 0,
            }}
            transition={{ duration: 0.3 }}
          />
        </motion.div>

        {/* Keyboard hint - shows on focus */}
        <AnimatePresence>
          {isFocused && !value && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-white/25 text-xs"
            >
              <span>try</span>
              <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-white/35 font-mono text-[10px]">
                robot
              </span>
              <span>or</span>
              <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-white/35 font-mono text-[10px]">
                physics
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// Seeded random for consistent chaos across renders
// Round to 2 decimal places to avoid hydration mismatches
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return Math.round((x - Math.floor(x)) * 100) / 100;
}

// Card size variants
type CardSize =
  | "massive"
  | "hero"
  | "large"
  | "medium"
  | "small"
  | "tiny"
  | "micro";

interface CardStyle {
  size: CardSize;
  rotation: number;
  offsetX: number;
  offsetY: number;
  zIndex: number;
  variant:
    | "default"
    | "outlined"
    | "glassy"
    | "accent"
    | "inverted"
    | "brutalist"
    | "neon"
    | "torn";
  floatDelay: number;
  floatIntensity: number;
  skewX: number;
  skewY: number;
}

function generateCardStyle(index: number, totalPosts: number): CardStyle {
  const seed = index * 7919;

  // More varied sizes
  const sizeRoll = seededRandom(seed + 1);
  let size: CardSize;
  if (index === 0) {
    size = "massive";
  } else if (sizeRoll > 0.92) {
    size = "massive";
  } else if (sizeRoll > 0.8) {
    size = "hero";
  } else if (sizeRoll > 0.6) {
    size = "large";
  } else if (sizeRoll > 0.4) {
    size = "medium";
  } else if (sizeRoll > 0.2) {
    size = "small";
  } else if (sizeRoll > 0.08) {
    size = "tiny";
  } else {
    size = "micro";
  }

  // MORE EXTREME rotations (-12 to 12 degrees)
  const rotationIntensity = size === "micro" || size === "tiny" ? 2 : 1;
  const rotation = (seededRandom(seed + 2) * 24 - 12) * rotationIntensity;

  // BIGGER offsets for breaking grid
  const offsetMultiplier =
    size === "small" || size === "tiny" || size === "micro" ? 2.5 : 1.5;
  const offsetX = (seededRandom(seed + 3) * 60 - 30) * offsetMultiplier;
  const offsetY = (seededRandom(seed + 4) * 50 - 25) * offsetMultiplier;

  // More dramatic z-index spread
  const zIndex = Math.floor(seededRandom(seed + 5) * 15) + 1;

  // More variant options
  const variantRoll = seededRandom(seed + 6);
  let variant: CardStyle["variant"];
  if (variantRoll > 0.92) {
    variant = "torn";
  } else if (variantRoll > 0.84) {
    variant = "neon";
  } else if (variantRoll > 0.76) {
    variant = "brutalist";
  } else if (variantRoll > 0.65) {
    variant = "inverted";
  } else if (variantRoll > 0.52) {
    variant = "accent";
  } else if (variantRoll > 0.38) {
    variant = "glassy";
  } else if (variantRoll > 0.22) {
    variant = "outlined";
  } else {
    variant = "default";
  }

  // Floating animation params
  const floatDelay = seededRandom(seed + 7) * 5;
  const floatIntensity = 3 + seededRandom(seed + 8) * 8;

  // Skew for extra chaos
  const skewX = seededRandom(seed + 9) * 6 - 3;
  const skewY = seededRandom(seed + 10) * 4 - 2;

  return {
    size,
    rotation,
    offsetX,
    offsetY,
    zIndex,
    variant,
    floatDelay,
    floatIntensity,
    skewX,
    skewY,
  };
}

function ChaoticCard({
  post,
  index,
  style,
  mouseX,
  mouseY,
  isFiltered,
}: {
  post: Post;
  index: number;
  style: CardStyle;
  mouseX: ReturnType<typeof useMotionValue<number>>;
  mouseY: ReturnType<typeof useMotionValue<number>>;
  isFiltered?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Memoize content analysis to avoid recalculating on every render
  const contentAnalysis = useMemo(
    () => analyzeContent(post.content || ""),
    [post.content]
  );

  // Random exit direction for dramatic effect
  const exitDirection = useMemo(
    () => ({
      x: (seededRandom(index * 1234) - 0.5) * 500,
      y: (seededRandom(index * 5678) - 0.5) * 400,
      rotate: (seededRandom(index * 9012) - 0.5) * 180,
    }),
    [index]
  );

  // Parallax based on mouse position - more intense
  const parallaxStrength =
    style.size === "massive"
      ? 25
      : style.size === "hero"
      ? 20
      : style.size === "large"
      ? 15
      : 10;
  const x = useTransform(mouseX, [0, 1], [-parallaxStrength, parallaxStrength]);
  const y = useTransform(mouseY, [0, 1], [-parallaxStrength, parallaxStrength]);
  const springX = useSpring(x, { stiffness: 100, damping: 15 });
  const springY = useSpring(y, { stiffness: 100, damping: 15 });

  // Mobile: 2 cols, Tablet: 4 cols, Desktop: 5-6 cols
  // Only massive spans full width on mobile to avoid tower stacking
  const sizeClasses: Record<CardSize, string> = {
    massive:
      "col-span-2 row-span-2 md:col-span-3 md:row-span-3 lg:col-span-2 xl:col-span-3",
    hero: "col-span-1 row-span-2 md:col-span-2 md:row-span-2 lg:col-span-2",
    large: "col-span-1 row-span-2 md:col-span-2 md:row-span-2",
    medium: "col-span-1 row-span-1 md:col-span-1 md:row-span-2",
    small: "col-span-1 row-span-1",
    tiny: "col-span-1 row-span-1",
    micro: "col-span-1 row-span-1",
  };

  const getVariantStyles = () => {
    switch (style.variant) {
      case "inverted":
        return {
          bg: "bg-white text-void-black",
          border: "border-2 border-black",
          shadow: "shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]",
        };
      case "brutalist":
        return {
          bg: "bg-accent-yellow text-void-black",
          border: "border-4 border-black",
          shadow: "shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]",
        };
      case "neon":
        return {
          bg: "bg-void-black",
          border: `border-2`,
          shadow: `shadow-[0_0_20px_${post.accent_color}40,0_0_40px_${post.accent_color}20,inset_0_0_20px_${post.accent_color}10]`,
          borderColor: post.accent_color,
        };
      case "torn":
        return {
          bg: "bg-gradient-to-br from-stone-100 to-stone-200 text-void-black",
          border: "border-0",
          shadow: "shadow-2xl",
          clipPath: "polygon(2% 0%, 98% 2%, 100% 96%, 3% 100%)",
        };
      case "accent":
        return {
          bg: `bg-gradient-to-br from-charcoal-black via-void-black to-charcoal-black`,
          border: "border border-white/10",
          shadow: "shadow-xl",
        };
      case "glassy":
        return {
          bg: "bg-white/10", // Removed backdrop-blur for performance
          border: "border border-white/20",
          shadow: "shadow-xl shadow-black/20",
        };
      case "outlined":
        return {
          bg: "bg-transparent",
          border: "border-2 border-dashed border-white/30",
          shadow: "",
        };
      default:
        return {
          bg: "bg-gradient-to-br from-charcoal-black/95 via-charcoal-black/80 to-void-black/95",
          border: "border border-white/5",
          shadow: "shadow-lg shadow-black/30",
        };
    }
  };

  const variantStyles = getVariantStyles();
  const isDark = !["inverted", "brutalist", "torn"].includes(style.variant);
  const textColor = isDark ? "text-white" : "text-void-black";
  const secondaryColor = isDark ? "text-gray-400" : "text-gray-600";

  const primaryImage = contentAnalysis.images[0];

  // Height classes - varied on mobile for visual interest
  const getHeightClass = () => {
    switch (style.size) {
      case "massive":
        return "min-h-[220px] md:min-h-[450px]";
      case "hero":
        return "min-h-[140px] md:min-h-[380px]";
      case "large":
        return "min-h-[180px] md:min-h-[320px]";
      case "medium":
        return "min-h-[120px] md:min-h-[260px]";
      case "small":
        return "min-h-[100px] md:min-h-[180px]";
      case "tiny":
        return "min-h-[85px] md:min-h-[140px]";
      case "micro":
        return "min-h-[70px] md:min-h-[100px]";
    }
  };

  return (
    <motion.div
      ref={cardRef}
      layoutId={`card-${post.id}`}
      className={`${sizeClasses[style.size]} relative will-change-transform`}
      style={{
        x: springX,
        y: springY,
        zIndex: isHovered ? 100 : style.zIndex,
      }}
      initial={{
        opacity: 0,
        scale: 0.3,
        rotate: style.rotation * 2,
      }}
      animate={{
        opacity: 1,
        scale: 1,
        rotate: style.rotation * 0.5,
        x: style.offsetX * 0.2,
        y: style.offsetY * 0.25,
        skewX: style.skewX * 0.4,
        skewY: style.skewY * 0.4,
      }}
      exit={{
        opacity: 0,
        scale: 0,
        x: exitDirection.x * 0.5,
        y: exitDirection.y * 0.5,
        rotate: exitDirection.rotate * 0.5,
        transition: {
          duration: 0.4,
          ease: [0.36, 0, 0.66, -0.56],
        },
      }}
      transition={{
        delay: isFiltered ? 0 : 0.03 + index * 0.04,
        duration: 0.6,
        ease: [0.34, 1.56, 0.64, 1],
        layout: { duration: 0.3, ease: [0.34, 1.56, 0.64, 1] },
      }}
      whileHover={{
        scale: 1.08,
        rotate: 0,
        skewX: 0,
        skewY: 0,
        zIndex: 100,
        transition: { duration: 0.25, ease: "easeOut" },
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Direct link - removed floating animation for performance */}
      <Link href={`/post/${post.slug}`} className="block h-full">
        <article
          className={`
              relative h-full overflow-hidden transition-all duration-300
              ${variantStyles.bg} ${variantStyles.border} ${
            variantStyles.shadow
          }
              ${
                style.size === "massive" || style.size === "hero"
                  ? "rounded-2xl md:rounded-3xl"
                  : ""
              }
              ${
                style.size === "large" || style.size === "medium"
                  ? "rounded-xl md:rounded-2xl"
                  : ""
              }
              ${
                style.size === "small" || style.size === "tiny"
                  ? "rounded-lg md:rounded-xl"
                  : ""
              }
              ${style.size === "micro" ? "rounded-lg" : ""}
              ${isHovered ? "shadow-2xl" : ""}
              ${getHeightClass()}
            `}
          style={{
            borderColor:
              style.variant === "neon" ? post.accent_color : undefined,
            clipPath:
              style.variant === "torn"
                ? "polygon(2% 0%, 98% 2%, 100% 96%, 3% 100%)"
                : undefined,
          }}
        >
          {/* Background Image for visual posts */}
          {primaryImage &&
            (style.size === "massive" ||
              style.size === "hero" ||
              style.size === "large") && (
              <div className="absolute inset-0">
                <Image
                  src={primaryImage}
                  alt={post.title}
                  fill
                  className={`object-cover transition-all duration-500 ${
                    isHovered ? "scale-110 opacity-60" : "opacity-30"
                  }`}
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-void-black via-void-black/70 to-transparent" />
              </div>
            )}

          {/* Static glow lines for neon variant - no animation for performance */}
          {style.variant === "neon" && (
            <>
              <div
                className="absolute top-0 left-0 right-0 h-px opacity-40"
                style={{ backgroundColor: post.accent_color }}
              />
              <div
                className="absolute bottom-0 left-0 right-0 h-px opacity-40"
                style={{ backgroundColor: post.accent_color }}
              />
            </>
          )}

          {/* Noise texture */}
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Brutalist corner accent */}
          {style.variant === "brutalist" && (
            <div
              className="absolute top-0 right-0 w-16 h-16 bg-accent-orange"
              style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }}
            />
          )}

          {/* Accent glow on hover - CSS only for performance */}
          <div
            className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
              isHovered ? "opacity-20" : "opacity-0"
            }`}
            style={{
              background: `radial-gradient(circle at 50% 50%, ${post.accent_color}, transparent 70%)`,
            }}
          />

          {/* Content */}
          <div
            className={`relative z-10 h-full flex flex-col ${
              style.size === "massive"
                ? "p-3 md:p-10"
                : style.size === "hero"
                ? "p-3 md:p-8"
                : style.size === "large"
                ? "p-2.5 md:p-6"
                : style.size === "medium"
                ? "p-2 md:p-5"
                : style.size === "small"
                ? "p-2 md:p-4"
                : style.size === "tiny"
                ? "p-1.5 md:p-3"
                : "p-1.5 md:p-2"
            }`}
          >
            {/* Type badge */}
            {style.size !== "micro" && (
              <div className="flex items-center gap-1 md:gap-2 mb-1 md:mb-3">
                <span
                  className={`text-[9px] md:text-xs px-1 md:px-2 py-0.5 rounded-full font-medium truncate max-w-[60px] md:max-w-none ${
                    isDark
                      ? "bg-white/10 border border-white/10"
                      : "bg-void-black/10 border border-void-black/20"
                  }`}
                  style={{ color: post.accent_color }}
                >
                  {post.type}
                </span>
                {(style.size === "massive" ||
                  style.size === "hero" ||
                  style.size === "large") && (
                  <span
                    className={`text-[10px] md:text-xs ${secondaryColor} hidden md:inline`}
                  >
                    {formatDistanceToNow(new Date(post.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                )}
              </div>
            )}

            {/* Title */}
            <h3
              className={`
                  font-semibold leading-tight mb-1 md:mb-2 ${textColor}
                  ${
                    style.size === "massive"
                      ? "text-base md:text-4xl lg:text-5xl line-clamp-3 md:line-clamp-none"
                      : ""
                  }
                  ${
                    style.size === "hero"
                      ? "text-sm md:text-3xl lg:text-4xl line-clamp-3 md:line-clamp-none"
                      : ""
                  }
                  ${
                    style.size === "large"
                      ? "text-sm md:text-2xl lg:text-3xl line-clamp-2 md:line-clamp-none"
                      : ""
                  }
                  ${
                    style.size === "medium"
                      ? "text-xs md:text-xl line-clamp-2"
                      : ""
                  }
                  ${
                    style.size === "small"
                      ? "text-xs md:text-lg line-clamp-2"
                      : ""
                  }
                  ${
                    style.size === "tiny"
                      ? "text-[11px] md:text-base line-clamp-2"
                      : ""
                  }
                  ${
                    style.size === "micro"
                      ? "text-[10px] md:text-sm line-clamp-2"
                      : ""
                  }
                `}
            >
              {post.title}
            </h3>

            {/* Preview text for larger cards */}
            {(style.size === "massive" ||
              style.size === "hero" ||
              style.size === "large" ||
              style.size === "medium") && (
              <p
                className={`
                  ${secondaryColor} leading-relaxed flex-grow
                  ${style.size === "massive" ? "text-xs md:text-lg line-clamp-2 md:line-clamp-4" : ""}
                  ${style.size === "hero" ? "text-xs md:text-base line-clamp-2 md:line-clamp-3" : ""}
                  ${style.size === "large" ? "text-xs md:text-sm line-clamp-2 md:line-clamp-3" : ""}
                  ${style.size === "medium" ? "text-[11px] md:text-sm line-clamp-1 md:line-clamp-2" : ""}
                `}
              >
                {contentAnalysis.previewText}
              </p>
            )}

            {/* Tags for larger cards - hidden on mobile */}
            {(style.size === "massive" ||
              style.size === "hero" ||
              style.size === "large") &&
              post.tags.length > 0 && (
                <div className="hidden md:flex flex-wrap gap-1.5 mt-auto pt-4">
                  {post.tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        isDark
                          ? "bg-white/10 text-gray-400"
                          : "bg-void-black/10 text-gray-600"
                      }`}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

            {/* Reading time badge - hidden on mobile */}
            {style.size !== "tiny" &&
              style.size !== "micro" &&
              style.size !== "small" && (
                <div
                  className={`mt-auto pt-2 text-xs ${secondaryColor} hidden md:block`}
                >
                  {contentAnalysis.readingTime} min read
                </div>
              )}
          </div>

          {/* Diagonal stripe for accent variant */}
          {style.variant === "accent" && (
            <div
              className="absolute -right-16 -top-16 w-32 h-32 rotate-45 opacity-30"
              style={{ backgroundColor: post.accent_color }}
            />
          )}

          {/* Border glow effect on hover - CSS only for performance */}
          <div
            className={`absolute inset-0 pointer-events-none rounded-inherit transition-opacity duration-200 ${
              isHovered ? "opacity-60" : "opacity-0"
            }`}
            style={{
              boxShadow: `inset 0 0 0 2px ${post.accent_color}`,
              borderRadius: "inherit",
            }}
          />

          {/* Corner pin effect for some cards */}
          {(style.variant === "outlined" || style.variant === "torn") && (
            <div className="absolute -top-1 -left-1 w-4 h-4 bg-accent-orange rounded-full shadow-lg border-2 border-white" />
          )}
        </article>
      </Link>
    </motion.div>
  );
}

// Decorative chaos elements - reduced from 20 to 6 for performance
function ScatteredElements() {
  const elements = useMemo(() => {
    return [...Array(6)].map((_, i) => ({
      type: seededRandom(i * 100) > 0.5 ? "line" : "dot",
      x: seededRandom(i * 300) * 100,
      y: seededRandom(i * 400) * 100,
      rotation: seededRandom(i * 500) * 360,
      size: 30 + seededRandom(i * 600) * 60,
      color: seededRandom(i * 800) > 0.5 ? "#ff6b3d" : "#7c77c6",
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {elements.map((el, i) => (
        <div
          key={i}
          className="absolute opacity-10"
          style={{
            left: `${el.x}%`,
            top: `${el.y}%`,
          }}
        >
          {el.type === "line" ? (
            <div
              className="h-px origin-center"
              style={{
                width: el.size,
                backgroundColor: el.color,
                transform: `rotate(${el.rotation}deg)`,
              }}
            />
          ) : (
            <div
              className="rounded-full"
              style={{
                width: el.size / 8,
                height: el.size / 8,
                backgroundColor: el.color,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// Floating accent shapes - reduced from 8 to 4, static (no animation) for performance
function FloatingShapes() {
  const shapes = useMemo(() => {
    return [...Array(4)].map((_, i) => ({
      x: 10 + seededRandom(i * 1100) * 80,
      y: 10 + seededRandom(i * 1200) * 80,
      size: 60 + seededRandom(i * 1300) * 100,
      rotation: seededRandom(i * 1400) * 45,
      type: seededRandom(i * 1500) > 0.5 ? "ring" : "square",
      color: seededRandom(i * 1600) > 0.5 ? "#ff6b3d" : "#7c77c6",
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {shapes.map((shape, i) => (
        <div
          key={`shape-${i}`}
          className="absolute opacity-[0.03]"
          style={{
            left: `${shape.x}%`,
            top: `${shape.y}%`,
          }}
        >
          {shape.type === "ring" ? (
            <div
              className="rounded-full border-2"
              style={{
                width: shape.size,
                height: shape.size,
                borderColor: shape.color,
              }}
            />
          ) : (
            <div
              className="border-2"
              style={{
                width: shape.size,
                height: shape.size,
                borderColor: shape.color,
                transform: `rotate(${shape.rotation}deg)`,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function ChaoticArticleGrid({ posts }: ChaoticArticleGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce search for smoother animations
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter posts based on search
  const filteredPosts = useMemo(() => {
    if (!debouncedQuery.trim()) return posts;

    const query = debouncedQuery.toLowerCase();
    return posts.filter((post) => {
      const titleMatch = post.title.toLowerCase().includes(query);
      const contentMatch = post.content?.toLowerCase().includes(query);
      const tagMatch = post.tags.some((tag) =>
        tag.toLowerCase().includes(query)
      );
      const typeMatch = post.type.toLowerCase().includes(query);
      return titleMatch || contentMatch || tagMatch || typeMatch;
    });
  }, [posts, debouncedQuery]);

  // Generate consistent styles for all posts (based on original index)
  const cardStylesMap = useMemo(() => {
    const map = new Map<string, CardStyle>();
    posts.forEach((post, index) => {
      map.set(post.id, generateCardStyle(index, posts.length));
    });
    return map;
  }, [posts]);

  // Throttled mouse tracking for performance
  useEffect(() => {
    let rafId: number;
    let lastX = 0.5;
    let lastY = 0.5;

    const handleMouseMove = (e: MouseEvent) => {
      if (rafId) return; // Skip if already scheduled

      rafId = requestAnimationFrame(() => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const newX = (e.clientX - rect.left) / rect.width;
          const newY = (e.clientY - rect.top) / rect.height;

          // Only update if change is significant (reduces updates)
          if (Math.abs(newX - lastX) > 0.01 || Math.abs(newY - lastY) > 0.01) {
            lastX = newX;
            lastY = newY;
            mouseX.set(newX);
            mouseY.set(newY);
          }
        }
        rafId = 0;
      });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [mouseX, mouseY]);

  if (posts.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-24"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 bg-white/5 rounded-full mb-6">
          <svg
            className="w-8 h-8 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
            />
          </svg>
        </div>
        <p className="text-gray-500 text-lg font-light">
          No posts yet. Check back soon.
        </p>
      </motion.div>
    );
  }

  return (
    <div ref={containerRef} className="relative pt-2 md:pt-4 pb-8">
      {/* Search input */}
      <ChaoticSearch
        value={searchQuery}
        onChange={setSearchQuery}
        resultCount={filteredPosts.length}
        totalCount={posts.length}
      />

      {/* Background chaos - clipped to container */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <FloatingShapes />
        <ScatteredElements />
      </div>

      {/* Gradient orbs - using blur-2xl instead of blur-3xl for better performance */}
      <div className="absolute top-20 left-0 w-64 md:w-80 h-64 md:h-80 bg-accent-orange/5 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-20 right-0 w-64 md:w-80 h-64 md:h-80 bg-accent-purple/5 rounded-full blur-2xl pointer-events-none" />

      {/* No results message */}
      <AnimatePresence mode="wait">
        {filteredPosts.length === 0 && debouncedQuery && (
          <motion.div
            key="no-results"
            initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.8, rotate: 5 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            className="relative z-10 text-center py-16"
          >
            <motion.div
              animate={{ rotate: [0, -5, 5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="inline-block"
            >
              <div className="text-6xl mb-4">🌀</div>
            </motion.div>
            <p className="text-gray-400 text-lg">
              Nothing found for "
              <span className="text-accent-orange">{debouncedQuery}</span>"
            </p>
            <p className="text-gray-600 text-sm mt-2">
              The chaos has no answers... try something else
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main chaotic grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 auto-rows-[minmax(80px,auto)] md:auto-rows-[minmax(80px,auto)]"
        style={{ perspective: "1000px" }}
      >
        <AnimatePresence mode="popLayout">
          {filteredPosts.map((post, index) => (
            <ChaoticCard
              key={post.id}
              post={post}
              index={index}
              style={
                cardStylesMap.get(post.id) ||
                generateCardStyle(index, posts.length)
              }
              mouseX={mouseX}
              mouseY={mouseY}
              isFiltered={!!debouncedQuery}
            />
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
