import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { applyPlaylistSequenceToSpotify } from "@/app/lib/spotify-sequencing";

interface RouteProps {
  params: Promise<{ playlistId: string }>;
}

export async function POST(_request: Request, { params }: RouteProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { playlistId } = await params;
    const result = await applyPlaylistSequenceToSpotify(playlistId);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to apply playlist order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
