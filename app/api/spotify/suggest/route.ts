import { NextRequest, NextResponse } from "next/server";

import { addSuggestion } from "@/app/lib/spotify-suggest";

const TRACK_ID_RE = /^[A-Za-z0-9]{22}$/;

export async function POST(request: NextRequest) {
  let body: { trackId?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const trackId = typeof body.trackId === "string" ? body.trackId.trim() : "";
  if (!TRACK_ID_RE.test(trackId)) {
    return NextResponse.json({ error: "A valid track is required" }, { status: 400 });
  }

  const note =
    typeof body.note === "string" && body.note.trim().length > 0
      ? body.note.trim().slice(0, 140)
      : null;

  try {
    const result = await addSuggestion({ trackId, note });

    if (result.status === "duplicate") {
      return NextResponse.json(
        { error: "duplicate", title: result.title, artist: result.artist },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: true, title: result.title, artist: result.artist },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "TRACK_NOT_FOUND") {
      return NextResponse.json(
        { error: "couldn't find that track on spotify" },
        { status: 400 }
      );
    }
    console.error("[suggest] add failed:", error);
    return NextResponse.json(
      { error: "the mailbox jammed. try once more?" },
      { status: 500 }
    );
  }
}
