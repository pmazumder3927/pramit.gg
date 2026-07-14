import { Post, analyzeContent } from "./supabase";

// A post trimmed for the homepage payload. The cards only ever render a
// preview, a reading time, and (for the featured sheet) the first image — so
// those are computed server-side and the full markdown never ships to the
// client. On a healthy archive this cuts the page's inlined data by ~5×.
export type HomePost = Omit<Post, "content"> & {
  readingTime: number;
  previewText: string;
  previewLong: string;
  firstImage: string | null;
};

// A longer excerpt than analyzeContent's 150-char preview — the featured
// sheet reads like the top of a real page, so it gets a real paragraph.
function longPreview(content: string, max = 300): string {
  const clean = content
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*`_~>]/g, "")
    .replace(/\n+/g, " ")
    .trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return cut.slice(0, lastSpace > 0 ? lastSpace : max) + "…";
}

export function trimPostForHome(post: Post): HomePost {
  const { content, ...rest } = post;
  const { readingTime, images, previewText } = analyzeContent(content || "");
  return {
    ...rest,
    readingTime,
    previewText,
    previewLong: longPreview(content || ""),
    firstImage: images[0] ?? null,
  };
}
