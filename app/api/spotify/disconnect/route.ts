import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { disconnectSpotify } from "@/app/lib/spotify";

export async function POST() {
  // Check if user is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    await disconnectSpotify();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting Spotify:", error);
    return NextResponse.json(
      { error: "Failed to disconnect Spotify" },
      { status: 500 }
    );
  }
}
