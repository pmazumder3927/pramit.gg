import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  LISTENER_COOKIE,
  LISTENER_FLAG_COOKIE,
  ensureFreshSession,
  listenerCookieOptions,
  parseListenerCookie,
} from "@/app/lib/spotify-listener";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

// Returns the *visitor's own* Spotify access token (theirs, not the owner's) so
// their browser can drive the Web Playback SDK and their own playback. Refreshes
// transparently and re-sets the cookie when it does.
export async function GET() {
  const cookieStore = await cookies();
  const session = parseListenerCookie(cookieStore.get(LISTENER_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  try {
    const { session: fresh, refreshed } = await ensureFreshSession(session);
    const response = NextResponse.json({
      token: fresh.access_token,
      expiresAt: fresh.expires_at,
    });
    if (refreshed) {
      response.cookies.set(
        LISTENER_COOKIE,
        JSON.stringify(fresh),
        listenerCookieOptions(SESSION_MAX_AGE)
      );
    }
    return response;
  } catch (err) {
    console.error("Listen-along token refresh failed:", err);
    // Refresh token is dead — clear the session so the client re-auths.
    const response = NextResponse.json(
      { error: "refresh_failed" },
      { status: 401 }
    );
    response.cookies.delete(LISTENER_COOKIE);
    response.cookies.delete(LISTENER_FLAG_COOKIE);
    return response;
  }
}
