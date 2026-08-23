import { NextResponse } from "next/server";
import { failed, requireOwner, unauthorized } from "../_auth";
import { applyDecisions } from "@/app/lib/music/decisions";
import type { Decision } from "@/app/music/manage/lib/types";

const VERBS = new Set(["file", "keep", "retire", "revive"]);

export async function POST(request: Request) {
  if (!(await requireOwner())) return unauthorized();

  try {
    const body = await request.json();
    const decisions = (Array.isArray(body?.decisions) ? body.decisions : []) as Decision[];
    const clean = decisions.filter(
      (decision) =>
        decision &&
        typeof decision.trackId === "string" &&
        VERBS.has(decision.verb) &&
        (decision.playlistIds === undefined || Array.isArray(decision.playlistIds)) &&
        (decision.knownPlaylistIds === undefined ||
          Array.isArray(decision.knownPlaylistIds))
    );

    if (clean.length !== decisions.length) {
      return NextResponse.json({ error: "Malformed decision" }, { status: 400 });
    }

    return NextResponse.json(await applyDecisions(clean));
  } catch (error) {
    return failed(error, "Could not save those decisions");
  }
}
