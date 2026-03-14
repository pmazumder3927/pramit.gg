import { redirect } from "next/navigation";
import { createMetadata } from "@/app/lib/metadata";
import { createClient } from "@/utils/supabase/server";
import { MusicManagerShell } from "@/app/music/components/MusicManagerShell";

export const metadata = createMetadata({
  title: "its 3 am",
  description:
    "Late-night music curation — review, sequence, and shape playlists.",
  noIndex: true,
});

export default async function MusicManageLayout({
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

  return <MusicManagerShell>{children}</MusicManagerShell>;
}
