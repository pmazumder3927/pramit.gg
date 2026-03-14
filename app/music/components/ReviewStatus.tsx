"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import { motion, AnimatePresence } from "motion/react";
import type {
  ReviewStatusSnapshot,
  ReviewTrack,
} from "@/app/music/lib/review-types";

type FetchError = Error & { status?: number };

type Tab = "due" | "upcoming" | "unbucketed";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error || "Failed to load") as FetchError;
    err.status = res.status;
    throw err;
  }
  return json as ReviewStatusSnapshot;
};

const pinnedFetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) return [];
  return (json.ids || []) as string[];
};

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "never";
  const days = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function untilTime(dateStr: string | null): string {
  if (!dateStr) return "now";
  const days = Math.floor(
    (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (days <= 0) return "now";
  if (days === 1) return "tomorrow";
  if (days < 30) return `in ${days}d`;
  return `in ${Math.floor(days / 30)}mo`;
}

// ---------------------------------------------------------------------------
// TrackRow
// ---------------------------------------------------------------------------

function TrackRow({ track, detail }: { track: ReviewTrack; detail: "due" | "review" | "bucket" }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-white/5">
        {track.albumImageUrl ? (
          <Image
            src={track.albumImageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="40px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg
              className="h-4 w-4 text-gray-700"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-white">{track.title}</p>
        <p className="truncate text-xs text-gray-600">{track.artistDisplay}</p>
      </div>

      <div className="flex-shrink-0 text-right">
        {detail === "due" && (
          <span className="text-[10px] text-gray-600">
            {track.reviewCount > 0
              ? `reviewed ${relativeTime(track.lastReviewedAt)}`
              : "never reviewed"}
          </span>
        )}
        {detail === "review" && (
          <span className="text-[10px] text-gray-600">
            due {untilTime(track.nextReviewAt)}
          </span>
        )}
        {detail === "bucket" && (
          <span className="text-[10px] text-gray-600">
            {track.activeBuckets.length === 0
              ? "no buckets"
              : `${track.activeBuckets.length} bucket${track.activeBuckets.length !== 1 ? "s" : ""}`}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReviewStatus
// ---------------------------------------------------------------------------

export function ReviewStatus({
  reviewHref = "/music/review",
}: {
  reviewHref?: string;
}) {
  const { data, error, isLoading } = useSWR<ReviewStatusSnapshot>(
    "/api/spotify/review/status",
    fetcher,
    { revalidateOnFocus: false }
  );

  const [activeTab, setActiveTab] = useState<Tab>("due");

  const { data: pinnedIds = [] } = useSWR<string[]>(
    "/api/spotify/review/pinned",
    pinnedFetcher,
    { revalidateOnFocus: false, fallbackData: [] }
  );

  const unbucketedByPinned = useMemo(() => {
    if (!data) return [];
    const filtered =
      pinnedIds.length === 0
        ? data.unbucketed
        : data.unbucketed.filter((t) => {
            const pinSet = new Set(pinnedIds);
            return !t.activeBuckets.some((b) => pinSet.has(b.bucketId));
          });

    return [...filtered].sort((a, b) => {
      // Never reviewed first
      if (a.reviewCount === 0 && b.reviewCount > 0) return -1;
      if (b.reviewCount === 0 && a.reviewCount > 0) return 1;
      // Then by longest since last review
      const aTime = a.lastReviewedAt ? new Date(a.lastReviewedAt).getTime() : 0;
      const bTime = b.lastReviewedAt ? new Date(b.lastReviewedAt).getTime() : 0;
      return aTime - bTime;
    });
  }, [data, pinnedIds]);

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-void-black">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
          <span className="text-sm">Loading status...</span>
        </div>
      </div>
    );
  }

  if ((error as FetchError | undefined)?.status === 401) {
    return (
      <div className="flex h-dvh items-center justify-center bg-void-black px-6">
        <div className="max-w-sm text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-600">
            Private
          </p>
          <h3 className="mt-3 text-xl font-semibold text-white">
            Sign in to view status.
          </h3>
          <a
            href="/api/auth/login"
            className="mt-5 inline-flex rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black transition hover:bg-gray-200"
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "due", label: "Due now", count: data.stats.dueNow },
    { key: "upcoming", label: "Upcoming", count: data.stats.dueSoon },
    {
      key: "unbucketed",
      label: "Unbucketed",
      count: unbucketedByPinned.length,
    },
  ];

  const trackList: ReviewTrack[] =
    activeTab === "due"
      ? data.dueNow
      : activeTab === "upcoming"
        ? data.upcoming
        : unbucketedByPinned;

  const detailMode: "due" | "review" | "bucket" =
    activeTab === "due"
      ? "due"
      : activeTab === "upcoming"
        ? "review"
        : "bucket";

  return (
    <div className="min-h-dvh bg-void-black">
      {/* Header */}
      <div className="mx-auto max-w-lg px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <Link
            href={reviewHref}
            className="text-xs text-gray-600 transition hover:text-gray-400"
          >
            <svg
              className="mr-1 inline h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            review
          </Link>
        </div>

        {/* Stats grid */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div>
            <p className="text-2xl font-semibold text-white">
              {data.stats.total}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-gray-600">
              total
            </p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-white">
              {data.stats.reviewed}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-gray-600">
              reviewed
            </p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-white">
              {data.stats.neverReviewed}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-gray-600">
              unreviewed
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mx-auto max-w-lg px-4 pt-4">
        <div className="flex gap-1 border-b border-white/[0.06]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-3 pb-2.5 text-xs transition ${
                activeTab === tab.key
                  ? "text-white"
                  : "text-gray-600 hover:text-gray-400"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1.5 text-[10px] text-gray-600">
                  {tab.count}
                </span>
              )}
              {activeTab === tab.key && (
                <motion.div
                  layoutId="status-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-px bg-white/40"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Track list */}
      <div className="mx-auto max-w-lg px-4 pt-1 pb-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {trackList.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-gray-600">
                  {activeTab === "due"
                    ? "Nothing due right now."
                    : activeTab === "upcoming"
                      ? "No upcoming reviews."
                      : "All liked songs have a bucket."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {trackList.map((track) => (
                  <TrackRow
                    key={track.trackId}
                    track={track}
                    detail={detailMode}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
