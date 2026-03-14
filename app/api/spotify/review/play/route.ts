import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAccessToken } from "@/app/lib/spotify";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { uri } = (await request.json()) as { uri?: string };

    if (!uri) {
      return NextResponse.json({ error: "Missing track URI" }, { status: 400 });
    }

    const accessToken = await getAccessToken();

    const response = await fetch(
      "https://api.spotify.com/v1/me/player/play",
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: [uri] }),
      }
    );

    if (response.status === 404) {
      return NextResponse.json(
        { error: "no_active_device", playing: false },
        { status: 200 }
      );
    }

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: text, playing: false },
        { status: 200 }
      );
    }

    return NextResponse.json({ playing: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Playback failed";
    return NextResponse.json({ error: message, playing: false }, { status: 200 });
  }
}
