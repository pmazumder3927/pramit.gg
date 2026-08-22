"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Spotify Web Playback, kept deliberately small.
 *
 * The important property is that `play()` is callable the instant the deck
 * advances, from data the client already holds. The old deck couldn't start
 * audio until a full server round trip (Spotify writes → whole-library refetch
 * → re-rank 1000 tracks) had come back and changed `currentTrack`, which is
 * most of why it felt slow.
 *
 * There are no preview URLs to fall back on — Spotify stopped serving them —
 * so if the SDK can't connect the UI says so instead of pretending.
 */

export type PlayerStatus = "connecting" | "ready" | "unavailable";

const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";
const VOLUME_KEY = "manage-deck-volume";

let sdkPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if ((window as any).Spotify) return resolve();

    (window as any).onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    script.onerror = () => reject(new Error("SDK failed to load"));
    document.body.appendChild(script);
  });
  return sdkPromise;
}

async function freshToken(): Promise<string> {
  const response = await fetch("/api/spotify/token", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok || !data.token) throw new Error("no playback token");
  return data.token;
}

export function useDeckPlayer() {
  const [status, setStatus] = useState<PlayerStatus>("connecting");
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);

  const playerRef = useRef<any>(null);
  const deviceRef = useRef<string | null>(null);
  const wantedRef = useRef<string | null>(null);
  const activatedRef = useRef(false);

  useEffect(() => {
    const stored = Number(localStorage.getItem(VOLUME_KEY));
    if (Number.isFinite(stored) && stored >= 0 && stored <= 1) setVolumeState(stored);
  }, []);

  useEffect(() => {
    let alive = true;

    loadSdk()
      .then(() => {
        if (!alive) return;
        const player = new (window as any).Spotify.Player({
          name: "it's 3am",
          getOAuthToken: (cb: (token: string) => void) => {
            freshToken().then(cb).catch(() => {});
          },
          volume,
        });

        player.addListener("ready", ({ device_id }: { device_id: string }) => {
          if (!alive) return;
          deviceRef.current = device_id;
          setStatus("ready");
          // Whatever the deck asked for while we were connecting.
          if (wantedRef.current) void start(wantedRef.current);
        });
        player.addListener("not_ready", () => {
          deviceRef.current = null;
        });
        player.addListener("player_state_changed", (state: any) => {
          if (!state || !alive) return;
          setPlaying(!state.paused);
          setPosition(state.position);
          setDuration(state.duration);
        });
        player.addListener("initialization_error", () => setStatus("unavailable"));
        player.addListener("account_error", () => setStatus("unavailable"));
        player.addListener("authentication_error", () => setStatus("unavailable"));

        player.connect();
        playerRef.current = player;
      })
      .catch(() => setStatus("unavailable"));

    const timeout = setTimeout(() => {
      if (alive) setStatus((current) => (current === "connecting" ? "unavailable" : current));
    }, 12_000);

    return () => {
      alive = false;
      clearTimeout(timeout);
      playerRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Local playhead between SDK state pushes, so the bar doesn't stutter.
  useEffect(() => {
    if (!playing || duration === 0) return;
    const id = setInterval(() => {
      setPosition((current) => Math.min(current + 250, duration));
    }, 250);
    return () => clearInterval(id);
  }, [playing, duration]);

  const start = useCallback(async (uri: string) => {
    const device = deviceRef.current;
    if (!device) return;
    try {
      const token = await freshToken();
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: [uri] }),
      });
    } catch {
      /* the UI already shows whether playback is available */
    }
  }, []);

  const play = useCallback(
    (uri: string | null) => {
      if (!uri) return;
      wantedRef.current = uri;
      setPosition(0);
      setDuration(0);
      void start(uri);
    },
    [start]
  );

  /** Browsers need a gesture before the SDK's audio element will make sound. */
  const activate = useCallback(() => {
    if (activatedRef.current || !playerRef.current) return;
    playerRef.current.activateElement?.();
    activatedRef.current = true;
  }, []);

  const toggle = useCallback(() => {
    activate();
    playerRef.current?.togglePlay?.();
  }, [activate]);

  const seek = useCallback((ms: number) => {
    playerRef.current?.seek?.(ms);
    setPosition(ms);
  }, []);

  const setVolume = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(1, next));
    setVolumeState(clamped);
    localStorage.setItem(VOLUME_KEY, String(clamped));
    playerRef.current?.setVolume?.(clamped);
  }, []);

  const pause = useCallback(() => {
    playerRef.current?.pause?.();
  }, []);

  return {
    status,
    playing,
    position,
    duration,
    volume,
    play,
    pause,
    toggle,
    seek,
    setVolume,
    activate,
  };
}
