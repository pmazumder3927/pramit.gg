import { createClient } from "@/utils/supabase/server";
import { Post } from "./supabase";
import { notFound } from "next/navigation";

export async function getPost(slug: string): Promise<Post> {
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
      // Fire and forget
    });

  return data;
}

export async function getAllPosts(): Promise<Post[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("is_draft", false)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data;
}

export async function getPostsForSitemap(): Promise<{ slug: string; updated_at: string }[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("posts")
    .select("slug, updated_at")
    .eq("is_draft", false)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data;
}