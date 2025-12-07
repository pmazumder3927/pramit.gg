"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { Post, analyzeContent } from "@/app/lib/supabase";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import Image from "next/image";

interface ChaoticArticleGridProps {
  posts: Post[];
}

// Seeded random for consistent chaos across renders
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Card size variants
type CardSize = "hero" | "large" | "medium" | "small" | "tiny";

interface CardStyle {
  size: CardSize;
  rotation: number;
  offsetX: number;
  offsetY: number;
  zIndex: number;
  variant: "default" | "outlined" | "glassy" | "accent" | "inverted";
}

function generateCardStyle(index: number, totalPosts: number): CardStyle {
  const seed = index * 7919; // Prime number for better distribution

  // First card is always hero
  if (index === 0) {
    return {
      size: "hero",
      rotation: seededRandom(seed) * 2 - 1,
      offsetX: 0,
      offsetY: 0,
      zIndex: 10,
      variant: "default",
    };
  }

  // Determine size based on position and randomness
  const sizeRoll = seededRandom(seed + 1);
  let size: CardSize;
  if (index < 3 && sizeRoll > 0.5) {
    size = "large";
  } else if (sizeRoll > 0.75) {
    size = "large";
  } else if (sizeRoll > 0.4) {
    size = "medium";
  } else if (sizeRoll > 0.15) {
    size = "small";
  } else {
    size = "tiny";
  }

  // Random rotation (-3 to 3 degrees)
  const rotation = (seededRandom(seed + 2) * 6 - 3) * (size === "tiny" ? 1.5 : 1);

  // Random offset for breaking grid alignment
  const offsetX = (seededRandom(seed + 3) * 20 - 10) * (size === "small" || size === "tiny" ? 1.5 : 1);
  const offsetY = (seededRandom(seed + 4) * 16 - 8);

  // Z-index variation
  const zIndex = Math.floor(seededRandom(seed + 5) * 5) + 1;

  // Card variant
  const variantRoll = seededRandom(seed + 6);
  let variant: CardStyle["variant"];
  if (variantRoll > 0.85) {
    variant = "inverted";
  } else if (variantRoll > 0.7) {
    variant = "accent";
  } else if (variantRoll > 0.5) {
    variant = "glassy";
  } else if (variantRoll > 0.3) {
    variant = "outlined";
  } else {
    variant = "default";
  }

  return { size, rotation, offsetX, offsetY, zIndex, variant };
}

function ChaoticCard({
  post,
  index,
  style,
  mouseX,
  mouseY,
}: {
  post: Post;
  index: number;
  style: CardStyle;
  mouseX: ReturnType<typeof useMotionValue<number>>;
  mouseY: ReturnType<typeof useMotionValue<number>>;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const contentAnalysis = analyzeContent(post.content || "");

  // Parallax based on mouse position
  const parallaxStrength = style.size === "hero" ? 15 : style.size === "large" ? 12 : 8;
  const x = useTransform(mouseX, [0, 1], [-parallaxStrength, parallaxStrength]);
  const y = useTransform(mouseY, [0, 1], [-parallaxStrength, parallaxStrength]);
  const springX = useSpring(x, { stiffness: 150, damping: 20 });
  const springY = useSpring(y, { stiffness: 150, damping: 20 });

  const sizeClasses: Record<CardSize, string> = {
    hero: "col-span-2 row-span-2 md:col-span-3 lg:col-span-2",
    large: "col-span-2 row-span-2 md:col-span-2",
    medium: "col-span-1 row-span-2 md:col-span-1",
    small: "col-span-1 row-span-1",
    tiny: "col-span-1 row-span-1",
  };

  const getVariantClasses = () => {
    switch (style.variant) {
      case "inverted":
        return "bg-white/95 text-void-black border-white/20";
      case "accent":
        return `bg-gradient-to-br from-[${post.accent_color}]/20 via-charcoal-black/90 to-void-black border-[${post.accent_color}]/30`;
      case "glassy":
        return "bg-white/5 backdrop-blur-2xl border-white/10";
      case "outlined":
        return "bg-transparent border-white/20 border-2";
      default:
        return "bg-gradient-to-br from-charcoal-black/95 via-charcoal-black/80 to-void-black/95 border-white/5";
    }
  };

  const getTextColor = () => {
    return style.variant === "inverted" ? "text-void-black" : "text-white";
  };

  const getSecondaryTextColor = () => {
    return style.variant === "inverted" ? "text-gray-600" : "text-gray-400";
  };

  const primaryImage = contentAnalysis.images[0];

  return (
    <motion.div
      ref={cardRef}
      className={`${sizeClasses[style.size]} relative`}
      style={{
        x: springX,
        y: springY,
        zIndex: isHovered ? 50 : style.zIndex,
      }}
      initial={{ opacity: 0, scale: 0.8, rotate: style.rotation * 2 }}
      animate={{
        opacity: 1,
        scale: 1,
        rotate: style.rotation,
        x: style.offsetX,
        y: style.offsetY,
      }}
      transition={{
        delay: 0.1 + index * 0.08,
        duration: 0.7,
        ease: [0.34, 1.56, 0.64, 1], // Bouncy easing
      }}
      whileHover={{
        scale: 1.05,
        rotate: 0,
        zIndex: 50,
        transition: { duration: 0.3, ease: "easeOut" },
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={`/post/${post.slug}`} className="block h-full">
        <article
          className={`
            relative h-full overflow-hidden rounded-2xl border transition-all duration-500
            ${getVariantClasses()}
            ${isHovered ? "shadow-2xl shadow-black/60" : "shadow-lg shadow-black/30"}
            ${style.size === "hero" ? "rounded-3xl" : ""}
            ${style.size === "tiny" ? "rounded-xl" : ""}
          `}
          style={{
            minHeight: style.size === "hero" ? "380px" :
                      style.size === "large" ? "320px" :
                      style.size === "medium" ? "280px" :
                      style.size === "small" ? "180px" : "140px",
          }}
        >
          {/* Background Image for visual posts */}
          {primaryImage && (style.size === "hero" || style.size === "large") && (
            <div className="absolute inset-0">
              <Image
                src={primaryImage}
                alt={post.title}
                fill
                className="object-cover opacity-40 group-hover:opacity-50 transition-opacity duration-500"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-void-black via-void-black/60 to-transparent" />
            </div>
          )}

          {/* Glitch/noise texture overlay */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Accent glow on hover */}
          <motion.div
            className="absolute inset-0 opacity-0 pointer-events-none"
            animate={{ opacity: isHovered ? 0.15 : 0 }}
            style={{
              background: `radial-gradient(circle at 50% 50%, ${post.accent_color}, transparent 70%)`,
            }}
          />

          {/* Content */}
          <div className={`relative z-10 h-full flex flex-col ${
            style.size === "hero" ? "p-8" :
            style.size === "large" ? "p-6" :
            style.size === "medium" ? "p-5" :
            style.size === "small" ? "p-4" : "p-3"
          }`}>
            {/* Type badge */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  style.variant === "inverted"
                    ? "bg-void-black/10 border border-void-black/20"
                    : "bg-white/10 border border-white/10"
                }`}
                style={{ color: style.variant === "inverted" ? post.accent_color : post.accent_color }}
              >
                {post.type}
              </span>
              {style.size !== "tiny" && (
                <span className={`text-xs ${getSecondaryTextColor()}`}>
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </span>
              )}
            </div>

            {/* Title */}
            <h3
              className={`
                font-medium leading-tight mb-2 ${getTextColor()}
                ${style.size === "hero" ? "text-3xl md:text-4xl" : ""}
                ${style.size === "large" ? "text-2xl md:text-3xl" : ""}
                ${style.size === "medium" ? "text-xl" : ""}
                ${style.size === "small" ? "text-lg" : ""}
                ${style.size === "tiny" ? "text-sm line-clamp-2" : ""}
              `}
            >
              {post.title}
            </h3>

            {/* Preview text for larger cards */}
            {(style.size === "hero" || style.size === "large" || style.size === "medium") && (
              <p className={`
                ${getSecondaryTextColor()} leading-relaxed flex-grow
                ${style.size === "hero" ? "text-base line-clamp-3" : ""}
                ${style.size === "large" ? "text-sm line-clamp-3" : ""}
                ${style.size === "medium" ? "text-sm line-clamp-2" : ""}
              `}>
                {contentAnalysis.previewText}
              </p>
            )}

            {/* Tags for larger cards */}
            {(style.size === "hero" || style.size === "large") && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-auto pt-4">
                {post.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      style.variant === "inverted"
                        ? "bg-void-black/10 text-gray-600"
                        : "bg-white/10 text-gray-400"
                    }`}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Reading time badge */}
            {style.size !== "tiny" && (
              <div className={`mt-auto pt-2 text-xs ${getSecondaryTextColor()}`}>
                {contentAnalysis.readingTime} min read
              </div>
            )}
          </div>

          {/* Diagonal accent stripe */}
          {style.variant === "accent" && (
            <div
              className="absolute -right-12 -top-12 w-24 h-24 rotate-45 opacity-20"
              style={{ backgroundColor: post.accent_color }}
            />
          )}

          {/* Border glow effect on hover */}
          <motion.div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              boxShadow: `inset 0 0 0 1px ${post.accent_color}`,
              opacity: 0,
            }}
            animate={{ opacity: isHovered ? 0.5 : 0 }}
            transition={{ duration: 0.3 }}
          />
        </article>
      </Link>
    </motion.div>
  );
}

export default function ChaoticArticleGrid({ posts }: ChaoticArticleGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  // Generate consistent styles for all posts
  const cardStyles = useMemo(() => {
    return posts.map((_, index) => generateCardStyle(index, posts.length));
  }, [posts.length]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        mouseX.set((e.clientX - rect.left) / rect.width);
        mouseY.set((e.clientY - rect.top) / rect.height);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  if (posts.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-24"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 bg-white/5 rounded-full mb-6">
          <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
        </div>
        <p className="text-gray-500 text-lg font-light">No posts yet. Check back soon.</p>
      </motion.div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Scattered decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-px h-32 bg-gradient-to-b from-transparent via-white/10 to-transparent"
            style={{
              left: `${15 + i * 15}%`,
              top: `${10 + (i % 3) * 30}%`,
              rotate: `${-15 + i * 10}deg`,
            }}
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ delay: 0.5 + i * 0.1, duration: 0.8 }}
          />
        ))}
      </div>

      {/* Main chaotic grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-[minmax(100px,auto)]"
      >
        {posts.map((post, index) => (
          <ChaoticCard
            key={post.id}
            post={post}
            index={index}
            style={cardStyles[index]}
            mouseX={mouseX}
            mouseY={mouseY}
          />
        ))}
      </motion.div>

      {/* Floating accent dots */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={`dot-${i}`}
            className="absolute w-1 h-1 rounded-full"
            style={{
              left: `${10 + seededRandom(i * 100) * 80}%`,
              top: `${10 + seededRandom(i * 200) * 80}%`,
              backgroundColor: i % 2 === 0 ? "#ff6b3d" : "#7c77c6",
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0, 0.6, 0],
              scale: [0, 1, 0],
            }}
            transition={{
              delay: 1 + i * 0.2,
              duration: 3,
              repeat: Infinity,
              repeatDelay: 2 + seededRandom(i * 300) * 3,
            }}
          />
        ))}
      </div>
    </div>
  );
}
