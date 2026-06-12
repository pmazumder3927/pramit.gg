import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { detectCaps } from "@/app/lib/writing-server";

type Params = { params: Promise<{ id: string }> };

// "earlier ink ↺" — the revision trail for one post, newest first. Snapshots
// restore whole (no diff UI, by design); the client takes a snapshot's fields
// into the editor state and lets autosave carry it from there.
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;
  const admin = createAdminClient();
  const caps = await detectCaps(admin);
  if (!caps.revisions) {
    return NextResponse.json({ revisions: [], caps });
  }

  const { data, error } = await admin
    .from("post_revisions")
    .select("id, kind, created_at, snapshot")
    .eq("post_id", id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) {
    console.error("Error fetching revisions:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }

  return NextResponse.json({ revisions: data || [], caps });
}
