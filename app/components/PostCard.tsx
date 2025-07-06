"use client";

import { motion } from "framer-motion";
import { Post, generateSlug, extractFirstImage, hasImages } from "@/app/lib/supabase";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import ReactPlayer from "react-player";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";

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

  const getAccentStyle = () => {
    return {
      "--accent-color": post.accent_color,
    } as React.CSSProperties;
  };

  // Get content preview
  const getPreview = () => {
    if (!post.content) return "";
    const plainText = post.content.replace(/[#*`\[\]()]/g, "").trim();
    const maxLength = featured ? 200 : 120;
    return plainText.length > maxLength
      ? plainText.substring(0, maxLength) + "..."
      : plainText;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const slug = post.slug || generateSlug(post.title);
    router.push(`/post/${slug}`);
  };

  const renderMedia = () => {
    // Check for images in content first
    const firstImage = extractFirstImage(post.content || "");
    const hasContentImages = hasImages(post.content || "");

    if (firstImage && !imageError) {
      return (
        <div
          className={`relative ${
            featured ? "aspect-[16/10]" : "aspect-[4/3]"
          } bg-gradient-to-br from-charcoal-black via-void-black to-charcoal-black rounded-xl overflow-hidden mb-6 group-hover:shadow-2xl transition-shadow duration-700`}
        >
          <Image
            src={firstImage}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            onError={() => setImageError(true)}
            sizes={featured ? "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" : "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute inset-0 bg-gradient-to-br from-accent-orange/10 via-transparent to-accent-purple/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          
          {/* Image indicator */}
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            <div className="w-8 h-8 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          </div>
        </div>
      );
    }

    // Fall back to existing media handling
    if (!post.media_url) return null;

    switch (post.type) {
      case "music":
        return (
          <div
            className={`relative ${
              featured ? "h-32" : "h-28"
            } bg-gradient-to-br from-charcoal-black via-void-black to-charcoal-black rounded-xl overflow-hidden mb-6 group-hover:shadow-2xl transition-shadow duration-700`}
          >
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          </div>
        );
      case "climb":
        return (
          <div
            className={`relative ${
              featured ? "aspect-video" : "aspect-video"
            } bg-charcoal-black rounded-xl overflow-hidden mb-6 group shadow-xl`}
          >
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
      default:
        return null;
    }
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
          {renderMedia()}

          <div className="flex-1 flex flex-col justify-between space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
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

                <h3
                  className={`${
                    featured ? "text-2xl md:text-3xl" : "text-xl"
                  } font-light leading-tight text-white/90 group-hover:text-white transition-colors duration-300 mb-3`}
                >
                  {post.title}
                </h3>

                {post.content && (
                  <p
                    className={`text-gray-400 ${
                      featured ? "text-base" : "text-sm"
                    } leading-relaxed ${
                      featured ? "line-clamp-3" : "line-clamp-2"
                    } group-hover:text-gray-300 transition-colors duration-300`}
                  >
                    {getPreview()}
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
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
