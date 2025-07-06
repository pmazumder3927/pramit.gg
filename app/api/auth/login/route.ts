import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
      }/api/auth/callback`,
    },
  });

  if (error) {
    return NextResponse.redirect(
      `${
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
      }/?error=Could not authenticate`
    );
  }

  return NextResponse.redirect(data.url);
}
