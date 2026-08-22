import { NextResponse } from "next/server";
import { failed, requireOwner, unauthorized } from "../_auth";
import { embedLibrary } from "@/app/lib/music/embeddings";

export const maxDuration = 300;

/** One chunk of the embedding pass; the client calls until `remaining` is 0. */
export async function POST(request: Request) {
  if (!(await requireOwner())) return unauthorized();

  try {
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body?.limit) || 300, 1), 600);
    return NextResponse.json(await embedLibrary(limit));
  } catch (error) {
    return failed(error, "Could not embed the library");
  }
}
