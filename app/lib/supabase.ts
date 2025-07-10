import { createClient } from "@/utils/supabase/client";

// Export the client creation function
export const supabase = createClient();

export type Post = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  content: string;
  type: "music" | "climb" | "note";
  media_url?: string;
  tags: string[];
  accent_color: string;
  is_draft: boolean;
  view_count: number;
  slug: string;
};

export type User = {
  id: string;
  email: string;
  created_at: string;
};

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
