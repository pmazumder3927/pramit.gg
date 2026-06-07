import { NextResponse } from "next/server";
import {
  LISTENER_COOKIE,
  LISTENER_FLAG_COOKIE,
} from "@/app/lib/spotify-listener";

// Forget the visitor's listen-along session (clears their cookies only).
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(LISTENER_COOKIE);
  response.cookies.delete(LISTENER_FLAG_COOKIE);
  return response;
}
