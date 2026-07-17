import { NextResponse } from "next/server";
import {
  PLAYLISTS_CACHE_DURATION,
  getPlaylists,
} from "@/app/lib/spotify-server";

const CACHE_HEADERS = {
  "Cache-Control": `public, s-maxage=${PLAYLISTS_CACHE_DURATION}, stale-while-revalidate`,
};

export async function GET() {
  try {
    const payload = await getPlaylists();

    // Spotify's user/playlist fetch answered non-OK
    if (!payload) {
      return NextResponse.json({ playlists: [] }, { status: 500 });
    }

    return NextResponse.json(payload, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error("Spotify Playlists API error:", error);
    return NextResponse.json({ playlists: [] }, { status: 500 });
  }
}
