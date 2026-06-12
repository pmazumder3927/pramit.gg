import type { SupabaseClient } from "@supabase/supabase-js";

// Server-side helpers for the writing room API routes.
//
// The room is designed to degrade gracefully when the optional migration
// (supabase/migrations/20260611_writing_room.sql) hasn't been applied:
//   - no posts.draft column  -> published posts autosave locally only and the
//     owner pushes changes explicitly ("set the page" writes the live row)
//   - no post_revisions table -> "earlier ink" is hidden
// detectCaps probes for both and the routes/UI branch on the result.

export type WritingCaps = { draft: boolean; revisions: boolean };

// Fields the room edits. Slug and is_draft are deliberately NOT here — both
// only move through explicit actions (publish / set-page / re-cut slug).
export const EDITABLE_FIELDS = [
  "title",
  "content",
  "type",
  "media_url",
  "tags",
  "description",
  "display_size",
  "meta_image",
  "is_pinned",
] as const;
export type EditableField = (typeof EDITABLE_FIELDS)[number];

export function pickEditable(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in input) out[key] = input[key];
  }
  return out;
}

let capsCache: { value: WritingCaps; at: number } | null = null;
const CAPS_TTL_MS = 5 * 60 * 1000; // re-probe so a later migration is picked up

export async function detectCaps(admin: SupabaseClient): Promise<WritingCaps> {
  if (capsCache && Date.now() - capsCache.at < CAPS_TTL_MS) {
    return capsCache.value;
  }
  const [draftProbe, revProbe] = await Promise.all([
    admin.from("posts").select("draft").limit(1),
    admin.from("post_revisions").select("id").limit(1),
  ]);
  const value = { draft: !draftProbe.error, revisions: !revProbe.error };
  capsCache = { value, at: Date.now() };
  return value;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A slug is "unminted" while it's empty or still the internal draft slug. */
export function isUnmintedSlug(slug: string | null | undefined): boolean {
  return !slug || /^untitled-[a-z0-9]+$/.test(slug);
}

export function freshDraftSlug(): string {
  return `untitled-${Math.random().toString(36).slice(2, 8)}`;
}

/** Mint a unique slug from a title at first publish. Never regenerated after. */
export async function mintSlug(
  admin: SupabaseClient,
  title: string,
  excludeId: string
): Promise<string> {
  const base = slugify(title) || "entry";
  const { data } = await admin
    .from("posts")
    .select("slug")
    .or(`slug.eq.${base},slug.like.${base}-%`)
    .neq("id", excludeId);
  const taken = new Set((data || []).map((r: { slug: string }) => r.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }
}

type SnapshotSource = {
  id: string;
  title: string;
  content: string | null;
  type: string;
  tags: string[] | null;
  media_url?: string | null;
  description?: string | null;
};

export function buildSnapshot(post: SnapshotSource) {
  return {
    title: post.title,
    content: post.content || "",
    type: post.type,
    tags: post.tags || [],
    media_url: post.media_url || null,
    description: post.description || null,
  };
}

const AUTOSNAP_MIN_GAP_MS = 10 * 60 * 1000;

/** Snapshot at most once per 10 minutes of active writing. */
export async function maybeAutosnap(
  admin: SupabaseClient,
  caps: WritingCaps,
  post: SnapshotSource
) {
  if (!caps.revisions || !post.content?.trim()) return;
  const { data } = await admin
    .from("post_revisions")
    .select("created_at")
    .eq("post_id", post.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const last = data?.[0]?.created_at;
  if (last && Date.now() - new Date(last).getTime() < AUTOSNAP_MIN_GAP_MS) {
    return;
  }
  await admin.from("post_revisions").insert({
    post_id: post.id,
    kind: "autosnap",
    snapshot: buildSnapshot(post),
  });
}

/** All tags ever used, most-used first — the "ones you've used —" row. */
export function tagVocabularyFrom(
  rows: { tags: string[] | null }[] | null
): string[] {
  const counts = new Map<string, number>();
  for (const row of rows || []) {
    for (const tag of row.tags || []) {
      const t = String(tag).toLowerCase();
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);
}

export async function snapshotPublish(
  admin: SupabaseClient,
  caps: WritingCaps,
  post: SnapshotSource
) {
  if (!caps.revisions) return;
  await admin.from("post_revisions").insert({
    post_id: post.id,
    kind: "publish",
    snapshot: buildSnapshot(post),
  });
}
