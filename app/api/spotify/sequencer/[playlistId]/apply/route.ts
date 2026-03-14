import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  applyDraftSequenceToSpotify,
  applyPlaylistSequenceToSpotify,
} from "@/app/lib/spotify-sequencing";
import {
  SEQUENCER_BOUNDARY_MODES,
  SEQUENCER_GOALS,
  SEQUENCER_MODIFIERS,
  type SequencerSaveInput,
} from "@/app/music/lib/sequencer-types";

interface RouteProps {
  params: Promise<{ playlistId: string }>;
}

function isGoal(value: unknown): value is (typeof SEQUENCER_GOALS)[number] {
  return typeof value === "string" && SEQUENCER_GOALS.includes(value as any);
}

function isModifier(
  value: unknown
): value is (typeof SEQUENCER_MODIFIERS)[number] {
  return typeof value === "string" && SEQUENCER_MODIFIERS.includes(value as any);
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
    (body.secondaryGoal == null || isModifier(body.secondaryGoal)) &&
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

export async function POST(request: Request, { params }: RouteProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { playlistId } = await params;
    const raw = await request.text();
    const body = raw ? JSON.parse(raw) : null;
    const result =
      body && isValidSavePayload(body)
        ? await applyDraftSequenceToSpotify(playlistId, body)
        : await applyPlaylistSequenceToSpotify(playlistId);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to apply playlist order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
