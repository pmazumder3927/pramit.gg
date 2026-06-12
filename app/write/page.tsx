import { redirect } from "next/navigation";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { detectCaps, tagVocabularyFrom } from "@/app/lib/writing-server";
import WritingRoom from "./WritingRoom";

// A fresh page. The row is created on the first non-empty autosave, and the
// URL quietly becomes /write/[id] — refresh-safe from the first sentence.
export const dynamic = "force-dynamic";

export default async function WritePage() {
  // the layout gates too, but this page touches the service-role client —
  // it must verify the session itself, not trust its wrapper
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/api/auth/login");

  const admin = createAdminClient();
  const [caps, { data: tagRows }] = await Promise.all([
    detectCaps(admin),
    admin.from("posts").select("tags"),
  ]);

  return (
    <WritingRoom
      initialPost={null}
      initialCaps={caps}
      tagVocabulary={tagVocabularyFrom(tagRows)}
    />
  );
}
