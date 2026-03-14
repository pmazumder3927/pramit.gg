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

function OverviewMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[11px] uppercase tracking-[0.24em] text-white/35">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-white/48">{hint}</p>
    </div>
  );
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
  const accentColor = useAlbumColor(currentTrack?.albumImageUrl || playlists[0]?.imageUrl || null);
  const rgb = hexToRgb(accentColor);

  const filteredPlaylists = useMemo(() => {
    if (!deferredQuery.trim()) return playlists;
    const needle = deferredQuery.trim().toLowerCase();
    return playlists.filter((playlist) => {
      return (
        playlist.name.toLowerCase().includes(needle) ||
        (playlist.description || "").toLowerCase().includes(needle)
      );
    });
  }, [deferredQuery, playlists]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04]"
          style={{
            boxShadow: `0 26px 80px -42px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`,
          }}
        >
          <div className="relative min-h-[320px] overflow-hidden">
            {currentTrack?.albumImageUrl ? (
              <>
                <Image
                  src={currentTrack.albumImageUrl}
                  alt={currentTrack.title}
                  fill
                  className="object-cover opacity-45"
                  sizes="(max-width: 1280px) 100vw, 62vw"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-br from-black/25 via-black/65 to-black/90" />
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-charcoal-black via-black to-void-black" />
            )}

            <div className="relative z-10 flex h-full flex-col justify-between p-6 md:p-7">
              <div className="max-w-2xl">
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/38">
                  Review Queue
                </p>
                <h2 className="mt-3 text-3xl font-semibold text-white md:text-5xl">
                  {reviewQueue?.session.headline || "Your review system is loading"}
                </h2>
                <p className="mt-3 text-sm leading-6 text-white/60 md:text-base">
                  {reviewQueue?.session.subhead ||
                    "One place to review songs and shape your playlists."}
                </p>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <OverviewMetric
                  label="Due Now"
                  value={reviewStatus?.stats.dueNow || 0}
                  hint="Songs that need a decision now."
                />
                <OverviewMetric
                  label="Unbucketed"
                  value={reviewStatus?.stats.unbucketedCount || 0}
                  hint="Liked songs that still need placement."
                />
                <OverviewMetric
                  label="Sequenced"
                  value={playlists.filter((playlist) => playlist.hasSequence).length}
                  hint="Playlists with saved flow structure."
                />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="space-y-5"
        >
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/35">Continue Review</p>
            {currentTrack ? (
              <>
                <div className="mt-4 flex gap-4">
                  <div className="relative h-20 w-20 flex-none overflow-hidden rounded-[1.5rem]">
                    {currentTrack.albumImageUrl ? (
                      <Image
                        src={currentTrack.albumImageUrl}
                        alt={currentTrack.title}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-white/5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold text-white">
                      {currentTrack.title}
                    </h3>
                    <p className="truncate text-sm text-white/55">
                      {currentTrack.artistDisplay}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {currentTrack.reasons.slice(0, 3).map((reason) => (
                        <span
                          key={reason}
                          className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/55"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    href="/music/manage/review"
                    className="rounded-full px-4 py-2 text-sm font-medium text-black transition"
                    style={{ backgroundColor: accentColor }}
                  >
                    Resume Review
                  </Link>
                  <Link
                    href="/music/manage/status"
                    className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.08]"
                  >
                    Open Status
                  </Link>
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-[1.5rem] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/45">
                No song is currently queued for review.
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/35">Queue Health</p>
            <div className="mt-4 space-y-3 text-sm text-white/58">
              <p>{reviewQueue?.connected ? "Spotify is connected." : "Spotify needs reconnection."}</p>
              <p>{reviewQueue?.stats.rediscoveryCount || 0} songs are in rediscovery territory.</p>
              <p>{reviewQueue?.stats.neglectedCount || 0} bucket fits are still unproven.</p>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/35">
              Sequencer Launcher
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              All owned playlists, public and private
            </h2>
            <p className="mt-2 text-sm text-white/52">
              Use this workspace to open sequencing drafts without exposing the tool on the public music page.
            </p>
          </div>

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search playlists"
            className="w-full rounded-full border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/28 md:max-w-xs"
          />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPlaylists.map((playlist) => (
            <div
              key={playlist.id}
              className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/20"
            >
              <div className="relative min-h-[210px] overflow-hidden">
                {playlist.imageUrl ? (
                  <>
                    <Image
                      src={playlist.imageUrl}
                      alt={playlist.name}
                      fill
                      className="object-cover opacity-40"
                      sizes="(max-width: 1280px) 100vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-charcoal-black via-black to-void-black" />
                )}

                <div className="relative z-10 flex h-full flex-col justify-between p-5">
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${
                        playlist.public
                          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                          : "border-white/10 bg-white/[0.06] text-white/60"
                      }`}
                    >
                      {playlist.public ? "Public" : "Private"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
                      {playlist.trackCount} tracks
                    </span>
                    {playlist.hasSequence && (
                      <span
                        className="rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-black"
                        style={{ backgroundColor: accentColor }}
                      >
                        Structured
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-white">{playlist.name}</h3>
                    {playlist.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-white/58">
                        {playlist.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="mb-4 flex items-center justify-between text-xs text-white/45">
                  <span>
                    {playlist.hasSequence
                      ? `saved ${relativeTime(playlist.lastSequencedAt)}`
                      : "not structured yet"}
                  </span>
                  <span>
                    {playlist.lastAppliedAt
                      ? `applied ${relativeTime(playlist.lastAppliedAt)}`
                      : "not applied yet"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/music/manage/sequencer/${playlist.id}`}
                    className="rounded-full px-4 py-2 text-sm font-medium text-black transition"
                    style={{ backgroundColor: accentColor }}
                  >
                    Open Sequencer
                  </Link>
                  {playlist.playlistUrl && (
                    <a
                      href={playlist.playlistUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/72 transition hover:bg-white/[0.08]"
                    >
                      Spotify
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filteredPlaylists.length === 0 && (
            <div className="col-span-full rounded-[1.75rem] border border-dashed border-white/10 px-5 py-12 text-center text-white/45">
              No playlists matched that search.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
