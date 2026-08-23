import { NextResponse } from "next/server";
import { failed, requireOwner, unauthorized } from "../../../_auth";
import { applySetlist } from "@/app/lib/music/sequence";

export const maxDuration = 300;

interface RouteProps {
  params: Promise<{ playlistId: string }>;
}

export async function POST(request: Request, { params }: RouteProps) {
  if (!(await requireOwner())) return unauthorized();

  try {
    const { playlistId } = await params;
    const body = await request.json();
    const order = Array.isArray(body?.order) ? (body.order as string[]) : null;
    if (!order?.length) {
      return NextResponse.json({ error: "No order to apply" }, { status: 400 });
    }

    return NextResponse.json(await applySetlist(playlistId, order));
  } catch (error) {
    return failed(error, "Could not write that order to Spotify");
  }
}
