"use client";

import { createContext, useContext, ReactNode } from "react";
import useSWR from "swr";
import { useAlbumColor } from "@/app/lib/use-album-color";

export interface SpotifyTrack {
  isPlaying: boolean;
  title: string;
  artist: string;
  album: string;
  albumImageUrl: string | null;
  songUrl: string | null;
  trackId?: string | null;
  uri?: string | null;
  progress?: number;
  duration?: number;
  /** Epoch ms (server clock) when the upstream Spotify data was pulled. */
  fetchedAt?: number;
  /** Epoch ms (server clock) at response time — pairs with fetchedAt to
   *  correct for cache staleness when estimating the live playhead. */
  serverNow?: number;
  /** Estimated one-way network latency (ms) for this response, ~half the
   *  measured round-trip — the transit gap serverNow/fetchedAt can't see. */
  clientLatency?: number;
}

type VisualVariant = "neon" | "glassy" | "minimal" | "accent";

interface NowPlayingContextValue {
  track: SpotifyTrack | null;
  albumColor: string;
  variant: VisualVariant;
  isLoading: boolean;
}

const NowPlayingContext = createContext<NowPlayingContextValue | null>(null);

// Time the round-trip so the playhead can compensate for network transit
// (server→client) — the one delay serverNow/fetchedAt can't account for. Half
// the RTT is a fair estimate of one-way latency for a freshly-fetched response.
const fetcher = async (url: string) => {
  const start = performance.now();
  const res = await fetch(url);
  const data = await res.json();
  return { ...data, clientLatency: (performance.now() - start) / 2 };
};

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return Math.round((x - Math.floor(x)) * 100) / 100;
}

function getVariantFromTrack(title: string): VisualVariant {
  const seed = title.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const roll = seededRandom(seed);
  if (roll > 0.75) return "neon";
  if (roll > 0.5) return "glassy";
  if (roll > 0.25) return "accent";
  return "minimal";
}

export function NowPlayingProvider({ children }: { children: ReactNode }) {
  const { data: track, error, isLoading } = useSWR<SpotifyTrack>(
    "/api/spotify/now-playing",
    fetcher,
    {
      refreshInterval: 5000, // poll every 5s so song changes show up quickly
      revalidateOnFocus: true, // refresh when returning to the tab
      revalidateOnReconnect: true,
      dedupingInterval: 4000, // must be < refreshInterval or polls get deduped away
      keepPreviousData: true, // don't drop the widget while a poll is in flight
    }
  );

  const albumColor = useAlbumColor(track?.albumImageUrl || null);
  const variant = track ? getVariantFromTrack(track.title) : "minimal";
  const hasTrack = !error && !!track;

  return (
    <NowPlayingContext.Provider
      value={{
        track: hasTrack ? track : null,
        albumColor,
        variant,
        isLoading,
      }}
    >
      {children}
    </NowPlayingContext.Provider>
  );
}

export function useNowPlayingContext() {
  const context = useContext(NowPlayingContext);
  if (!context) {
    throw new Error("useNowPlayingContext must be used within NowPlayingProvider");
  }
  return context;
}
