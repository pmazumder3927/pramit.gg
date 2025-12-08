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
  progress?: number;
  duration?: number;
}

type VisualVariant = "neon" | "glassy" | "minimal" | "accent";

interface NowPlayingContextValue {
  track: SpotifyTrack | null;
  albumColor: string;
  variant: VisualVariant;
  isLoading: boolean;
}

const NowPlayingContext = createContext<NowPlayingContextValue | null>(null);

const fetcher = (url: string) => fetch(url).then((res) => res.json());

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
      refreshInterval: 30000,
      revalidateOnFocus: false,
      dedupingInterval: 30000, // Prevent duplicate requests within 30s
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
