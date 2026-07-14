"use client";

import { useEffect } from "react";

// Analytics load off the critical path: posthog-js is dynamically imported
// once the main thread goes idle, so it never competes with first paint or
// hydration. The initial pageview is still captured on init.
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    if (!key) return;

    let cancelled = false;
    const start = () => {
      import("posthog-js").then(({ default: posthog }) => {
        if (cancelled) return;
        posthog.init(key, {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
          defaults: "2026-01-30",
        });
      });
    };

    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(start, { timeout: 3000 });
      return () => {
        cancelled = true;
        cancelIdleCallback(id);
      };
    }
    const t = setTimeout(start, 1500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  return <>{children}</>;
}
