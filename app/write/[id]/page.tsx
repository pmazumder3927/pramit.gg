import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { detectCaps, tagVocabularyFrom } from "@/app/lib/writing-server";
import { Post } from "@/app/lib/supabase";
import WritingRoom from "../WritingRoom";

// Reopen an entry — by id, never slug (slugs are mutable history, ids aren't).
export const dynamic = "force-dynamic";

export default async function WriteEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // the layout gates too, but this page touches the service-role client —
  // it must verify the session itself, not trust its wrapper
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/api/auth/login");

  const { id } = await params;
  const admin = createAdminClient();

  const [caps, postRes, tagRes] = await Promise.all([
    detectCaps(admin),
    admin.from("posts").select("*").eq("id", id).maybeSingle(),
    admin.from("posts").select("tags"),
  ]);

  const post = (postRes.data as Post | null) ?? null;
  if (postRes.error || !post) {
    notFound();
  }

  return (
    <WritingRoom
      key={post.id}
      initialPost={post}
      initialCaps={caps}
      tagVocabulary={tagVocabularyFrom(tagRes.data)}
    />
  );
}
