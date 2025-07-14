import { createClient } from '@/utils/supabase/server';
import { Post } from './supabase';
import { cache } from 'react';

// Cache the database calls for better performance
export const getPosts = cache(async (): Promise<Post[]> => {
  const supabase = await createClient();
  
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
});

export const getPost = cache(async (slug: string): Promise<Post | null> => {
  const supabase = await createClient();
  
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
});

export const getPostSlugs = cache(async (): Promise<string[]> => {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('posts')
    .select('slug')
    .eq('is_draft', false);

  if (error) {
    console.error('Error fetching post slugs:', error);
    return [];
  }

  return data?.map(post => post.slug) || [];
});