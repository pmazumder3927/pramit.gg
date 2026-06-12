import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import {
  detectCaps,
  freshDraftSlug,
  pickEditable,
} from "@/app/lib/writing-server";

const ACCENT_COLORS = ["#ff6b3d", "#9c5aff", "#1a1b22"];

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching dashboard posts:", error);
      return NextResponse.json(
        { error: "Failed to fetch posts" },
        { status: 500 }
      );
    }

    return NextResponse.json({ posts: data || [] });
  } catch (error) {
    console.error("Dashboard posts API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Create a fresh draft. The writing room calls this on the first non-empty
// autosave of a new entry; the row is born is_draft with an internal slug
// (the real slug is minted once, at first publish).
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const fields = pickEditable(body.fields || {});
    const admin = createAdminClient();
    const caps = await detectCaps(admin);

    const { data, error } = await admin
      .from("posts")
      .insert([
        {
          title: "",
          content: "",
          type: "note",
          tags: [],
          is_draft: true,
          is_pinned: false,
          view_count: 0,
          accent_color:
            ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)],
          slug: freshDraftSlug(),
          ...fields,
          updated_at: new Date().toISOString(),
        },
      ])
      .select("*")
      .single();

    if (error) {
      console.error("Error creating draft:", error);
      return NextResponse.json(
        { error: "Failed to create draft" },
        { status: 500 }
      );
    }

    return NextResponse.json({ post: data, caps });
  } catch (error) {
    console.error("Dashboard posts API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
