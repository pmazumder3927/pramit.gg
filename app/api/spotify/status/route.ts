import { NextResponse } from "next/server";
import { isSpotifyConnected } from "@/app/lib/spotify";

export async function GET() {
  try {
    const connected = await isSpotifyConnected();
    return NextResponse.json({ connected });
  } catch (error) {
    console.error("Error checking Spotify status:", error);
    return NextResponse.json({ connected: false });
  }
}
