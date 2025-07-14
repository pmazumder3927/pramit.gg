"use client";

import { useEffect } from 'react';
import { Post, supabase } from '@/app/lib/supabase';
import PostContent from './PostContent';

interface PostClientProps {
  post: Post;
}

export default function PostClient({ post }: PostClientProps) {
  useEffect(() => {
    // Increment view count on mount
    const incrementViewCount = async () => {
      try {
        const { error } = await supabase
          .from('posts')
          .update({ view_count: (post.view_count || 0) + 1 })
          .eq('id', post.id);

        if (error) {
          console.error('Error incrementing view count:', error);
        }
      } catch (error) {
        console.error('Error incrementing view count:', error);
      }
    };

    incrementViewCount();
  }, [post.id, post.view_count]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(120,119,198,0.03),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,107,61,0.02),transparent_50%)]" />
      
      <main className="relative z-10 min-h-screen px-4 py-8 md:px-8 md:py-16">
        <article className="max-w-4xl mx-auto">
          <PostContent post={post} />
        </article>
      </main>
    </div>
  );
}