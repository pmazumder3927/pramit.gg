import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAccessToken } from "@/app/lib/spotify";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await getAccessToken();
    return NextResponse.json({ token });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Token fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
