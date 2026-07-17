"use client";

import { useEffect } from "react";
import { track } from "@/app/lib/track";

// Pageviews on broken slugs were indistinguishable from real reads — mark
// them so dead inbound links surface in analytics.
export default function NotFoundTracker() {
  useEffect(() => {
    track("not_found_viewed", {
      path: window.location.pathname,
      referrer: document.referrer || undefined,
    });
  }, []);
  return null;
}
