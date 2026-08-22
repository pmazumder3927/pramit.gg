import { NextResponse } from "next/server";
import { failed, requireOwner, unauthorized } from "../_auth";
import { getGraveyard } from "@/app/lib/music/library";
import { mirrorGraveyard } from "@/app/lib/music/graveyard";

export async function GET() {
  if (!(await requireOwner())) return unauthorized();

  try {
    return NextResponse.json(await getGraveyard());
  } catch (error) {
    return failed(error, "Could not read the graveyard");
  }
}

/**
 * Push the retired list out to the year playlists on Spotify. `dryRun` reports
 * what would change without touching anything — the page asks first, because
 * mirroring removes tracks as well as adding them.
 */
export async function POST(request: Request) {
  if (!(await requireOwner())) return unauthorized();

  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await mirrorGraveyard({ dryRun: Boolean(body?.dryRun) }));
  } catch (error) {
    return failed(error, "Could not mirror the graveyard");
  }
}
