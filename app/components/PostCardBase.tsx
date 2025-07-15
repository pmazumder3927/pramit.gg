import Link from "next/link";
import { Post, analyzeContent } from "@/app/lib/supabase";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";

interface PostCardBaseProps {
  post: Post;
  index: number;
  featured?: boolean;
}

export default function PostCardBase({
  post,
  index,
  featured = false,
}: PostCardBaseProps) {
  const getAccentStyle = () => {
    return {
      "--accent-color": post.accent_color,
    } as React.CSSProperties;
  };

  // Analyze content to determine optimal preview layout
  const contentAnalysis = analyzeContent(post.content || "");

  const renderPreview = () => {
    // Handle media posts (music/climb) first
    if (post.media_url) {
      switch (post.type) {
        case "music":
          if (post.media_url.includes("youtube") || post.media_url.includes("youtu.be")) {
            const videoId = post.media_url.match(
              /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
            )?.[1];

            if (videoId) {
              return (
                <div className="aspect-video rounded-lg overflow-hidden bg-black/50 mb-4">
                  <img
                    src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                    alt={post.title}
                    className="w-full h-full object-cover"
                    onError={(e: any) => {
                      e.currentTarget.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                    }}
                  />
                </div>
              );
            }
          }
          break;
      }
    }

    // For text content, show preview based on content analysis
    if (contentAnalysis.hasImages && contentAnalysis.images.length > 0) {
      const firstImage = contentAnalysis.images[0];
      return (
        <div className="aspect-video rounded-lg overflow-hidden bg-black/50 mb-4">
          <img
            src={firstImage}
            alt={post.title}
            className="w-full h-full object-cover"
          />
        </div>
      );
    }

    // Text preview for posts without images
    if (contentAnalysis.previewText) {
      return (
        <p className="text-gray-400 text-sm line-clamp-3 mb-4">
          {contentAnalysis.previewText}
        </p>
      );
    }

    return null;
  };

  return (
    <Link href={`/post/${post.slug}`} prefetch={true} className="block h-full">
      <article
        className="group cursor-pointer h-full transform transition-all duration-300 hover:-translate-y-2"
        style={getAccentStyle()}
      >
        <div
          className={`relative h-full bg-gradient-to-br from-charcoal-black/90 via-charcoal-black/70 to-void-black/90 backdrop-blur-xl border border-white/5 ${
            featured ? "rounded-3xl p-8" : "rounded-2xl p-6"
          } overflow-hidden transition-all duration-700 hover:border-white/10 hover:shadow-2xl hover:shadow-black/50`}
        >
          {/* Type Badge */}
          <div className="flex items-center justify-between mb-4">
            <span
              className={`text-xs font-medium px-3 py-1 rounded-full ${
                post.type === "music"
                  ? "bg-accent-purple/20 text-accent-purple"
                  : post.type === "climb"
                  ? "bg-accent-orange/20 text-accent-orange"
                  : "bg-accent-blue/20 text-accent-blue"
              }`}
            >
              {post.type}
            </span>
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(post.created_at), {
                addSuffix: true,
              })}
            </span>
          </div>

          {/* Title */}
          <h2
            className={`${
              featured ? "text-2xl md:text-3xl" : "text-xl"
            } font-light mb-3 line-clamp-2 transition-colors duration-300 group-hover:text-white`}
            style={{ color: post.accent_color }}
          >
            {post.title}
          </h2>

          {/* Preview Content */}
          {renderPreview()}

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {post.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-1 bg-white/5 rounded-md text-gray-400"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            {post.view_count > 0 && (
              <span className="flex items-center gap-1">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                {post.view_count}
              </span>
            )}
            {contentAnalysis.readingTime > 0 && (
              <span>{contentAnalysis.readingTime} min read</span>
            )}
          </div>

          {/* Hover Accent Line */}
          <div
            className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent opacity-0 group-hover:opacity-100 w-full transition-opacity duration-600"
            style={{ color: post.accent_color }}
          />
        </div>
      </article>
    </Link>
  );
}