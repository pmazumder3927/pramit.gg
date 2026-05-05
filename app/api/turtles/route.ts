import { NextRequest, NextResponse } from "next/server";

import { createPublicClient } from "@/utils/supabase/server";

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 200;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit"));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.floor(limitParam), MAX_LIMIT)
      : DEFAULT_LIMIT;

  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("turtle_drawings")
    .select("id, strokes, prompt, created_at, snapshot_url")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Turtle gallery fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load gallery" },
      { status: 500 }
    );
  }

  return NextResponse.json({ turtles: data ?? [] }, { status: 200 });
}
