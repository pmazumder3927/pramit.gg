import { NextRequest, NextResponse } from "next/server";

import { getRecentSuggestions } from "@/app/lib/spotify-suggest";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit"));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.floor(limitParam), 40)
      : 14;

  // getRecentSuggestions already returns [] on any read error (e.g. the table
  // not existing yet), so the rack degrades to its empty state cleanly.
  const suggestions = await getRecentSuggestions(limit);

  return NextResponse.json(
    { suggestions },
    { headers: { "Cache-Control": "no-store" } }
  );
}
