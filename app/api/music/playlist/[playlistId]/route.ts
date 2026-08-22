import { NextResponse } from "next/server";
import { failed, requireOwner, unauthorized } from "../../_auth";
import { getSetlist, saveSetlist } from "@/app/lib/music/sequence";
import {
  DEFAULT_SHAPE,
  WORD_CURVES,
  type Shape,
} from "@/app/music/manage/lib/types";

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

  return {
    flow: number("flow", DEFAULT_SHAPE.flow),
    likeness: number("likeness", DEFAULT_SHAPE.likeness),
    spreadArtists: number("spreadArtists", DEFAULT_SHAPE.spreadArtists),
    spreadFavorites: number("spreadFavorites", DEFAULT_SHAPE.spreadFavorites),
    leadWithNew: number("leadWithNew", DEFAULT_SHAPE.leadWithNew),
    wordCurve: WORD_CURVES.includes(raw.wordCurve as never)
      ? (raw.wordCurve as Shape["wordCurve"])
      : DEFAULT_SHAPE.wordCurve,
    openStrong: raw.openStrong === undefined ? DEFAULT_SHAPE.openStrong : Boolean(raw.openStrong),
    landSoft: raw.landSoft === undefined ? DEFAULT_SHAPE.landSoft : Boolean(raw.landSoft),
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
      await saveSetlist(playlistId, setlist.shape, setlist.order, setlist.sections);
    }

    return NextResponse.json(setlist);
  } catch (error) {
    return failed(error, "Could not reshape that playlist");
  }
}
