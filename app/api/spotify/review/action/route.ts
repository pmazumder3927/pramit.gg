import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { applyReviewAction, getReviewQueue } from "@/app/lib/spotify-review";
import type { ReviewActionInput } from "@/app/music/lib/review-types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as ReviewActionInput;

    if (!body.trackId || !Array.isArray(body.bucketIds) || !body.intent) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await applyReviewAction(body);
    const snapshot = await getReviewQueue({ forceSync: false });

    return NextResponse.json(snapshot);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to apply review action";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
