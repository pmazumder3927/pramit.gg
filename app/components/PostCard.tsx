import { motion } from "motion/react";
import { Post, analyzeContent } from "@/app/lib/supabase";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import ReactPlayer from "react-player";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useLoading } from "@/app/hooks/useLoading";

interface PostCardProps {
  post: Post;
  index: number;
  featured?: boolean;
}

export default function PostCard({
  post,
  index,
  featured = false,
}: PostCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const router = useRouter();
  const { startLoading } = useLoading();

  const getAccentStyle = () => {
    return {
      "--accent-color": post.accent_color,
    } as React.CSSProperties;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Start loading immediately
    startLoading();
    // Use the database slug field instead of generating it
    router.push(`/post/${post.slug}`);
  };

  // Analyze content to determine optimal preview layout
  const contentAnalysis = analyzeContent(post.content || "");

  const renderPreview = () => {
    // Handle media posts (music/climb) first
    if (post.media_url) {
      switch (post.type) {
        case "music":
          return (
            <div className="relative h-32 bg-gradient-to-br from-charcoal-black via-void-black to-charcoal-black rounded-xl overflow-hidden mb-6 group-hover:shadow-2xl transition-shadow duration-700">
              <div className="absolute inset-0 bg-gradient-to-br from-accent-orange/10 via-transparent to-accent-purple/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{
                    scale: isHovered ? 1.1 : 1,
                    rotate: isHovered ? 360 : 0,
                  }}
                  transition={{
                    duration: 0.8,
                    ease: [0.25, 0.1, 0.25, 1],
                    rotate: { duration: 2, ease: "linear" },
                  }}
                  className="w-14 h-14 bg-white/5 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 shadow-2xl"
                >
                  <svg
                    className="w-7 h-7 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                  </svg>
                </motion.div>
              </div>
              <div className="absolute bottom-2 left-4 right-4">
                <div className="text-xs text-white/60 font-light">
                  {contentAnalysis.readingTime} min read
                </div>
              </div>
            </div>
          );
        case "climb":
          return (
            <div className="relative aspect-video bg-charcoal-black rounded-xl overflow-hidden mb-6 shadow-xl">
              <div className="absolute inset-0">
                <ReactPlayer
                  url={post.media_url}
                  width="100%"
                  height="100%"
                  playing={isHovered}
                  muted={true}
                  loop={true}
                  playsinline={true}
                  config={{
                    youtube: {
                      playerVars: {
                        modestbranding: 1,
                        controls: 0,
                        showinfo: 0,
                        rel: 0,
                      },
                    },
                  }}
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            </div>
          );
      }
    }

    // Handle content-based previews
    if (contentAnalysis.hasImages && contentAnalysis.images.length > 0) {
      const primaryImage = contentAnalysis.images[0];

      return (
        <div className="relative mb-6 rounded-xl overflow-hidden">
          {/* Visual-heavy content: larger image focus */}
          {contentAnalysis.contentType === "visual-heavy" ? (
            <div className="relative aspect-[4/3] bg-gradient-to-br from-charcoal-black via-void-black to-charcoal-black">
              <Image
                src={primaryImage}
                alt={post.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                onError={() => setImageError(true)}
                sizes={
                  featured
                    ? "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    : "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                }
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              {contentAnalysis.hasMultipleImages && (
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1 text-xs text-white">
                  +{contentAnalysis.images.length - 1} more
                </div>
              )}
            </div>
          ) : (
            /* Balanced content: smaller image with text preview */
            <div className="flex gap-4">
              <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gradient-to-br from-charcoal-black via-void-black to-charcoal-black flex-shrink-0">
                <Image
                  src={primaryImage}
                  alt={post.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  onError={() => setImageError(true)}
                  sizes="80px"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-300 leading-relaxed line-clamp-3">
                  {contentAnalysis.previewText}
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                  <span>{contentAnalysis.readingTime} min read</span>
                  {contentAnalysis.hasMultipleImages && (
                    <>
                      <div className="w-1 h-1 bg-gray-600 rounded-full" />
                      <span>{contentAnalysis.images.length} images</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Text-heavy content: focus on text preview
    if (contentAnalysis.contentType === "text-heavy") {
      return (
        <div className="mb-6">
          <div className="relative p-4 bg-gradient-to-br from-white/5 via-white/2 to-transparent rounded-xl border border-white/10 backdrop-blur-sm">
            <div className="text-sm text-gray-300 leading-relaxed line-clamp-4 mb-3">
              {contentAnalysis.previewText}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{contentAnalysis.readingTime} min read</span>
              <div className="w-1 h-1 bg-gray-600 rounded-full" />
              <span>{contentAnalysis.wordCount} words</span>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.05,
        duration: 0.6,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      whileHover={{
        y: -8,
        transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
      }}
      className="group cursor-pointer h-full"
      style={getAccentStyle()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      <div
        className={`relative h-full bg-gradient-to-br from-charcoal-black/90 via-charcoal-black/70 to-void-black/90 backdrop-blur-xl border border-white/5 ${
          featured ? "rounded-3xl p-8" : "rounded-2xl p-6"
        } overflow-hidden transition-all duration-700 hover:border-white/10 hover:shadow-2xl hover:shadow-black/50`}
      >
        {/* Ambient Light Effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
          <div
            className="absolute inset-0 bg-gradient-to-br opacity-20 blur-3xl"
            style={{
              background: `radial-gradient(circle at 30% 20%, ${post.accent_color}15 0%, transparent 50%)`,
            }}
          />
        </div>

        {/* Subtle Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.02] group-hover:opacity-[0.04] transition-opacity duration-700">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
              backgroundSize: "20px 20px",
            }}
          />
        </div>

        <div className="relative z-10 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-gray-500 font-light">
              {formatDistanceToNow(new Date(post.created_at), {
                addSuffix: true,
              })}
            </span>
            <div className="w-1 h-1 bg-gray-700 rounded-full" />
            <span
              className={`text-xs px-2.5 py-1 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 transition-all duration-300 group-hover:bg-white/10 ${
                featured ? "font-medium" : "font-light"
              }`}
              style={{ color: post.accent_color }}
            >
              {post.type}
            </span>
          </div>

          {/* Title */}
          <h3
            className={`${
              featured ? "text-2xl md:text-3xl" : "text-xl"
            } font-light leading-tight text-white/90 group-hover:text-white transition-colors duration-300 mb-4`}
          >
            {post.title}
          </h3>

          {/* Content Preview */}
          {renderPreview()}

          {/* Footer */}
          <div className="mt-auto">
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {post.tags.slice(0, featured ? 4 : 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-400 transition-all duration-300 font-light"
                  >
                    #{tag}
                  </span>
                ))}
                {post.tags.length > (featured ? 4 : 3) && (
                  <span className="text-xs text-gray-500 font-light">
                    +{post.tags.length - (featured ? 4 : 3)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Accent Line */}
        <motion.div
          className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent opacity-0 group-hover:opacity-100"
          style={{ color: post.accent_color }}
          initial={{ width: "0%" }}
          animate={{ width: isHovered ? "100%" : "0%" }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        />

        {/* Corner Accent */}
        <div className="absolute top-0 right-0 w-20 h-20 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
          <div
            className="absolute inset-0 bg-gradient-to-bl from-current to-transparent opacity-10 rounded-bl-full"
            style={{ color: post.accent_color }}
          />
        </div>
      </div>
    </motion.article>
  );
}
