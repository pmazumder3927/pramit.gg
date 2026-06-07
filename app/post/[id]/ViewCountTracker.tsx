"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Increments the view count exactly once per page load and returns the live
 * count. Kept as a hook so the number can be displayed in more than one place
 * (header on mobile, margin on desktop) without firing the increment twice.
 */
export function useViewCount(postId: string, initialViewCount: number) {
  const [viewCount, setViewCount] = useState(initialViewCount);
  const incremented = useRef(false);

  useEffect(() => {
    if (incremented.current) return;
    incremented.current = true;

    const increment = async () => {
      try {
        const response = await fetch(`/api/posts/${postId}/increment-view`, {
          method: "POST",
        });
        if (response.ok) {
          const data = await response.json();
          setViewCount(data.view_count);
        }
      } catch (error) {
        console.error("Error incrementing view count:", error);
      }
    };

    // Fire when the browser is idle, with a setTimeout fallback.
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(increment);
      return () => cancelIdleCallback(id);
    }
    const timer = setTimeout(increment, 200);
    return () => clearTimeout(timer);
  }, [postId]);

  return viewCount;
}

/** Presentational view-count label (handwritten, theme-aware). */
export function ViewCount({
  count,
  className = "",
}: {
  count: number;
  className?: string;
}) {
  return (
    <span className={`font-hand text-lg text-ink-faint ${className}`}>
      {count || 0} {count === 1 ? "read" : "reads"}
    </span>
  );
}
