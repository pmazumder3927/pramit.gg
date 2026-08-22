import { NextResponse } from "next/server";
import { failed, requireOwner, unauthorized } from "../_auth";
import { getDeck } from "@/app/lib/music/library";
import { DECK_KINDS, type DeckKind } from "@/app/music/manage/lib/types";

export async function GET(request: Request) {
  if (!(await requireOwner())) return unauthorized();

  const params = new URL(request.url).searchParams;
  const kind = params.get("kind") as DeckKind | null;
  if (!kind || !DECK_KINDS.includes(kind)) {
    return NextResponse.json({ error: "Unknown deck" }, { status: 400 });
  }

  try {
    return NextResponse.json(await getDeck(kind, params.get("playlist")));
  } catch (error) {
    return failed(error, "Could not deal the deck");
  }
}
