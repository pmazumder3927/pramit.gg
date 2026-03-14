"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import { motion } from "motion/react";
import { useAlbumColor } from "@/app/lib/use-album-color";
import { hexToRgb } from "@/app/music/lib/chaotic-styles";
import type {
  ReviewQueueSnapshot,
  ReviewStatusSnapshot,
} from "@/app/music/lib/review-types";

type ManagerPlaylist = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  playlistUrl: string | null;
  owner: string | null;
  public: boolean;
  trackCount: number;
  snapshotId: string | null;
  hasSequence: boolean;
  lastSequencedAt: string | null;
  lastAppliedAt: string | null;
};

const fetcher = async <T,>(url: string) => {
  const response = await fetch(url);
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error || "Failed to load");
  }
  return json as T;
};

function relativeTime(dateStr: string | null) {
  if (!dateStr) return "never";
  const diffDays = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

export function MusicManagerHome() {
  const { data: reviewQueue } = useSWR<ReviewQueueSnapshot>(
    "/api/spotify/review",
    fetcher
  );
  const { data: reviewStatus } = useSWR<ReviewStatusSnapshot>(
    "/api/spotify/review/status",
    fetcher
  );
  const { data: playlistsResponse } = useSWR<{ playlists: ManagerPlaylist[] }>(
    "/api/spotify/manage/playlists",
    fetcher
  );

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const playlists = playlistsResponse?.playlists || [];
  const currentTrack = reviewQueue?.currentTrack || null;
  const accentColor = useAlbumColor(
    currentTrack?.albumImageUrl || playlists[0]?.imageUrl || null
  );
  const rgb = hexToRgb(accentColor);

  const filteredPlaylists = useMemo(() => {
    if (!deferredQuery.trim()) return playlists;
    const needle = deferredQuery.trim().toLowerCase();
    return playlists.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        (p.description || "").toLowerCase().includes(needle)
    );
  }, [deferredQuery, playlists]);

  const structured = playlists.filter((p) => p.hasSequence).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
      {/* ── Top strip: review + stats ── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        {/* Review card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]"
        >
          <div className="flex items-center gap-4 p-4 sm:p-5">
            {currentTrack?.albumImageUrl ? (
              <div
                className="relative h-16 w-16 flex-none overflow-hidden rounded-xl sm:h-20 sm:w-20"
                style={{
                  boxShadow: `0 8px 24px -8px rgba(${rgb.r},${rgb.g},${rgb.b},0.4)`,
                }}
              >
                <Image
                  src={currentTrack.albumImageUrl}
                  alt={currentTrack.title}
                  fill
                  className="object-cover"
                  sizes="80px"
                  priority
                />
              </div>
            ) : (
              <div className="flex h-16 w-16 flex-none items-center justify-center rounded-xl bg-white/[0.04] sm:h-20 sm:w-20">
                <svg className="h-6 w-6 text-white/15" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>
            )}

            <div className="min-w-0 flex-1">
              {currentTrack ? (
                <>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/25">
                    Up for review
                  </p>
                  <h2 className="mt-1 truncate text-base font-semibold text-white sm:text-lg">
                    {currentTrack.title}
                  </h2>
                  <p className="truncate text-xs text-white/40">
                    {currentTrack.artistDisplay}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/25">
                    Review queue
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-white">
                    {reviewQueue?.session.headline || "Loading..."}
                  </h2>
                </>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/music/manage/review"
                  className="rounded-full px-3.5 py-1.5 text-xs font-medium text-black transition"
                  style={{ backgroundColor: accentColor }}
                >
                  Review
                </Link>
                <Link
                  href="/music/manage/status"
                  className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-xs text-white/50 transition hover:bg-white/[0.06] hover:text-white"
                >
                  Status
                </Link>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          className="flex items-center gap-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4"
        >
          {[
            {
              label: "Due",
              value: reviewStatus?.stats.dueNow || 0,
              hint: "need review",
            },
            {
              label: "Unbucketed",
              value: reviewStatus?.stats.unbucketedCount || 0,
              hint: "no placement",
            },
            {
              label: "Structured",
              value: structured,
              hint: "playlists",
            },
          ].map((m) => (
            <div key={m.label} className="text-center">
              <p className="text-2xl font-semibold tabular-nums text-white">
                {m.value}
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-white/25">
                {m.label}
              </p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* ── Playlists grid ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className="mt-5"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium text-white/50">Playlists</h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="w-full max-w-[200px] rounded-lg border border-white/[0.06] bg-transparent px-3 py-1.5 text-xs text-white outline-none placeholder:text-white/20 focus:border-white/15 sm:max-w-xs"
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPlaylists.map((playlist, i) => (
            <motion.div
              key={playlist.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 + i * 0.02 }}
            >
              <Link
                href={`/music/manage/sequencer/${playlist.id}`}
                className="group flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]"
              >
                {/* Playlist art */}
                <div className="relative h-14 w-14 flex-none overflow-hidden rounded-lg">
                  {playlist.imageUrl ? (
                    <Image
                      src={playlist.imageUrl}
                      alt=""
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="56px"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-white/[0.04]" />
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-medium text-white">
                    {playlist.name}
                  </h3>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-white/30">
                    <span>{playlist.trackCount} tracks</span>
                    {playlist.hasSequence && (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-black"
                        style={{ backgroundColor: accentColor }}
                      >
                        shaped
                      </span>
                    )}
                    {!playlist.public && (
                      <span className="text-white/20">private</span>
                    )}
                  </div>
                  {playlist.hasSequence && (
                    <p className="mt-1 text-[10px] text-white/20">
                      saved {relativeTime(playlist.lastSequencedAt)}
                      {playlist.lastAppliedAt &&
                        ` · applied ${relativeTime(playlist.lastAppliedAt)}`}
                    </p>
                  )}
                </div>

                {/* Arrow */}
                <div className="flex items-center">
                  <svg
                    className="h-3.5 w-3.5 text-white/15 transition-colors group-hover:text-white/40"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </Link>
            </motion.div>
          ))}

          {filteredPlaylists.length === 0 && (
            <div className="col-span-full py-12 text-center text-xs text-white/25">
              No playlists matched that search.
            </div>
          )}
        </div>
      </motion.div>
    </main>
  );
}
