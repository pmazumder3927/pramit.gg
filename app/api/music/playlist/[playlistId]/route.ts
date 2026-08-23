import { NextResponse } from "next/server";
import { failed, requireOwner, unauthorized } from "../../_auth";
import { getSetlist, saveSetlist } from "@/app/lib/music/sequence";
import { ARCS, DEFAULT_SHAPE, type Shape } from "@/app/music/manage/lib/types";

interface RouteProps {
  params: Promise<{ playlistId: string }>;
}

function readShape(input: unknown): Shape | undefined {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as Record<string, unknown>;
  const number = (key: keyof Shape, fallback: number) => {
    const value = Number(raw[key]);
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
  };

  const minutes = Number(raw.sideMinutes);

  return {
    arc: ARCS.includes(raw.arc as never) ? (raw.arc as Shape["arc"]) : DEFAULT_SHAPE.arc,
    // A side shorter than 20 minutes is not a journey and one longer than two
    // hours is not a session; outside that the arc stops describing anything.
    sideMinutes: Number.isFinite(minutes)
      ? Math.min(120, Math.max(20, Math.round(minutes)))
      : DEFAULT_SHAPE.sideMinutes,
    shape: number("shape", DEFAULT_SHAPE.shape),
    movement: number("movement", DEFAULT_SHAPE.movement),
    discovery: number("discovery", DEFAULT_SHAPE.discovery),
    alike: number("alike", DEFAULT_SHAPE.alike),
    openStrong: raw.openStrong === undefined ? DEFAULT_SHAPE.openStrong : Boolean(raw.openStrong),
  };
}

export async function GET(request: Request, { params }: RouteProps) {
  if (!(await requireOwner())) return unauthorized();

  try {
    const { playlistId } = await params;
    const resequence = new URL(request.url).searchParams.get("resequence") === "1";
    return NextResponse.json(await getSetlist(playlistId, { resequence }));
  } catch (error) {
    return failed(error, "Could not open that playlist");
  }
}

/**
 * Reshape and/or save. `preview: true` runs the sequencer and hands back the
 * result without writing — the shaping knobs recompute on the server so the
 * browser never has to run the optimiser on its main thread.
 */
export async function POST(request: Request, { params }: RouteProps) {
  if (!(await requireOwner())) return unauthorized();

  try {
    const { playlistId } = await params;
    const body = await request.json();
    const shape = readShape(body?.shape);
    const order = Array.isArray(body?.order) ? (body.order as string[]) : undefined;

    const setlist = await getSetlist(playlistId, {
      shape,
      order,
      resequence: Boolean(body?.resequence),
    });

    if (!body?.preview) {
      await saveSetlist(playlistId, setlist.shape, setlist.order, setlist.sides);
    }

    return NextResponse.json(setlist);
  } catch (error) {
    return failed(error, "Could not reshape that playlist");
  }
}
