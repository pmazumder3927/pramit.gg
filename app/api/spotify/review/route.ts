import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getReviewQueue } from "@/app/lib/spotify-review";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized", authenticated: false },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const forceSync = url.searchParams.get("sync") === "1";
  const snapshot = await getReviewQueue({ forceSync });

  return NextResponse.json(snapshot);
}
