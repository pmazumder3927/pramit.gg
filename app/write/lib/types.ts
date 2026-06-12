import { CardSize, Post } from "@/app/lib/supabase";
import { PostType, POST_TYPES } from "@/app/lib/postTypes";

export type Caps = { draft: boolean; revisions: boolean };

/** The fields the room edits — slug and is_draft move only through ceremonies. */
export type Working = {
  title: string;
  content: string;
  type: PostType;
  tags: string[];
  media_url: string;
  description: string;
  display_size: "" | CardSize;
  meta_image: string;
  is_pinned: boolean;
};

export const EMPTY_WORKING: Working = {
  title: "",
  content: "",
  type: "note",
  tags: [],
  media_url: "",
  description: "",
  display_size: "",
  meta_image: "",
  is_pinned: false,
};

function asType(value: unknown): PostType {
  return POST_TYPES.includes(value as PostType) ? (value as PostType) : "note";
}

/**
 * Editor state from a post row. For a published post with a pending working
 * copy (the draft jsonb buffer), the buffer overlays the live fields — the
 * room always shows the freshest ink.
 */
export function workingFrom(post: Post | null): Working {
  if (!post) return EMPTY_WORKING;
  const overlay = (!post.is_draft && post.draft) || {};
  const merged = { ...post, ...overlay } as Record<string, unknown>;
  return {
    title: String(merged.title ?? ""),
    content: String(merged.content ?? ""),
    type: asType(merged.type),
    tags: Array.isArray(merged.tags) ? (merged.tags as string[]) : [],
    media_url: String(merged.media_url ?? ""),
    description: String(merged.description ?? ""),
    display_size: (merged.display_size as Working["display_size"]) || "",
    meta_image: String(merged.meta_image ?? ""),
    is_pinned: Boolean(merged.is_pinned),
  };
}

/** The live (in-print) fields only — what readers currently see. */
export function printedFrom(post: Post): Working {
  return workingFrom({ ...post, draft: null });
}

export function workingEqual(a: Working, b: Working): boolean {
  return (
    a.title === b.title &&
    a.content === b.content &&
    a.type === b.type &&
    a.media_url === b.media_url &&
    a.description === b.description &&
    a.display_size === b.display_size &&
    a.meta_image === b.meta_image &&
    a.is_pinned === b.is_pinned &&
    a.tags.length === b.tags.length &&
    a.tags.every((t, i) => b.tags[i] === t)
  );
}

export type SaveStatus =
  | "blank" // nothing written yet (new entry)
  | "drying" // changes pending / in flight
  | "dry" // safely on the shelf
  | "kept" // published post: working copy saved, not yet in print
  | "local" // saved on this device only (no draft column for published posts)
  | "offline"; // server unreachable; words safe locally

export type Revision = {
  id: string;
  kind: string;
  created_at: string;
  snapshot: {
    title?: string;
    content?: string;
    type?: string;
    tags?: string[];
    media_url?: string | null;
    description?: string | null;
  };
};

export const localKeyFor = (id: string | null) =>
  `writing-room:${id ?? "new"}`;

export type LocalSnapshot = { working: Working; t: number };

export function readLocal(id: string | null): LocalSnapshot | null {
  try {
    const raw = localStorage.getItem(localKeyFor(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.t !== "number" || !parsed.working) return null;
    return parsed as LocalSnapshot;
  } catch {
    return null;
  }
}

export function writeLocal(id: string | null, working: Working) {
  try {
    localStorage.setItem(
      localKeyFor(id),
      JSON.stringify({ working, t: Date.now() })
    );
  } catch {
    /* storage full or unavailable — the server layer still has us */
  }
}

export function clearLocal(id: string | null) {
  try {
    localStorage.removeItem(localKeyFor(id));
  } catch {
    /* ignore */
  }
}
