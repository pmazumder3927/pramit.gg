import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode } from "@/app/lib/spotify";
import {
  LISTENER_COOKIE,
  LISTENER_FLAG_COOKIE,
  listenerCookieOptions,
  sessionFromTokenResponse,
} from "@/app/lib/spotify-listener";

// Per-visitor refresh tokens are long-lived; keep the cookie around a while.
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function back(origin: string, returnTo: string, params: Record<string, string>) {
  const dest = new URL(returnTo, origin);
  for (const [k, v] of Object.entries(params)) dest.searchParams.set(k, v);
  return dest.toString();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const cookieStore = await cookies();
  const returnTo = cookieStore.get("spotify_listen_return")?.value || "/";
  const storedState = cookieStore.get("spotify_listen_state")?.value;

  const clearTransient = (response: NextResponse) => {
    response.cookies.delete("spotify_listen_state");
    response.cookies.delete("spotify_listen_return");
    return response;
  };

  if (error) {
    return clearTransient(
      NextResponse.redirect(back(url.origin, returnTo, { listen_along: error }))
    );
  }

  if (!code || !state || state !== storedState) {
    return clearTransient(
      NextResponse.redirect(
        back(url.origin, returnTo, { listen_along: "auth_failed" })
      )
    );
  }

  try {
    const origin = url.origin.replace("://localhost:", "://127.0.0.1:");
    const redirect_uri = `${origin}/api/spotify/listen-along/callback`;
    const tokenResponse = await exchangeCode(code, redirect_uri);
    const session = sessionFromTokenResponse(tokenResponse);

    const response = NextResponse.redirect(
      back(url.origin, returnTo, { listen_along: "connected" })
    );
    response.cookies.set(
      LISTENER_COOKIE,
      JSON.stringify(session),
      listenerCookieOptions(SESSION_MAX_AGE)
    );
    // Readable flag so the client can detect a connected session.
    response.cookies.set(LISTENER_FLAG_COOKIE, "1", {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return clearTransient(response);
  } catch (err) {
    console.error("Listen-along OAuth error:", err);
    return clearTransient(
      NextResponse.redirect(
        back(url.origin, returnTo, { listen_along: "auth_failed" })
      )
    );
  }
}
