import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  getGraveyardSnapshot,
  syncGraveyardPlaylists,
} from "@/app/lib/spotify-review";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snapshot = await getGraveyardSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load graveyard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncGraveyardPlaylists();
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to sync graveyard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
