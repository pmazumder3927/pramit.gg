import { redirect } from "next/navigation";
import { createMetadata } from "@/app/lib/metadata";
import { createClient } from "@/utils/supabase/server";
import { ManagerShell } from "./components/ManagerShell";

export const metadata = createMetadata({
  title: "it's 3am",
  description: "Tending the library: sorting, shaping, letting go.",
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

  if (!user) redirect("/api/auth/login");

  return <ManagerShell>{children}</ManagerShell>;
}
