import { NextResponse } from "next/server";
import { failed, requireOwner, unauthorized } from "../_auth";
import { refitFeel } from "@/app/lib/music/feel";

export const maxDuration = 300;

/**
 * Re-measure the whole library on the axes the sequencer orders by. Cheap
 * enough to run outright — it is arithmetic over vectors already stored — so
 * there is never a question of whether the table drifted out of step.
 */
export async function POST() {
  if (!(await requireOwner())) return unauthorized();

  try {
    return NextResponse.json(await refitFeel());
  } catch (error) {
    return failed(error, "Could not measure the library");
  }
}
