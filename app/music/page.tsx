import MusicClient from "./MusicClient";
import {
  getPlaylists,
  getRecentlyPlayed,
  getTopTracks,
} from "@/app/lib/spotify-server";

// ISR: prerender the page with real track data baked in and refresh the shell
// every 60s. The client hands these payloads to SWR as fallbackData, so the
// existing polling/revalidation picks up from here instead of starting from a
// blank skeleton. now-playing stays client-only — its no-store round-trip
// powers the live playhead.
export const revalidate = 60;

export default async function MusicPage() {
  // Each fetch degrades to undefined on failure (or an empty result) so the
  // client simply fetches /api/spotify/* itself, exactly as before.
  const [recentlyPlayed, topTracks, playlists] = await Promise.all([
    getRecentlyPlayed().catch(() => undefined),
    getTopTracks().catch(() => undefined),
    getPlaylists().catch(() => undefined),
  ]);

  return (
    <MusicClient
      initialRecentlyPlayed={
        recentlyPlayed && recentlyPlayed.tracks.length > 0
          ? recentlyPlayed
          : undefined
      }
      initialTopTracks={
        topTracks && topTracks.tracks.length > 0 ? topTracks : undefined
      }
      initialPlaylists={
        playlists && playlists.playlists.length > 0 ? playlists : undefined
      }
    />
  );
}
