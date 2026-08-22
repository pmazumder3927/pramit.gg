import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { failed, requireOwner, unauthorized } from "../_auth";
import { setSetting } from "@/app/lib/music/settings";

/**
 * Playlist-level settings the desk owns: the order and visibility of the public
 * /music page, and which playlists the sorter offers first.
 */
export async function PUT(request: Request) {
  if (!(await requireOwner())) return unauthorized();

  try {
    const body = await request.json();
    const supabase = createAdminClient();

    if (Array.isArray(body?.order)) {
      const ids = body.order as string[];
      await supabase.from("music_playlists").update({ sort_position: null }).not("sort_position", "is", null);
      await Promise.all(
        ids.map((id, index) =>
          supabase
            .from("music_playlists")
            .update({ sort_position: index })
            .eq("playlist_id", id)
        )
      );
    }

    if (body?.hidden && typeof body.hidden === "object") {
      await Promise.all(
        Object.entries(body.hidden as Record<string, boolean>).map(([id, hidden]) =>
          supabase
            .from("music_playlists")
            .update({ hidden: Boolean(hidden) })
            .eq("playlist_id", id)
        )
      );
    }

    if (Array.isArray(body?.pinned)) {
      await setSetting("pinned_playlists", { ids: body.pinned as string[] });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return failed(error, "Could not save playlist settings");
  }
}
