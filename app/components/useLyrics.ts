"use client";

import useSWR from "swr";
import type { SpotifyTrack } from "./NowPlayingContext";

export interface LyricLine {
  /** Offset from the start of the track, in ms. */
  t: number;
  text: string;
}
interface LyricsPayload {
  synced: boolean;
  lines: LyricLine[];
  source: "lrclib" | "none";
}

const EMPTY: LyricsPayload = { synced: false, lines: [], source: "none" };
const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Time-synced lyrics for the current track. Keyed on the track so it refetches
// only on song change; lyrics are static, so we never poll and dedup for the
// session. Returns synced=false (and no lines) when none are available.
export function useLyrics(track: SpotifyTrack | null): LyricsPayload {
  const ready = !!track && track.title !== "nothing" && !!track.title && !!track.artist;
  const key = ready
    ? `/api/spotify/lyrics?${new URLSearchParams({
        title: track!.title,
        artist: track!.artist,
        album: track!.album || "",
        trackId: track!.trackId || "",
        duration: String(track!.duration ?? 0),
      }).toString()}`
    : null;

  const { data } = useSWR<LyricsPayload>(key, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 1000 * 60 * 60,
    // When playback stops the now-playing route swaps to the recently-played
    // payload for the same song; its fields (and so this SWR key) should match,
    // but keep the previous payload across any refetch so the song's lyrics
    // never blank out mid-echo.
    keepPreviousData: true,
  });

  return data ?? EMPTY;
}
