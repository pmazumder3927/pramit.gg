"use client";

import { useState } from "react";
import Image from "next/image";
import useSWR from "swr";
import { motion, AnimatePresence } from "motion/react";

type GraveyardTrack = {
  trackId: string;
  title: string;
  artistDisplay: string;
  albumName: string | null;
  albumImageUrl: string | null;
  songUrl: string | null;
  removedAt: string | null;
};

type GraveyardYear = {
  year: number;
  playlistId: string | null;
  playlistUrl: string | null;
  tracks: GraveyardTrack[];
};

type GraveyardSnapshot = {
  years: GraveyardYear[];
  totalTracks: number;
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to load");
  return json as GraveyardSnapshot;
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "unknown date";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function GraveyardPage() {
  const { data, isLoading, mutate } = useSWR(
    "/api/spotify/review/graveyard",
    fetcher
  );
  const [syncing, setSyncing] = useState(false);
  const [expandedYear, setExpandedYear] = useState<number | null>(null);

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch("/api/spotify/review/graveyard", { method: "POST" });
      await mutate();
    } finally {
      setSyncing(false);
    }
  }

  const years = data?.years || [];
  const totalTracks = data?.totalTracks || 0;

  // Auto-expand the first year with tracks
  const firstYear = years.find((y) => y.tracks.length > 0)?.year ?? null;
  const activeYear = expandedYear ?? firstYear;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-light tracking-tight text-white sm:text-5xl">
          <span className="bg-gradient-to-r from-white/80 via-white/40 to-white/20 bg-clip-text text-transparent">
            Graveyard
          </span>
        </h1>
        <p className="mt-2 text-sm font-light text-white/30">
          songs that lost their home — an archive of evolving taste
        </p>
      </motion.div>

      {/* Stats + Sync */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        className="mb-8 flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex items-center gap-6">
          <div>
            <p className="text-2xl font-light tabular-nums text-white/60">
              {isLoading ? "—" : totalTracks}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-white/20">
              Departed
            </p>
          </div>
          <div>
            <p className="text-2xl font-light tabular-nums text-white/60">
              {isLoading ? "—" : years.length}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-white/20">
              Eras
            </p>
          </div>
        </div>

        <button
          onClick={handleSync}
          disabled={syncing || isLoading}
          className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs text-white/40 backdrop-blur-sm transition hover:bg-white/[0.06] hover:text-white/60 disabled:opacity-40"
        >
          {syncing ? "Syncing to Spotify..." : "Sync playlists"}
        </button>
      </motion.div>

      {isLoading ? (
        <div className="py-20 text-center text-sm font-light text-white/20">
          Gathering the departed...
        </div>
      ) : years.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-20 text-center"
        >
          <p className="text-sm font-light text-white/25">
            No songs in the graveyard yet.
          </p>
          <p className="mt-1 text-xs text-white/15">
            Songs land here when they leave all your playlists.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {years.map((yearGroup, yi) => (
            <motion.div
              key={yearGroup.year}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 + yi * 0.03 }}
            >
              {/* Year header — clickable */}
              <button
                onClick={() =>
                  setExpandedYear(
                    activeYear === yearGroup.year ? null : yearGroup.year
                  )
                }
                className="group flex w-full items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 text-left transition hover:border-white/[0.1] hover:bg-white/[0.04]"
              >
                <h2 className="text-xl font-light tabular-nums text-white/70">
                  {yearGroup.year}
                </h2>
                <div className="h-px flex-1 bg-white/[0.04]" />
                <span className="text-xs tabular-nums text-white/25">
                  {yearGroup.tracks.length}{" "}
                  {yearGroup.tracks.length === 1 ? "track" : "tracks"}
                </span>
                {yearGroup.playlistUrl && (
                  <a
                    href={yearGroup.playlistUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-full bg-[#1DB954]/10 px-2.5 py-1 text-[10px] font-medium text-[#1DB954]/70 transition hover:bg-[#1DB954]/20 hover:text-[#1DB954]"
                  >
                    Spotify
                  </a>
                )}
                <svg
                  className={`h-3.5 w-3.5 text-white/15 transition-transform duration-300 ${
                    activeYear === yearGroup.year ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Track list */}
              <AnimatePresence>
                {activeYear === yearGroup.year && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1 space-y-px rounded-xl border border-white/[0.04] bg-white/[0.01] p-1">
                      {yearGroup.tracks.map((track, ti) => (
                        <motion.div
                          key={track.trackId}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: ti * 0.015 }}
                          className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-white/[0.03]"
                        >
                          {/* Album art */}
                          <div className="relative h-10 w-10 flex-none overflow-hidden rounded-md ring-1 ring-white/[0.06]">
                            {track.albumImageUrl ? (
                              <Image
                                src={track.albumImageUrl}
                                alt=""
                                fill
                                className="object-cover grayscale transition-all duration-500 group-hover:grayscale-0"
                                sizes="40px"
                              />
                            ) : (
                              <div className="absolute inset-0 bg-white/[0.04]" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-white/60 transition-colors group-hover:text-white/80">
                              {track.title}
                            </p>
                            <p className="truncate text-xs text-white/20">
                              {track.artistDisplay}
                            </p>
                          </div>

                          {/* Removed date */}
                          <span className="flex-none text-[10px] tabular-nums text-white/15">
                            {formatDate(track.removedAt)}
                          </span>

                          {/* Spotify link */}
                          {track.songUrl && (
                            <a
                              href={track.songUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-none rounded-full p-1.5 text-white/10 transition hover:bg-white/[0.05] hover:text-white/30"
                            >
                              <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                />
                              </svg>
                            </a>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </main>
  );
}
