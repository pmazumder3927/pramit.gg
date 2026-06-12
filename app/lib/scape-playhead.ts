// The scape's sense of WHERE THE SONG IS — one clock shared by the lyric pen
// (SongScapeLyrics) and the ink diffusion (SongScapeInk).
//
// Three modes:
//   · live  — the owner is playing right now: progress + cache-age + transit,
//             advancing in real time, capped at the track's end.
//   · echo  — nothing is playing, but the last song keeps REPLAYING on a loop
//             anchored to the moment it was last played (server clock), like a
//             record left spinning in an empty room. Every visitor computes the
//             same phase from the same anchor, so the echo is shared the same
//             way the live playhead is.
//   · still — no anchor to replay from (no recently-played data, or a payload
//             predating the echo): hold the page where it is.

export type PlayheadMode = "live" | "echo" | "still";

export interface PlayheadSource {
  isPlaying?: boolean;
  duration?: number;
  progress?: number;
  serverNow?: number;
  fetchedAt?: number;
  clientLatency?: number;
  playedAtMs?: number | null;
}

export interface Playhead {
  mode: PlayheadMode;
  /** ms into the track, `elapsed` ms after the response was received.
   *  echo wraps at the track's end; live caps there; still never moves. */
  pos: (elapsed: number) => number;
  /** which pass of the echo we're on (0 while live/still). A bump is the
   *  "page turn": the scape clears and the pen starts the song over. */
  loop: (elapsed: number) => number;
}

export function makePlayhead(src: PlayheadSource | null | undefined): Playhead {
  const duration = src?.duration ?? 0;
  const serverNow = src?.serverNow ?? 0;
  const fetchedAt = src?.fetchedAt ?? 0;
  const latency = src?.clientLatency ?? 0;
  // correct for in-memory cache staleness + network transit (see NowPlayingContext)
  const cacheAge = serverNow && fetchedAt ? serverNow - fetchedAt : 0;
  const base = (src?.progress ?? 0) + cacheAge + latency;

  if (src?.isPlaying && duration > 0) {
    return {
      mode: "live",
      pos: (el) => Math.min(base + el, duration),
      loop: () => 0,
    };
  }

  const playedAtMs = src?.playedAtMs ?? 0;
  if (!src?.isPlaying && playedAtMs > 0 && duration > 0) {
    // `played_at` marks when the song last sounded; the echo has been looping
    // ever since. Anchoring to serverNow (not the visitor's clock) keeps every
    // visitor on the same pass at the same phase. The double-modulo guards a
    // playedAt slightly ahead of the server clock (Spotify/server clock skew).
    const at0 = serverNow + latency - playedAtMs;
    return {
      mode: "echo",
      pos: (el) => (((at0 + el) % duration) + duration) % duration,
      loop: (el) => Math.max(0, Math.floor((at0 + el) / duration)),
    };
  }

  return { mode: "still", pos: () => base, loop: () => 0 };
}
