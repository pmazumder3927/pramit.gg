"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SpotifyTrack } from "./NowPlayingContext";

const SPOTIFY_SDK_URL = "https://sdk.scdn.co/spotify-player.js";
const SYNC_INTERVAL_MS = 3000;
const DRIFT_TOLERANCE_MS = 2500; // re-seek only when off by more than this
const FLAG_COOKIE = "spotify_listener_on";

export type ListenAlongStatus =
  | "idle"
  | "connecting"
  | "live"
  | "premium_required"
  | "error";

export interface ListenAlong {
  connected: boolean;
  status: ListenAlongStatus;
  error: string | null;
  start: () => void;
  stop: () => void;
}

let sdkPromise: Promise<Spotify.SpotifyPlayerStatic> | null = null;

function loadSdk(): Promise<Spotify.SpotifyPlayerStatic> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("SDK only loads in the browser"));
  }
  if (window.Spotify) return Promise.resolve(window.Spotify);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const prevReady = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = () => {
      prevReady?.();
      if (window.Spotify) resolve(window.Spotify);
      else reject(new Error("Spotify SDK failed to initialise"));
    };
    if (!document.querySelector(`script[src="${SPOTIFY_SDK_URL}"]`)) {
      const script = document.createElement("script");
      script.src = SPOTIFY_SDK_URL;
      script.async = true;
      script.onerror = () => reject(new Error("Failed to load Spotify SDK"));
      document.body.appendChild(script);
    }
  });
  return sdkPromise;
}

function hasFlagCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((c) => c.trim().startsWith(`${FLAG_COOKIE}=`));
}

export function useListenAlong(track: SpotifyTrack | null): ListenAlong {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<ListenAlongStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Latest track + its arrival time, read by the (long-lived) sync loop.
  const trackRef = useRef<SpotifyTrack | null>(track);
  const receivedAtRef = useRef(0);
  const lastServerNowRef = useRef<number | undefined>(undefined);

  const statusRef = useRef<ListenAlongStatus>("idle");
  const playerRef = useRef<Spotify.Player | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastUriRef = useRef<string | null>(null);
  const tokenRef = useRef<{ token: string; expiresAt: number } | null>(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Detect an existing session and clean up the OAuth redirect param.
  useEffect(() => {
    setConnected(hasFlagCookie());
    const params = new URLSearchParams(window.location.search);
    const result = params.get("listen_along");
    if (!result) return;
    if (result === "connected") setConnected(true);
    else if (result === "auth_failed")
      setError("Spotify sign-in was cancelled or failed.");
    params.delete("listen_along");
    const qs = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash
    );
  }, []);

  // Keep refs fresh; stamp arrival time when genuinely new data lands.
  useEffect(() => {
    trackRef.current = track;
    if (track?.serverNow !== lastServerNowRef.current) {
      lastServerNowRef.current = track?.serverNow;
      receivedAtRef.current = Date.now();
    }
  }, [track]);

  const getToken = useCallback(async (): Promise<string> => {
    const cached = tokenRef.current;
    if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;
    const res = await fetch("/api/spotify/listen-along/token", {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("not_connected");
    const data = (await res.json()) as { token: string; expiresAt: number };
    tokenRef.current = { token: data.token, expiresAt: data.expiresAt };
    return data.token;
  }, []);

  const spotifyApi = useCallback(
    async (path: string, init?: RequestInit) => {
      const token = await getToken();
      return fetch(`https://api.spotify.com/v1/me/player${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
      });
    },
    [getToken]
  );

  // Owner's live playhead, corrected for both server-cache staleness and the
  // time elapsed since this client received the payload.
  const estimateOwnerPosition = useCallback((): number => {
    const t = trackRef.current;
    if (!t || !t.isPlaying || t.duration == null) return t?.progress ?? 0;
    const staleness = Math.max(0, (t.serverNow ?? 0) - (t.fetchedAt ?? 0));
    const sinceReceived = Math.max(0, Date.now() - receivedAtRef.current);
    return Math.min(t.duration, (t.progress ?? 0) + staleness + sinceReceived);
  }, []);

  const sync = useCallback(async () => {
    const player = playerRef.current;
    const deviceId = deviceIdRef.current;
    const t = trackRef.current;
    if (!player || !deviceId || !t || !t.uri) return;

    const ownerUri = t.uri;

    // Owner paused / stopped → pause the listener too.
    if (!t.isPlaying) {
      if (lastUriRef.current) {
        lastUriRef.current = null;
        try {
          await spotifyApi(`/pause?device_id=${deviceId}`, { method: "PUT" });
        } catch {
          /* ignore */
        }
      }
      return;
    }

    const target = estimateOwnerPosition();

    // New track (or first play) → start it at the owner's position.
    if (ownerUri !== lastUriRef.current) {
      lastUriRef.current = ownerUri;
      try {
        await spotifyApi(`/play?device_id=${deviceId}`, {
          method: "PUT",
          body: JSON.stringify({
            uris: [ownerUri],
            position_ms: Math.floor(target),
          }),
        });
      } catch {
        lastUriRef.current = null; // let the next tick retry
      }
      return;
    }

    // Same track → nudge only when drift exceeds tolerance.
    try {
      const state = await player.getCurrentState();
      if (!state || state.paused) {
        await spotifyApi(`/play?device_id=${deviceId}`, {
          method: "PUT",
          body: JSON.stringify({
            uris: [ownerUri],
            position_ms: Math.floor(target),
          }),
        });
        return;
      }
      if (Math.abs(state.position - target) > DRIFT_TOLERANCE_MS) {
        await spotifyApi(
          `/seek?position_ms=${Math.floor(target)}&device_id=${deviceId}`,
          { method: "PUT" }
        );
      }
    } catch {
      /* transient — next tick retries */
    }
  }, [estimateOwnerPosition, spotifyApi]);

  const teardown = useCallback((disconnectPlayer = true) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    lastUriRef.current = null;
    deviceIdRef.current = null;
    const player = playerRef.current;
    playerRef.current = null;
    if (player && disconnectPlayer) {
      try {
        player.disconnect();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const redirectToAuth = useCallback(() => {
    const ret = window.location.pathname + window.location.search;
    window.location.href = `/api/spotify/listen-along/auth?return=${encodeURIComponent(
      ret
    )}`;
  }, []);

  const start = useCallback(async () => {
    if (statusRef.current === "connecting" || statusRef.current === "live")
      return;

    if (!hasFlagCookie()) {
      redirectToAuth();
      return;
    }

    setStatus("connecting");
    setError(null);

    // Validate the session early; a dead refresh token clears the cookie.
    try {
      await getToken();
    } catch {
      setConnected(false);
      redirectToAuth();
      return;
    }

    let Spotify: Spotify.SpotifyPlayerStatic;
    try {
      Spotify = await loadSdk();
    } catch {
      setStatus("error");
      setError("Couldn't load the Spotify player.");
      return;
    }

    const player = new Spotify.Player({
      name: "pramit.gg · listen along",
      getOAuthToken: (cb) => {
        getToken()
          .then(cb)
          .catch(() => {});
      },
      volume: 0.8,
    });
    playerRef.current = player;

    player.addListener("ready", ({ device_id }: { device_id: string }) => {
      deviceIdRef.current = device_id;
      lastUriRef.current = null; // force an initial play
      setStatus("live");
      void sync();
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => void sync(), SYNC_INTERVAL_MS);
    });
    player.addListener("not_ready", () => {
      deviceIdRef.current = null;
    });
    player.addListener("account_error", () => {
      teardown(true);
      setStatus("premium_required");
    });
    player.addListener("authentication_error", () => {
      tokenRef.current = null;
      teardown(true);
      setConnected(false);
      setStatus("error");
      setError("Spotify session expired — reconnect to keep listening.");
    });
    player.addListener("initialization_error", () => {
      teardown(true);
      setStatus("error");
      setError("This browser can't stream Spotify.");
    });
    player.addListener("playback_error", () => {
      /* transient; sync loop recovers */
    });

    try {
      const ok = await player.connect();
      if (!ok) {
        setStatus("error");
        setError("Couldn't connect to Spotify.");
        return;
      }
      // The triggering click is a user gesture — satisfy autoplay policy.
      await player.activateElement?.();
    } catch {
      setStatus("error");
      setError("Couldn't connect to Spotify.");
    }
  }, [getToken, redirectToAuth, sync, teardown]);

  const stop = useCallback(() => {
    teardown(true);
    setStatus("idle");
  }, [teardown]);

  useEffect(() => () => teardown(true), [teardown]);

  return {
    connected,
    status,
    error,
    start: () => void start(),
    stop,
  };
}
