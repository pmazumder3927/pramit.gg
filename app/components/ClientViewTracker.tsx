"use client";

import { useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

interface ClientViewTrackerProps {
  postId: string;
}

export default function ClientViewTracker({ postId }: ClientViewTrackerProps) {
  useEffect(() => {
    // Increment view count on mount
    const incrementView = async () => {
      try {
        await supabase
          .from('posts')
          .update({ view_count: (await supabase.from('posts').select('view_count').eq('id', postId).single()).data?.view_count + 1 || 1 })
          .eq('id', postId);
      } catch (error) {
        console.error('Error incrementing view count:', error);
      }
    };

    incrementView();
  }, [postId]);

  return null; // This component doesn't render anything
}