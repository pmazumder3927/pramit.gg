import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  getPinnedBucketIds,
  savePinnedBucketIds,
} from "@/app/lib/spotify-review";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ids = await getPinnedBucketIds();
  return NextResponse.json({ ids });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];

  await savePinnedBucketIds(ids);
  return NextResponse.json({ ids });
}
