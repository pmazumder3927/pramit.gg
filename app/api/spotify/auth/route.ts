import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";

// Scopes needed for the features we use
const SCOPES = [
  "user-read-currently-playing",
  "user-read-recently-played",
  "user-top-read",
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");

export async function GET(request: Request) {
  // Check if user is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized. Please log in first." },
      { status: 401 }
    );
  }

  const client_id = process.env.SPOTIFY_CLIENT_ID;
  if (!client_id) {
    return NextResponse.json(
      { error: "SPOTIFY_CLIENT_ID not configured" },
      { status: 500 }
    );
  }

  // Build redirect URI from request URL
  const url = new URL(request.url);
  // Spotify doesn't allow localhost - must use 127.0.0.1 for local dev
  const origin = url.origin.replace("://localhost:", "://127.0.0.1:");
  const redirect_uri = `${origin}/api/spotify/callback`;

  // Generate state for CSRF protection
  const state = crypto.randomUUID();

  // Store state in cookie for verification
  const authUrl = new URL(SPOTIFY_AUTH_URL);
  authUrl.searchParams.set("client_id", client_id);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirect_uri);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("state", state);
  // Force consent dialog to always get refresh token
  authUrl.searchParams.set("show_dialog", "true");

  const response = NextResponse.redirect(authUrl.toString());

  // Set state cookie for callback verification
  response.cookies.set("spotify_auth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  });

  return response;
}
