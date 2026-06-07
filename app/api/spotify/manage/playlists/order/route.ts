import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

// Save the manual display order for playlists on the public /music page.
// Body: { order: string[] } — playlist IDs in the desired order. An empty
// array clears all manual ordering (everything falls back to follower ranking).
export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { order?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const order = body.order;
  if (
    !Array.isArray(order) ||
    !order.every((id) => typeof id === "string" && id.length > 0)
  ) {
    return NextResponse.json(
      { error: "`order` must be an array of playlist IDs" },
      { status: 400 }
    );
  }

  // De-duplicate while preserving first occurrence
  const uniqueOrder = Array.from(new Set(order as string[]));

  try {
    const admin = createAdminClient();

    // Replace the full ordering: clear existing rows, then insert the new order.
    const { error: deleteError } = await admin
      .from("spotify_playlist_order")
      .delete()
      .neq("playlist_id", "");
    if (deleteError) throw deleteError;

    if (uniqueOrder.length > 0) {
      const now = new Date().toISOString();
      const rows = uniqueOrder.map((playlistId, index) => ({
        playlist_id: playlistId,
        position: index,
        updated_at: now,
      }));
      const { error: insertError } = await admin
        .from("spotify_playlist_order")
        .insert(rows);
      if (insertError) throw insertError;
    }

    return NextResponse.json({ ok: true, count: uniqueOrder.length });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
