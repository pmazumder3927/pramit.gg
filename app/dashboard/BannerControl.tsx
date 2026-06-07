"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

type Banner = {
  id: string;
  image_url: string;
  sketch_count: number;
  prompt: string | null;
  created_at: string;
};

export default function BannerControl() {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/banner", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("failed to load banner");
      }
      const data = (await response.json()) as { banner: Banner | null };
      setBanner(data.banner);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("could not load banner state");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const regenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch("/api/banner", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "generation failed");
      }
      setBanner(data.banner as Banner);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "generation failed",
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="sketch-card mb-8 p-5"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex-1 min-w-0">
          <p className="font-hand text-lg tracking-wide text-accent-rust">
            the collage
          </p>
          <h2 className="mt-1 font-serif text-xl font-medium text-ink">
            confessional collage
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            re-weave the sketches into a fresh painted nocturne via gpt-image-2. the latest collage is shown on /collage.
          </p>
          {loading ? null : banner ? (
            <p className="mt-3 text-xs text-ink-faint">
              last generated{" "}
              {new Date(banner.created_at).toLocaleString()} from{" "}
              {banner.sketch_count} sketch
              {banner.sketch_count === 1 ? "" : "es"}
            </p>
          ) : (
            <p className="mt-3 text-xs text-ink-faint">no banner yet.</p>
          )}
          {error ? (
            <p className="mt-2 text-xs text-accent-rust">{error}</p>
          ) : null}
        </div>

        <div className="flex flex-col items-stretch gap-3 md:items-end">
          {banner ? (
            <div className="h-20 w-40 overflow-hidden rounded-lg border border-line tape [--tape-rot:4deg] relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={banner.image_url}
                alt="latest generated banner"
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}
          <button
            type="button"
            onClick={regenerate}
            disabled={generating}
            className="inline-flex items-center justify-center rounded-full bg-accent-orange px-5 py-2.5 text-sm font-medium text-pure-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? "weaving..." : banner ? "regenerate banner" : "generate banner"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
