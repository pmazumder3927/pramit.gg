import { createAdminClient } from "@/utils/supabase/admin";
import { detectCaps, tagVocabularyFrom } from "@/app/lib/writing-server";
import WritingRoom from "./WritingRoom";

// A fresh page. The row is created on the first non-empty autosave, and the
// URL quietly becomes /write/[id] — refresh-safe from the first sentence.
export const dynamic = "force-dynamic";

export default async function WritePage() {
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
