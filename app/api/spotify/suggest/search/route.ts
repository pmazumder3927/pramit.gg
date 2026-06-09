import { NextRequest, NextResponse } from "next/server";

import { searchTracks } from "@/app/lib/spotify-suggest";

// Light in-memory per-IP throttle so a key-masher can't burn the Spotify search
// quota. Mirrors the in-memory posture of the now-playing cache — best-effort,
// resets on cold start, no external store.
const WINDOW_MS = 10_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);

  // Opportunistically trim the map so it can't grow unbounded.
  if (hits.size > 500) {
    hits.forEach((times, key) => {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
    });
  }

  return recent.length > MAX_PER_WINDOW;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 100);

  if (q.trim().length < 2) {
    return NextResponse.json({ tracks: [] }, { status: 200 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anon";

  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "slow down a sec — too many searches" },
      { status: 429 }
    );
  }

  try {
    const tracks = await searchTracks(q, 5);
    return NextResponse.json(
      { tracks },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[suggest/search] error:", error);
    return NextResponse.json(
      { error: "search is napping. try again in a moment." },
      { status: 502 }
    );
  }
}
