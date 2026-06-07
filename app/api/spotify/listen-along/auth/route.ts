import { NextResponse } from "next/server";

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";

// Minimal scopes for a visitor to mirror the owner's playback on their own
// Spotify: stream via the Web Playback SDK and control their own playback.
// `user-read-email`/`user-read-private` are required by the `streaming` scope.
const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
].join(" ");

export async function GET(request: Request) {
  const client_id = process.env.SPOTIFY_CLIENT_ID;
  if (!client_id) {
    return NextResponse.json(
      { error: "SPOTIFY_CLIENT_ID not configured" },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  // Spotify rejects "localhost" redirect URIs — use 127.0.0.1 in local dev.
  const origin = url.origin.replace("://localhost:", "://127.0.0.1:");
  const redirect_uri = `${origin}/api/spotify/listen-along/callback`;

  // Where to send the visitor back after connecting (defaults to home).
  const rawReturn = url.searchParams.get("return") || "/";
  const returnTo = rawReturn.startsWith("/") ? rawReturn : "/";

  const state = crypto.randomUUID();

  const authUrl = new URL(SPOTIFY_AUTH_URL);
  authUrl.searchParams.set("client_id", client_id);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirect_uri);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set("spotify_listen_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });
  response.cookies.set("spotify_listen_return", returnTo, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });
  return response;
}
