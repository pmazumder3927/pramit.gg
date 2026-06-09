"use client";

import { motion } from "motion/react";

import { Doodle, Stamp, Tape } from "@/app/components/sketchbook";
import { chaosCardStyle, ChaosDecor } from "@/app/components/sketchbook";

// Client-safe track shape (the server lib is `server-only`, so we mirror the
// fields the UI needs here rather than importing its type).
export type SideBTrack = {
  id: string;
  uri: string;
  title: string;
  artist: string;
  album: string;
  albumImageUrl: string | null;
  previewUrl: string | null;
  songUrl: string | null;
};

export default function SideBResultRow({
  track,
  index,
  active,
  previewing,
  onSelect,
  onTogglePreview,
}: {
  track: SideBTrack;
  index: number;
  active: boolean;
  previewing: boolean;
  onSelect: () => void;
  onTogglePreview: () => void;
}) {
  const hasPreview = Boolean(track.previewUrl);

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={`pick ${track.title} by ${track.artist}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: Math.min(index * 0.04, 0.4) }}
      whileHover={{ rotate: 0, y: -2 }}
      style={chaosCardStyle(track.id)}
      className={`group relative flex w-full cursor-pointer items-center gap-3 rounded-[4px] border bg-card px-3 py-2 text-left shadow-paper transition-shadow hover:shadow-paper-lg focus:outline-none ${
        active ? "border-accent-rust/60" : "border-line"
      }`}
    >
      <ChaosDecor seed={track.id} />

      {active && (
        <Doodle
          name="arrow"
          tone="rust"
          className="absolute -left-7 top-1/2 hidden h-4 w-6 -translate-y-1/2 sm:block"
          strokeWidth={3}
        />
      )}

      {/* album art — a taped little square, never a bare image */}
      <div className="relative h-11 w-11 shrink-0 sm:h-12 sm:w-12">
        <Tape
          tone="purple"
          rotate={index % 2 ? 9 : -9}
          width={24}
          className="-top-1.5 left-1/2 -translate-x-1/2"
        />
        {track.albumImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={track.albumImageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full border border-ink/10 bg-paper-2 object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center border border-ink/10 bg-paper-2 font-hand text-xl text-ink-faint">
            ♪
          </div>
        )}
        {/* circle-your-pick ink on hover (purple = music) */}
        <Doodle
          name="circle"
          tone="purple"
          draw
          strokeWidth={2}
          className="pointer-events-none absolute -inset-1 h-[calc(100%+0.5rem)] w-[calc(100%+0.5rem)] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        />
      </div>

      {/* title / artist */}
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate font-serif text-sm text-ink">{track.title}</span>
        <span className="truncate font-hand text-sm text-accent-rust">
          {track.artist}
        </span>
      </span>

      {/* preview nib — only if Spotify actually gave us a clip */}
      {hasPreview ? (
        <button
          type="button"
          aria-label={previewing ? "stop preview" : "play 30-second preview"}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePreview();
          }}
          className="relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line text-ink-soft transition-colors hover:border-accent-purple/60 hover:text-accent-purple"
        >
          {previewing ? (
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
              <rect x="2" y="2" width="3" height="8" rx="0.5" />
              <rect x="7" y="2" width="3" height="8" rx="0.5" />
            </svg>
          ) : (
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
              <path d="M3 2.2 L10 6 L3 9.8 Z" />
            </svg>
          )}
        </button>
      ) : (
        <Stamp tone="rust" rotate={-4} className="shrink-0 !px-1.5 !py-0.5 !text-[0.5rem]">
          no sample
        </Stamp>
      )}
    </motion.div>
  );
}
