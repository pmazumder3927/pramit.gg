import { NextResponse } from "next/server";

import {
  fetchLatestHomepageBanner,
  generateHomepageBanner,
} from "@/app/lib/homepage-banner";
import { createClient, createPublicClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  const supabase = createPublicClient();
  const banner = await fetchLatestHomepageBanner(supabase);
  return NextResponse.json({ banner }, { status: 200 });
}

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  try {
    const banner = await generateHomepageBanner(supabase);
    return NextResponse.json({ banner }, { status: 200 });
  } catch (error) {
    console.error("Banner generation error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate banner";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
