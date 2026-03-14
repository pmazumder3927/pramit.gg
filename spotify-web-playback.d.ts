declare global {
  namespace Spotify {
    interface Error {
      message: string;
    }

    interface PlaybackTrack {
      uri: string | null;
      id?: string | null;
      name: string;
      artists: Array<{ name: string }>;
      album: {
        uri?: string | null;
        name: string;
        images: Array<{ url: string }>;
      };
    }

    interface PlaybackState {
      context: {
        uri: string | null;
        metadata: Record<string, string> | null;
      } | null;
      disallows: Record<string, boolean>;
      duration: number;
      paused: boolean;
      position: number;
      repeat_mode: 0 | 1 | 2;
      shuffle: boolean;
      track_window: {
        current_track: PlaybackTrack | null;
        next_tracks: PlaybackTrack[];
        previous_tracks: PlaybackTrack[];
      };
    }

    interface PlayerInit {
      name: string;
      getOAuthToken: (callback: (token: string) => void) => void;
      volume?: number;
    }

    interface Player {
      activateElement(): Promise<void> | void;
      addListener(
        event:
          | "ready"
          | "not_ready"
          | "autoplay_failed"
          | "player_state_changed"
          | "initialization_error"
          | "authentication_error"
          | "account_error"
          | "playback_error",
        callback: ((data: any) => void) | null
      ): boolean;
      connect(): Promise<boolean>;
      disconnect(): void;
      getCurrentState(): Promise<PlaybackState | null>;
      getVolume(): Promise<number>;
      pause(): Promise<void>;
      resume(): Promise<void>;
      seek(positionMs: number): Promise<void>;
      setVolume(volume: number): Promise<void>;
      togglePlay(): Promise<void>;
    }

    interface SpotifyPlayerStatic {
      Player: new (init: PlayerInit) => Player;
    }
  }

  interface Window {
    onSpotifyWebPlaybackSDKReady?: (() => void) | null;
    Spotify?: Spotify.SpotifyPlayerStatic;
  }
}

export {};
