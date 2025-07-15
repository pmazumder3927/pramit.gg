import { createClient } from "@/utils/supabase/server";
import { Post } from "./supabase";
import { notFound } from "next/navigation";

export async function getPosts() {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("is_draft", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching posts:", error);
    return [];
  }

  return data || [];
}

export async function getPostBySlug(slug: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("slug", slug)
    .eq("is_draft", false)
    .single();

  if (error || !data) {
    notFound();
  }

  // Increment view count asynchronously
  supabase
    .from("posts")
    .update({ view_count: (data.view_count || 0) + 1 })
    .eq("id", data.id)
    .then(() => {
      // View count updated
    });

  return data;
}

export async function generatePostMetadata(post: Post) {
  // Extract first image from content for OG image
  const imageMatch = post.content.match(/!\[.*?\]\((.*?)\)/);
  const ogImage = imageMatch ? imageMatch[1] : post.media_url;
  
  // Generate description from content
  const plainText = post.content
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
    .replace(/\[.*?\]\(.*?\)/g, '') // Remove links
    .replace(/[#*`]/g, '') // Remove markdown syntax
    .trim();
  
  const description = plainText.length > 160 
    ? plainText.substring(0, 157) + '...' 
    : plainText;

  return {
    title: post.title,
    description,
    ogImage,
    type: post.type,
    tags: post.tags,
    publishedTime: post.created_at,
    modifiedTime: post.updated_at,
  };
}