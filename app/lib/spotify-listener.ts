import { refreshAccessToken, type TokenResponse } from "./spotify";

// Per-visitor Spotify session for the "listen along" feature. Unlike the owner
// credentials (a single Supabase row), each visitor's tokens live only in their
// own httpOnly cookie — they are never persisted server-side and never mix with
// the owner's account.
export const LISTENER_COOKIE = "spotify_listener";
// Non-httpOnly companion flag so client JS can cheaply tell whether the visitor
// has connected, without exposing the tokens themselves.
export const LISTENER_FLAG_COOKIE = "spotify_listener_on";

const REFRESH_BUFFER_MS = 60 * 1000; // refresh 1 min before expiry

export interface ListenerSession {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
}

export function parseListenerCookie(raw: string | undefined): ListenerSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ListenerSession>;
    if (
      typeof parsed.access_token === "string" &&
      typeof parsed.refresh_token === "string" &&
      typeof parsed.expires_at === "number"
    ) {
      return parsed as ListenerSession;
    }
  } catch {
    // fall through
  }
  return null;
}

export function sessionFromTokenResponse(
  tokenResponse: TokenResponse,
  previousRefreshToken?: string
): ListenerSession {
  const refresh_token = tokenResponse.refresh_token || previousRefreshToken;
  if (!refresh_token) {
    throw new Error("No refresh token available for listen-along session");
  }
  return {
    access_token: tokenResponse.access_token,
    refresh_token,
    expires_at: Date.now() + tokenResponse.expires_in * 1000,
  };
}

/**
 * Return a still-valid session, refreshing the access token if it's close to
 * expiry. `refreshed` indicates the caller should re-set the cookie.
 */
export async function ensureFreshSession(
  session: ListenerSession
): Promise<{ session: ListenerSession; refreshed: boolean }> {
  if (session.expires_at - REFRESH_BUFFER_MS > Date.now()) {
    return { session, refreshed: false };
  }
  const tokenResponse = await refreshAccessToken(session.refresh_token);
  return {
    session: sessionFromTokenResponse(tokenResponse, session.refresh_token),
    refreshed: true,
  };
}

export function listenerCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
