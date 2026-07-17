"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { withPostHog } from "@/app/lib/track";

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
          // Real-user performance and failure signals — invisible to visitors,
          // and the only way to see what link-drop spikes actually experience.
          capture_exceptions: true,
          capture_dead_clicks: true,
          capture_performance: { web_vitals: true },
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

  // The writing room and dashboard are auth-gated — anyone who reaches them is
  // the site's owner. Tag the person once so PostHog's internal-user filter
  // can exclude owner traffic from every metric.
  const pathname = usePathname();
  useEffect(() => {
    if (!/^\/(write|dashboard|music\/manage)/.test(pathname ?? "")) return;
    try {
      if (localStorage.getItem("ph-internal") === "1") return;
    } catch {
      return;
    }
    // withPostHog waits out the idle init — a direct landing on /write must
    // still get flagged even though analytics load seconds later
    withPostHog((posthog) => {
      posthog.setPersonProperties({ internal: true });
      try {
        localStorage.setItem("ph-internal", "1");
      } catch {}
    });
  }, [pathname]);

  return <>{children}</>;
}
