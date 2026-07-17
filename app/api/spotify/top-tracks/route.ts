import { NextResponse } from "next/server";
import { getTopTracks } from "@/app/lib/spotify-server";

// Top tracks change slowly, cache for 5 minutes
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
};

export async function GET() {
  try {
    const payload = await getTopTracks();
    return NextResponse.json(payload, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error("Spotify Top Tracks API error:", error);
    return NextResponse.json({ tracks: [] }, { status: 500 });
  }
}
