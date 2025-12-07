import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { exchangeCodeForTokens } from "@/app/lib/spotify";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Handle Spotify authorization errors
  if (error) {
    return NextResponse.redirect(
      `${url.origin}/dashboard?spotify_error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${url.origin}/dashboard?spotify_error=${encodeURIComponent("Missing authorization code or state")}`
    );
  }

  // Verify state to prevent CSRF attacks
  const cookieStore = await cookies();
  const storedState = cookieStore.get("spotify_auth_state")?.value;

  if (state !== storedState) {
    return NextResponse.redirect(
      `${url.origin}/dashboard?spotify_error=${encodeURIComponent("Invalid state parameter")}`
    );
  }

  // Check if user is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      `${url.origin}/dashboard?spotify_error=${encodeURIComponent("Not authenticated")}`
    );
  }

  try {
    // Exchange code for tokens and save to database
    // Must match the redirect_uri used in auth route
    const origin = url.origin.replace("://localhost:", "://127.0.0.1:");
    const redirect_uri = `${origin}/api/spotify/callback`;
    await exchangeCodeForTokens(code, redirect_uri);

    // Clear state cookie
    const response = NextResponse.redirect(
      `${url.origin}/dashboard?spotify_success=true`
    );
    response.cookies.delete("spotify_auth_state");

    return response;
  } catch (err) {
    console.error("Spotify OAuth error:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Failed to connect Spotify";
    return NextResponse.redirect(
      `${url.origin}/dashboard?spotify_error=${encodeURIComponent(errorMessage)}`
    );
  }
}
