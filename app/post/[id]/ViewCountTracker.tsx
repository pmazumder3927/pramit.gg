"use client";

import { useEffect, useState } from "react";

interface ViewCountTrackerProps {
  postId: string;
  initialViewCount: number;
}

export default function ViewCountTracker({
  postId,
  initialViewCount,
}: ViewCountTrackerProps) {
  const [viewCount, setViewCount] = useState(initialViewCount);
  const [hasIncremented, setHasIncremented] = useState(false);

  useEffect(() => {
    // Only increment once per page load
    if (hasIncremented) return;

    const incrementViewCount = async () => {
      try {
        const response = await fetch(`/api/posts/${postId}/increment-view`, {
          method: "POST",
        });

        if (response.ok) {
          const data = await response.json();
          setViewCount(data.view_count);
          setHasIncremented(true);
        }
      } catch (error) {
        console.error("Error incrementing view count:", error);
      }
    };

    // Small delay to ensure the page has rendered before making the API call
    const timer = setTimeout(incrementViewCount, 100);

    return () => clearTimeout(timer);
  }, [postId, hasIncremented]);

  return <span className="text-sm text-gray-500">{viewCount || 0} views</span>;
}
