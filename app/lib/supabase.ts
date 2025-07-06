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
  slug?: string;
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
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Function to extract first image from markdown content
export function extractFirstImage(content: string): string | null {
  const imageRegex = /!\[.*?\]\((.*?)\)/;
  const match = content.match(imageRegex);
  return match ? match[1] : null;
}

// Function to check if content has images
export function hasImages(content: string): boolean {
  const imageRegex = /!\[.*?\]\(.*?\)/g;
  return imageRegex.test(content);
}
