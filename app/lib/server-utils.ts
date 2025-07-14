import { createClient } from '@/utils/supabase/server';
import { Post } from './supabase';

export async function getAllPosts(): Promise<Post[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('is_draft', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching posts:', error);
    return [];
  }

  return data || [];
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('slug', slug)
    .eq('is_draft', false)
    .single();

  if (error) {
    console.error('Error fetching post:', error);
    return null;
  }

  return data;
}

export async function getAllPostSlugs(): Promise<string[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('posts')
    .select('slug')
    .eq('is_draft', false);

  if (error) {
    console.error('Error fetching post slugs:', error);
    return [];
  }

  return data?.map(post => post.slug) || [];
}

export async function incrementViewCount(postId: string): Promise<void> {
  const supabase = createClient();
  
  const { error } = await supabase.rpc('increment_view_count', {
    post_id: postId
  });

  if (error) {
    console.error('Error incrementing view count:', error);
  }
}