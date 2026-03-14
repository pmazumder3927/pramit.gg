"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReviewTrack } from "@/app/music/lib/review-types";

const SPOTIFY_SDK_URL = "https://sdk.scdn.co/spotify-player.js";
const DEFAULT_VOLUME = 0.84;
const VOLUME_STORAGE_KEY = "review-player-volume";

type PlayerTransport = "spotify" | "preview" | "none";
type SdkState = "loading" | "ready" | "error";
type StatusTone = "spotify" | "preview" | "warning" | "error" | "muted";

type ReviewPlayRouteResponse = {
  error?: string;
  playing: boolean;
  transferred?: boolean;
};

export type ReviewPlayerState = {
  activated: boolean;
  canPlayFullTrack: boolean;
  durationMs: number;
  error: string | null;
  isPlaying: boolean;
  positionMs: number;
  premiumRequired: boolean;
  reconnectRecommended: boolean;
  requiresActivation: boolean;
  statusText: string;
  statusTone: StatusTone;
  transport: PlayerTransport;
  volume: number;
};

export type ReviewPlayerControls = ReviewPlayerState & {
  activate: () => Promise<void>;
  pause: () => Promise<void>;
  replay: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  togglePlay: () => Promise<void>;
};

let spotifySdkPromise: Promise<Spotify.SpotifyPlayerStatic> | null = null;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readStoredVolume() {
  if (typeof window === "undefined") return DEFAULT_VOLUME;

  const raw = window.localStorage.getItem(VOLUME_STORAGE_KEY);
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) ? clamp(parsed, 0, 1) : DEFAULT_VOLUME;
}

async function fetchSpotifyToken() {
  const response = await fetch("/api/spotify/token", { cache: "no-store" });
  const payload = (await response.json()) as { error?: string; token?: string };

  if (!response.ok || !payload.token) {
    throw new Error(payload.error || "Unable to fetch Spotify token");
  }

  return payload.token;
}

async function requestTrackPlayback(input: {
  deviceId: string;
  ensureActive: boolean;
  uri: string;
}) {
  const response = await fetch("/api/spotify/review/play", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(input),
  });

  return (await response.json()) as ReviewPlayRouteResponse;
}

function classifyPlaybackError(message: string | null | undefined) {
  const text = message || "";

  if (/premium/i.test(text)) {
    return "premium" as const;
  }

  if (/scope|token|reconnect|authorize|authentication/i.test(text)) {
    return "reconnect" as const;
  }

  return null;
}

function loadSpotifySdk() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Spotify SDK only loads in the browser"));
  }

  if (window.Spotify) {
    return Promise.resolve(window.Spotify);
  }

  if (spotifySdkPromise) {
    return spotifySdkPromise;
  }

  spotifySdkPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${SPOTIFY_SDK_URL}"]`
    );
    const previousReady = window.onSpotifyWebPlaybackSDKReady;

    window.onSpotifyWebPlaybackSDKReady = () => {
      previousReady?.();

      if (window.Spotify) {
        resolve(window.Spotify);
        return;
      }

      reject(new Error("Spotify SDK loaded without a player factory"));
    };

    if (existingScript) {
      existingScript.addEventListener("error", () => {
        reject(new Error("Spotify SDK failed to load"));
      });
      return;
    }

    const script = document.createElement("script");
    script.src = SPOTIFY_SDK_URL;
    script.async = true;
    script.addEventListener("error", () => {
      reject(new Error("Spotify SDK failed to load"));
    });

    document.body.appendChild(script);
  });

  return spotifySdkPromise;
}

export function useReviewPlayer(track: ReviewTrack | null): ReviewPlayerControls {
  const playerRef = useRef<Spotify.Player | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestIdRef = useRef(0);
  const transportRef = useRef<PlayerTransport>("none");
  const trackRef = useRef<ReviewTrack | null>(track);
  const volumeRef = useRef(DEFAULT_VOLUME);
  const transferRequiredRef = useRef(true);

  const [sdkState, setSdkState] = useState<SdkState>("loading");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [transport, setTransport] = useState<PlayerTransport>("none");
  const [activated, setActivated] = useState(false);
  const [requiresActivation, setRequiresActivation] = useState(false);
  const [reconnectRecommended, setReconnectRecommended] = useState(false);
  const [premiumRequired, setPremiumRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [volume, setVolumeState] = useState(readStoredVolume);

  useEffect(() => {
    trackRef.current = track;
  }, [track]);

  useEffect(() => {
    transportRef.current = transport;
  }, [transport]);

  useEffect(() => {
    volumeRef.current = volume;

    if (typeof window !== "undefined") {
      window.localStorage.setItem(VOLUME_STORAGE_KEY, String(volume));
    }

    if (audioRef.current) {
      audioRef.current.volume = volume;
    }

    if (playerRef.current) {
      void playerRef.current.setVolume(volume).catch(() => undefined);
    }
  }, [volume]);

  const stopPreview = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }, []);

  const startPreviewTrack = useCallback(
    async (nextTrack: ReviewTrack, requestId = ++requestIdRef.current) => {
      const audio = audioRef.current;
      if (!audio || !nextTrack.previewUrl) {
        return false;
      }

      try {
        audio.pause();
        audio.src = nextTrack.previewUrl;
        audio.currentTime = 0;
        audio.volume = volumeRef.current;

        setTransport("preview");
        setPositionMs(0);
        setDurationMs(nextTrack.durationMs ?? 0);
        setIsPlaying(false);

        await audio.play();

        if (requestId !== requestIdRef.current) {
          return false;
        }

        setError(null);
        setTransport("preview");
        setRequiresActivation(false);
        return true;
      } catch (playbackError) {
        if (requestId !== requestIdRef.current) {
          return false;
        }

        const blocked =
          playbackError instanceof DOMException &&
          playbackError.name === "NotAllowedError";

        setIsPlaying(false);
        setRequiresActivation(blocked);
        setError(
          blocked
            ? "Tap once to enable autoplay in this browser."
            : "Preview playback failed."
        );

        return false;
      }
    },
    []
  );

  const startSpotifyTrack = useCallback(
    async (
      nextTrack: ReviewTrack,
      requestId = ++requestIdRef.current,
      options?: { forceTransfer?: boolean }
    ) => {
      if (!nextTrack.spotifyUri || !deviceId) {
        return false;
      }

      try {
        setTransport("spotify");
        setPositionMs(0);
        setDurationMs(nextTrack.durationMs ?? 0);
        setIsPlaying(true);

        const payload = await requestTrackPlayback({
          deviceId,
          ensureActive: options?.forceTransfer ?? transferRequiredRef.current,
          uri: nextTrack.spotifyUri,
        });

        if (requestId !== requestIdRef.current) {
          return false;
        }

        if (!payload.playing) {
          const limitation = classifyPlaybackError(payload.error);
          transferRequiredRef.current = true;
          setIsPlaying(false);

          if (limitation === "premium") {
            setPremiumRequired(true);
          }

          if (limitation === "reconnect") {
            setReconnectRecommended(true);
          }

          if (nextTrack.previewUrl) {
            return startPreviewTrack(nextTrack, requestId);
          }

          setTransport("none");
          setError(payload.error || "Spotify playback failed.");
          return false;
        }

        transferRequiredRef.current = false;
        setError(null);
        setRequiresActivation(false);
        setReconnectRecommended(false);
        setPremiumRequired(false);
        return true;
      } catch (playbackError) {
        if (requestId !== requestIdRef.current) {
          return false;
        }

        const message =
          playbackError instanceof Error
            ? playbackError.message
            : "Spotify playback failed.";
        const limitation = classifyPlaybackError(message);

        transferRequiredRef.current = true;
        setIsPlaying(false);
        setError(message);

        if (limitation === "premium") {
          setPremiumRequired(true);
        }

        if (limitation === "reconnect") {
          setReconnectRecommended(true);
        }

        if (nextTrack.previewUrl) {
          return startPreviewTrack(nextTrack, requestId);
        }

        return false;
      }
    },
    [deviceId, startPreviewTrack]
  );

  const activate = useCallback(async () => {
    const player = playerRef.current;

    if (!activated) {
      if (player) {
        await player.activateElement();
      }

      setActivated(true);
    }

    setRequiresActivation(false);
  }, [activated]);

  const pause = useCallback(async () => {
    if (transportRef.current === "spotify" && playerRef.current) {
      await playerRef.current.pause().catch(() => undefined);
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    setIsPlaying(false);
  }, []);

  const replay = useCallback(async () => {
    const currentTrack = trackRef.current;
    if (!currentTrack) return;

    if (transportRef.current === "spotify" && currentTrack.spotifyUri && deviceId) {
      await activate();
      await startSpotifyTrack(currentTrack, ++requestIdRef.current);
      return;
    }

    if (audioRef.current && currentTrack.previewUrl) {
      audioRef.current.currentTime = 0;

      try {
        await audioRef.current.play();
        setRequiresActivation(false);
      } catch {
        setRequiresActivation(true);
      }
    }
  }, [activate, deviceId, startSpotifyTrack]);

  const seek = useCallback(async (nextPositionMs: number) => {
    const safePosition = Math.max(0, nextPositionMs);

    if (transportRef.current === "spotify" && playerRef.current) {
      await playerRef.current.seek(safePosition).catch(() => undefined);
    } else if (audioRef.current) {
      audioRef.current.currentTime = safePosition / 1000;
    }

    setPositionMs(safePosition);
  }, []);

  const setVolume = useCallback(async (nextVolume: number) => {
    setVolumeState(clamp(nextVolume, 0, 1));
  }, []);

  const togglePlay = useCallback(async () => {
    const currentTrack = trackRef.current;
    if (!currentTrack) return;

    await activate();

    if (transportRef.current === "spotify" && playerRef.current) {
      if (!currentTrack.spotifyUri || !deviceId) {
        return;
      }

      if (isPlaying) {
        await playerRef.current.pause().catch(() => undefined);
        setIsPlaying(false);
        return;
      }

      const currentState = await playerRef.current.getCurrentState().catch(() => null);
      const currentUri = currentState?.track_window.current_track?.uri || null;

      if (currentUri === currentTrack.spotifyUri) {
        await playerRef.current.resume().catch(() => undefined);
        setIsPlaying(true);
        return;
      }

      await startSpotifyTrack(currentTrack, ++requestIdRef.current);
      return;
    }

    if (audioRef.current && currentTrack.previewUrl) {
      if (audioRef.current.paused) {
        try {
          await audioRef.current.play();
          setRequiresActivation(false);
        } catch {
          setRequiresActivation(true);
        }
      } else {
        audioRef.current.pause();
      }

      return;
    }

    if (currentTrack.spotifyUri && deviceId) {
      await startSpotifyTrack(currentTrack, ++requestIdRef.current);
    } else if (currentTrack.previewUrl) {
      await startPreviewTrack(currentTrack, ++requestIdRef.current);
    }
  }, [activate, deviceId, isPlaying, startPreviewTrack, startSpotifyTrack]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.volume = volumeRef.current;
    audioRef.current = audio;

    const syncTime = () => setPositionMs(audio.currentTime * 1000);
    const syncDuration = () => {
      const nextDuration = Number.isFinite(audio.duration) ? audio.duration * 1000 : 0;
      setDurationMs(nextDuration);
    };
    const onPlay = () => {
      setTransport("preview");
      setIsPlaying(true);
    };
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setPositionMs(0);
    };

    audio.addEventListener("timeupdate", syncTime);
    audio.addEventListener("loadedmetadata", syncDuration);
    audio.addEventListener("durationchange", syncDuration);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", syncTime);
      audio.removeEventListener("loadedmetadata", syncDuration);
      audio.removeEventListener("durationchange", syncDuration);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadSpotifySdk()
      .then(async (spotify) => {
        if (cancelled) return;

        const player = new spotify.Player({
          name: "pramit.gg review",
          getOAuthToken: (callback: (token: string) => void) => {
            void fetchSpotifyToken()
              .then((token) => {
                callback(token);
              })
              .catch((tokenError) => {
                const message =
                  tokenError instanceof Error
                    ? tokenError.message
                    : "Spotify authentication failed.";

                setSdkState("error");
                setReconnectRecommended(true);
                setError(message);
              });
          },
          volume: volumeRef.current,
        });

        player.addListener("ready", ({ device_id }: { device_id: string }) => {
          setSdkState("ready");
          setDeviceId(device_id);
          setError(null);
          setReconnectRecommended(false);
          setPremiumRequired(false);
          transferRequiredRef.current = true;
        });

        player.addListener("not_ready", () => {
          setSdkState("loading");
          setDeviceId(null);
          transferRequiredRef.current = true;
        });

        player.addListener("player_state_changed", (state: Spotify.PlaybackState | null) => {
          if (!state) return;

          setTransport("spotify");
          setIsPlaying(!state.paused);
          setPositionMs(state.position);
          setDurationMs(state.duration);
        });

        player.addListener("autoplay_failed", () => {
          setIsPlaying(false);
          setRequiresActivation(true);
          setError("Tap once to enable autoplay in this browser.");
        });

        player.addListener("initialization_error", ({ message }: Spotify.Error) => {
          setSdkState("error");
          setError(message || "Spotify player failed to initialize.");
        });

        player.addListener("authentication_error", ({ message }: Spotify.Error) => {
          setSdkState("error");
          setReconnectRecommended(true);
          setError(message || "Reconnect Spotify to enable full playback.");
        });

        player.addListener("account_error", ({ message }: Spotify.Error) => {
          setSdkState("error");
          setPremiumRequired(true);
          setError(message || "Spotify Premium is required for full-track playback.");
        });

        player.addListener("playback_error", ({ message }: Spotify.Error) => {
          setError(message || "Spotify playback failed.");
        });

        const connected = await player.connect();
        if (!connected && !cancelled) {
          setSdkState("error");
          setError("Spotify player did not connect.");
        }

        playerRef.current = player;
      })
      .catch((sdkError) => {
        if (cancelled) return;

        const message =
          sdkError instanceof Error ? sdkError.message : "Spotify SDK failed to load.";
        setSdkState("error");
        setError(message);
      });

    return () => {
      cancelled = true;

      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, [startSpotifyTrack]);

  useEffect(() => {
    if (premiumRequired || reconnectRecommended) {
      setRequiresActivation(false);
    }
  }, [premiumRequired, reconnectRecommended]);

  useEffect(() => {
    const nextTrack = track;
    if (!nextTrack) {
      requestIdRef.current += 1;
      stopPreview();
      setTransport("none");
      setIsPlaying(false);
      setPositionMs(0);
      setDurationMs(0);
      return;
    }

    const requestId = ++requestIdRef.current;
    let previewTimer: number | null = null;

    setError(null);
    setPositionMs(0);
    setDurationMs(nextTrack.durationMs ?? 0);
    setIsPlaying(false);
    stopPreview();

    if (nextTrack.spotifyUri && deviceId && sdkState === "ready" && activated) {
      void startSpotifyTrack(nextTrack, requestId, {
        forceTransfer: transferRequiredRef.current,
      });
    } else if (nextTrack.previewUrl) {
      const previewDelay = nextTrack.spotifyUri ? 850 : 0;
      previewTimer = window.setTimeout(() => {
        if (requestId === requestIdRef.current) {
          void startPreviewTrack(nextTrack, requestId);
        }
      }, previewDelay);
    } else {
      setTransport(nextTrack.spotifyUri ? "spotify" : "none");
    }

    if (nextTrack.spotifyUri && !activated && !premiumRequired && !reconnectRecommended) {
      setRequiresActivation(true);
    }

    return () => {
      if (previewTimer) {
        window.clearTimeout(previewTimer);
      }
    };
  }, [
    activated,
    deviceId,
    sdkState,
    startPreviewTrack,
    startSpotifyTrack,
    stopPreview,
    track,
  ]);

  const status = useMemo<Pick<ReviewPlayerState, "statusText" | "statusTone">>(() => {
    if (reconnectRecommended) {
      return {
        statusText: "Reconnect Spotify to grant browser playback access again.",
        statusTone: "error",
      };
    }

    if (premiumRequired) {
      return {
        statusText: "Spotify Premium is required for full-track playback. Falling back to preview clips.",
        statusTone: "preview",
      };
    }

    if (requiresActivation) {
      return {
        statusText: "Tap once to arm autoplay. After that, new review tracks will start automatically.",
        statusTone: "warning",
      };
    }

    if (transport === "spotify") {
      return {
        statusText: isPlaying
          ? "Full-track playback is running on the in-browser Spotify player."
          : "Spotify player is ready.",
        statusTone: "spotify",
      };
    }

    if (transport === "preview") {
      return {
        statusText: isPlaying
          ? "Preview clip is playing in the browser."
          : "Preview clip is ready.",
        statusTone: "preview",
      };
    }

    if (track?.spotifyUri && sdkState === "loading") {
      return {
        statusText: "Connecting to the Spotify player…",
        statusTone: "muted",
      };
    }

    if (track?.previewUrl) {
      return {
        statusText: "Preview audio is available for this track.",
        statusTone: "muted",
      };
    }

    if (error) {
      return {
        statusText: error,
        statusTone: "error",
      };
    }

    return {
      statusText: "No audio is available for this track.",
      statusTone: "muted",
    };
  }, [
    error,
    isPlaying,
    premiumRequired,
    reconnectRecommended,
    requiresActivation,
    sdkState,
    track?.previewUrl,
    track?.spotifyUri,
    transport,
  ]);

  return {
    activate,
    activated,
    canPlayFullTrack: Boolean(track?.spotifyUri && deviceId && sdkState === "ready"),
    durationMs,
    error,
    isPlaying,
    pause,
    positionMs,
    premiumRequired,
    reconnectRecommended,
    replay,
    requiresActivation,
    seek,
    setVolume,
    statusText: status.statusText,
    statusTone: status.statusTone,
    togglePlay,
    transport,
    volume,
  };
}
