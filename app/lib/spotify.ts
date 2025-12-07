import { createAdminClient } from "@/utils/supabase/admin";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: Date;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

/**
 * Get Spotify credentials from environment variables
 */
function getClientCredentials() {
  const client_id = process.env.SPOTIFY_CLIENT_ID;
  const client_secret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!client_id || !client_secret) {
    throw new Error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET");
  }

  return { client_id, client_secret };
}

/**
 * Fetch stored tokens from Supabase
 */
async function getStoredTokens(): Promise<SpotifyTokens | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("spotify_credentials")
    .select("access_token, refresh_token, expires_at")
    .single();

  if (error || !data) {
    return null;
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: new Date(data.expires_at),
  };
}

/**
 * Save tokens to Supabase (upsert pattern for singleton)
 */
async function saveTokens(tokens: SpotifyTokens): Promise<void> {
  const supabase = createAdminClient();

  // First try to get existing row
  const { data: existing } = await supabase
    .from("spotify_credentials")
    .select("id")
    .single();

  if (existing) {
    // Update existing row
    await supabase
      .from("spotify_credentials")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expires_at.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    // Insert new row
    await supabase.from("spotify_credentials").insert({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_at.toISOString(),
    });
  }
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(
  refresh_token: string
): Promise<TokenResponse> {
  const { client_id, client_secret } = getClientCredentials();

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${client_id}:${client_secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  return response.json();
}

/**
 * Get a valid access token, refreshing if necessary
 * This is the main function to use in API routes
 */
export async function getAccessToken(): Promise<string> {
  const stored = await getStoredTokens();

  if (!stored) {
    throw new Error(
      "Spotify not connected. Please connect your Spotify account in the dashboard."
    );
  }

  // Check if token is expired (with 5 minute buffer)
  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // 5 minutes
  const isExpired = stored.expires_at.getTime() - bufferMs < now.getTime();

  if (!isExpired) {
    return stored.access_token;
  }

  // Token is expired, refresh it
  const tokenResponse = await refreshAccessToken(stored.refresh_token);

  // Calculate new expiry time
  const expires_at = new Date(
    Date.now() + tokenResponse.expires_in * 1000
  );

  // Save updated tokens (Spotify may return a new refresh token)
  await saveTokens({
    access_token: tokenResponse.access_token,
    refresh_token: tokenResponse.refresh_token || stored.refresh_token,
    expires_at,
  });

  return tokenResponse.access_token;
}

/**
 * Exchange authorization code for tokens (used in OAuth callback)
 */
export async function exchangeCodeForTokens(
  code: string,
  redirect_uri: string
): Promise<void> {
  const { client_id, client_secret } = getClientCredentials();

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${client_id}:${client_secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  const tokenResponse: TokenResponse = await response.json();

  if (!tokenResponse.refresh_token) {
    throw new Error("No refresh token received from Spotify");
  }

  // Calculate expiry time
  const expires_at = new Date(
    Date.now() + tokenResponse.expires_in * 1000
  );

  // Save tokens to database
  await saveTokens({
    access_token: tokenResponse.access_token,
    refresh_token: tokenResponse.refresh_token,
    expires_at,
  });
}

/**
 * Check if Spotify is connected
 */
export async function isSpotifyConnected(): Promise<boolean> {
  try {
    const stored = await getStoredTokens();
    return stored !== null;
  } catch {
    return false;
  }
}

/**
 * Disconnect Spotify (remove stored credentials)
 */
export async function disconnectSpotify(): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("spotify_credentials").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}
