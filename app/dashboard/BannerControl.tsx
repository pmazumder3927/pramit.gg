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
      className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-[0.28em] text-gray-500">
            Ambient Sky
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            confessional tapestry
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            re-weave the sketches into the procedural background via gpt-image-2. The new layer screen-blends into the starfield site-wide.
          </p>
          {loading ? null : banner ? (
            <p className="mt-3 text-xs text-gray-500">
              last generated{" "}
              {new Date(banner.created_at).toLocaleString()} from{" "}
              {banner.sketch_count} sketch
              {banner.sketch_count === 1 ? "" : "es"}
            </p>
          ) : (
            <p className="mt-3 text-xs text-gray-500">no banner yet.</p>
          )}
          {error ? (
            <p className="mt-2 text-xs text-rose-300/80">{error}</p>
          ) : null}
        </div>

        <div className="flex flex-col items-stretch gap-3 md:items-end">
          {banner ? (
            <div className="h-20 w-40 overflow-hidden rounded-lg border border-white/10">
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
            className="inline-flex items-center justify-center rounded-full bg-cyber-orange px-5 py-2.5 text-sm font-medium text-black transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? "weaving..." : banner ? "regenerate banner" : "generate banner"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
