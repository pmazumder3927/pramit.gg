import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  getPlaylistSequence,
  savePlaylistSequence,
} from "@/app/lib/spotify-sequencing";
import {
  SEQUENCER_BOUNDARY_MODES,
  SEQUENCER_GOALS,
  type SequencerSaveInput,
} from "@/app/music/lib/sequencer-types";

interface RouteProps {
  params: Promise<{ playlistId: string }>;
}

function isGoal(value: unknown): value is (typeof SEQUENCER_GOALS)[number] {
  return typeof value === "string" && SEQUENCER_GOALS.includes(value as any);
}

function isBoundaryMode(
  value: unknown
): value is (typeof SEQUENCER_BOUNDARY_MODES)[number] {
  return typeof value === "string" && SEQUENCER_BOUNDARY_MODES.includes(value as any);
}

function isValidSavePayload(body: any): body is SequencerSaveInput {
  return (
    body &&
    isGoal(body.goalType) &&
    (body.secondaryGoal == null || isGoal(body.secondaryGoal)) &&
    body.arcProfile &&
    Array.isArray(body.blocks) &&
    Array.isArray(body.tracks) &&
    body.boundaryPreferences &&
    typeof body.boundaryPreferences === "object" &&
    Object.values(body.boundaryPreferences).every(
      (preference: any) => preference && isBoundaryMode(preference.mode)
    )
  );
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function GET(request: Request, { params }: RouteProps) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized", authenticated: false },
      { status: 401 }
    );
  }

  try {
    const { playlistId } = await params;
    const url = new URL(request.url);
    const regenerate = url.searchParams.get("regenerate") === "1";
    const snapshot = await getPlaylistSequence(playlistId, { regenerate });

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("[sequencer GET]", error);
    const message =
      error instanceof Error ? error.message : "Failed to load playlist sequencer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteProps) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (!isValidSavePayload(body)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { playlistId } = await params;
    const snapshot = await savePlaylistSequence(playlistId, body);

    return NextResponse.json(snapshot);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save playlist sequence";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
