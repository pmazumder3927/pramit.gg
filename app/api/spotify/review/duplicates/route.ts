import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getReviewDuplicates } from "@/app/lib/spotify-review";

export async function GET() {
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

  const snapshot = await getReviewDuplicates();
  return NextResponse.json(snapshot);
}
