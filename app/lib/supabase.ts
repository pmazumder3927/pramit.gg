import type { PostType } from "./postTypes";

// NOTE: the browser client lives in ./supabase-browser — keeping this module
// free of @supabase/supabase-js keeps the types/helpers importable from
// first-load client bundles at zero cost.

export type CardSize =
  | "massive"
  | "hero"
  | "large"
  | "medium"
  | "small"
  | "tiny"
  | "micro";

export type Post = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  content: string;
  type: PostType;
  media_url?: string;
  tags: string[];
  accent_color: string;
  is_draft: boolean;
  view_count: number;
  slug: string;
  display_size?: CardSize | null; // Manual override for card size on front page
  description?: string | null; // Custom preview text for cards and social embeds (Open Graph, Twitter)
  meta_image?: string | null; // Custom image URL for social embeds
  is_pinned?: boolean; // Pin post to top of front page
  // Working copy for published posts (writing room autosave) — only present
  // once the 20260611_writing_room migration has been applied.
  draft?: Record<string, unknown> | null;
};

export type User = {
  id: string;
  email: string;
  created_at: string;
};

/**
 * Strip the writing room's private working copy before a post row crosses a
 * public boundary (it would otherwise serialize into the RSC payload that
 * anonymous visitors receive).
 */
export function stripWorkingCopy<T extends { draft?: unknown }>(post: T): T {
  if (post && "draft" in post) {
    return { ...post, draft: null };
  }
  return post;
}

// Utility function to generate slug from title
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Enhanced content analysis functions
export function analyzeContent(content: string) {
  const images = extractImages(content);
  const wordCount = content
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
  const readingTime = Math.ceil(wordCount / 200); // Average reading speed

  return {
    images,
    wordCount,
    readingTime,
    hasImages: images.length > 0,
    hasMultipleImages: images.length > 1,
    contentType: determineContentType(content, images.length),
    previewText: generatePreviewText(content),
  };
}

function extractImages(content: string): string[] {
  const imageRegex = /!\[.*?\]\((.*?)\)/g;
  const images: string[] = [];
  let match;

  while ((match = imageRegex.exec(content)) !== null) {
    images.push(match[1]);
  }

  return images;
}

function determineContentType(
  content: string,
  imageCount: number
): "text-heavy" | "visual-heavy" | "balanced" {
  const wordCount = content
    .split(/\s+/)
    .filter((word) => word.length > 0).length;

  if (imageCount === 0) return "text-heavy";
  if (imageCount > 2 && wordCount < 300) return "visual-heavy";
  return "balanced";
}

function generatePreviewText(content: string): string {
  // Remove markdown syntax and clean up text
  const cleanText = content
    .replace(/!\[.*?\]\(.*?\)/g, "") // Remove images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Convert links to text
    .replace(/[#*`_~]/g, "") // Remove markdown formatting
    .replace(/\n+/g, " ") // Replace newlines with spaces
    .trim();

  // Get the first meaningful paragraph
  const sentences = cleanText
    .split(/[.!?]+/)
    .filter((s) => s.trim().length > 20);

  if (sentences.length > 0) {
    const preview = sentences[0].trim();
    return preview.length > 150 ? preview.substring(0, 150) + "..." : preview;
  }

  return cleanText.length > 150
    ? cleanText.substring(0, 150) + "..."
    : cleanText;
}
