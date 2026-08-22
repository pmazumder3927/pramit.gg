import "server-only";

import { createAdminClient } from "@/utils/supabase/admin";

/** Tiny key/value store for the manager's singletons (sync stamp, pointers). */
export async function getSetting<T>(key: string): Promise<T | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("music_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return (data?.value as T) ?? null;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("music_settings")
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
}
