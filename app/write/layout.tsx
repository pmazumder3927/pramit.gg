import { redirect } from "next/navigation";
import { createMetadata } from "@/app/lib/metadata";
import { createClient } from "@/utils/supabase/server";

export const metadata = createMetadata({
  title: "the writing room",
  description: "ghost light — where the entries get written.",
  noIndex: true,
});

// The room owns the screen: no site nav, no tab bar (they step aside for
// /write routes), just the sheet and its wings.
export default async function WriteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/api/auth/login");
  }

  return <>{children}</>;
}
