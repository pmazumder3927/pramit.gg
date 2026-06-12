import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import {
  detectCaps,
  isUnmintedSlug,
  mintSlug,
  pickEditable,
  slugify,
  snapshotPublish,
} from "@/app/lib/writing-server";

type Params = { params: Promise<{ id: string }> };

// The explicit moments of a post's life. Everything here is deliberate (the
// room's autosave never calls this route):
//   publish    — first publish: mint the slug from the title (once, ever),
//                stamp the page, is_draft -> false
//   set-page   — push the working copy of a published post into print
//   unpublish  — pull it back to drafts (slug is kept; URLs don't churn)
//   recut-slug — change a published URL on purpose, with typed confirmation
export async function POST(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;
  const fields = pickEditable(body.fields || {});
  const admin = createAdminClient();
  const caps = await detectCaps(admin);

  const { data: post, error } = await admin
    .from("posts")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  let update: Record<string, unknown>;

  if (action === "publish") {
    const title = String(fields.title ?? post.title ?? "").trim();
    if (!title) {
      return NextResponse.json({ error: "a title first" }, { status: 400 });
    }
    update = {
      ...fields,
      title,
      is_draft: false,
      updated_at: now,
      ...(caps.draft ? { draft: null } : {}),
    };
    if (isUnmintedSlug(post.slug)) {
      update.slug = await mintSlug(admin, title, id);
      // First publish: the entry's date is the day it went to print, not the
      // day the draft row was opened (created_at drives sort + display).
      update.created_at = now;
    }
  } else if (action === "set-page") {
    update = {
      ...(caps.draft ? post.draft || {} : {}),
      ...fields,
      updated_at: now,
      ...(caps.draft ? { draft: null } : {}),
    };
    delete update.saved_at;
  } else if (action === "unpublish") {
    update = {
      ...fields,
      is_draft: true,
      updated_at: now,
      ...(caps.draft ? { draft: null } : {}),
    };
  } else if (action === "recut-slug") {
    const next = slugify(String(body.slug || ""));
    if (!next) {
      return NextResponse.json({ error: "that's not a slug" }, { status: 400 });
    }
    const { data: clash } = await admin
      .from("posts")
      .select("id")
      .eq("slug", next)
      .neq("id", id)
      .limit(1);
    if (clash && clash.length > 0) {
      return NextResponse.json(
        { error: "another entry already lives there" },
        { status: 400 }
      );
    }
    update = { slug: next, updated_at: now };
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const { data: updated, error: updateError } = await admin
    .from("posts")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (updateError || !updated) {
    console.error("Error publishing post:", updateError);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  if (action === "publish" || action === "set-page") {
    await snapshotPublish(admin, caps, updated).catch(() => {});
  }

  return NextResponse.json({ post: updated, caps });
}
