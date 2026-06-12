import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import {
  detectCaps,
  maybeAutosnap,
  pickEditable,
} from "@/app/lib/writing-server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const { id } = await params;
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
  return NextResponse.json({ post, caps });
}

// Autosave / save.
//
// Drafts: the row IS the working copy — editable fields write straight to it.
// Published posts: with the posts.draft column, autosave writes the jsonb
// working copy and never the live row; without it, only an explicit
// mode:"direct" save (the owner pressing "set the page") may touch the row.
//
// Optimistic concurrency: when the client sends baseUpdatedAt and it no longer
// matches, nothing is written and a 409 returns the server's copy
// ("this page was inked somewhere else").
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
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

  if (body.baseUpdatedAt && post.updated_at !== body.baseUpdatedAt) {
    return NextResponse.json({ error: "conflict", post, caps }, { status: 409 });
  }

  const now = new Date().toISOString();
  let update: Record<string, unknown>;

  if (post.is_draft || body.mode === "direct") {
    update = { ...fields, updated_at: now };
  } else if (caps.draft) {
    update = {
      draft: { ...(post.draft || {}), ...fields, saved_at: now },
      updated_at: now,
    };
  } else {
    // published, no working-copy column, not an explicit push: refuse quietly
    // so the client keeps the words safe locally instead.
    return NextResponse.json(
      { error: "local-only", post, caps },
      { status: 409 }
    );
  }

  // compare-and-swap: the UPDATE itself is conditional on updated_at, so two
  // devices racing inside one round-trip can't silently clobber each other —
  // the loser gets zero rows back and the 409 conflict payload.
  let query = admin.from("posts").update(update).eq("id", id);
  if (body.baseUpdatedAt) {
    query = query.eq("updated_at", body.baseUpdatedAt);
  }
  const { data: updatedRows, error: updateError } = await query.select("*");
  if (updateError) {
    console.error("Error saving post:", updateError);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
  const updated = updatedRows?.[0];
  if (!updated) {
    const { data: latest } = await admin
      .from("posts")
      .select("*")
      .eq("id", id)
      .single();
    return NextResponse.json(
      { error: "conflict", post: latest ?? post, caps },
      { status: 409 }
    );
  }

  // a quiet revision trail while writing (throttled to one per 10 minutes)
  const effective = post.is_draft || body.mode === "direct" ? updated : {
    ...updated,
    ...(updated.draft || {}),
  };
  await maybeAutosnap(admin, caps, effective).catch(() => {});

  return NextResponse.json({ post: updated, caps });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from("posts").delete().eq("id", id);
  if (error) {
    console.error("Error deleting post:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
