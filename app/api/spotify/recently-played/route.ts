import { NextResponse } from "next/server";
import { getRecentlyPlayed } from "@/app/lib/spotify-server";

// Cache for 30 seconds, stale-while-revalidate for 60 more
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
};

export async function GET() {
  try {
    const payload = await getRecentlyPlayed();
    return NextResponse.json(payload, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error("Spotify Recently Played API error:", error);
    return NextResponse.json({ tracks: [] }, { status: 500 });
  }
}
