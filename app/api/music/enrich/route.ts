import { NextResponse } from "next/server";
import { failed, requireOwner, unauthorized } from "../_auth";
import { enrichLyrics } from "@/app/lib/music/lyrics";

export const maxDuration = 300;

/** One chunk of the LRCLIB pass; the client calls until `remaining` is 0. */
export async function POST(request: Request) {
  if (!(await requireOwner())) return unauthorized();

  try {
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body?.limit) || 60, 1), 200);
    return NextResponse.json(await enrichLyrics(limit));
  } catch (error) {
    return failed(error, "Could not read lyrics");
  }
}
