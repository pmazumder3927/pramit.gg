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

/** Push the retired list out to the year playlists on Spotify. */
export async function POST() {
  if (!(await requireOwner())) return unauthorized();

  try {
    return NextResponse.json(await mirrorGraveyard());
  } catch (error) {
    return failed(error, "Could not mirror the graveyard");
  }
}
