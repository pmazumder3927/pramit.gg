import { NextResponse } from "next/server";
import { failed, requireOwner, unauthorized } from "../_auth";
import { getDesk } from "@/app/lib/music/library";
import { syncLibrary } from "@/app/lib/music/sync";

export async function GET(request: Request) {
  if (!(await requireOwner())) return unauthorized();

  const force = new URL(request.url).searchParams.get("sync") === "1";

  try {
    // The sync is TTL'd, so this is a no-op on all but the first load of a
    // session. A failure here shouldn't blank the desk — the DB still has
    // everything from last time.
    let error: string | null = null;
    try {
      await syncLibrary({ force });
    } catch (syncError) {
      error = syncError instanceof Error ? syncError.message : "Sync failed";
    }

    const desk = await getDesk();
    return NextResponse.json({ ...desk, error });
  } catch (error) {
    return failed(error, "Could not load the desk");
  }
}
