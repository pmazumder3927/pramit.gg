import { createAdminClient } from "@/utils/supabase/admin";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

// In-memory cache of the access token for this server instance. The token is
// valid for ~1h, so this lets getAccessToken() skip the Supabase read on the
// overwhelming majority of calls (now-playing is polled every few seconds).
let cachedToken: { access_token: string; expires_at_ms: number } | null = null;
const TOKEN_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: Date;
}

export interface TokenResponse {
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
 * Refresh the access token using the refresh token.
 * Raw call — does NOT persist anything. Used both by the owner token flow
 * (which saves the result) and the per-visitor listen-along flow (which keeps
 * the result in a cookie, never in the owner's credentials row).
 */
export async function refreshAccessToken(
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
  const nowMs = Date.now();

  // Fast path: a still-valid token cached in this server instance — no DB hit.
  if (cachedToken && cachedToken.expires_at_ms - TOKEN_BUFFER_MS > nowMs) {
    return cachedToken.access_token;
  }

  const stored = await getStoredTokens();

  if (!stored) {
    throw new Error(
      "Spotify not connected. Please connect your Spotify account in the dashboard."
    );
  }

  // Stored token still valid — cache it in memory and return.
  if (stored.expires_at.getTime() - TOKEN_BUFFER_MS > nowMs) {
    cachedToken = {
      access_token: stored.access_token,
      expires_at_ms: stored.expires_at.getTime(),
    };
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

  cachedToken = {
    access_token: tokenResponse.access_token,
    expires_at_ms: expires_at.getTime(),
  };

  return tokenResponse.access_token;
}

/**
 * Exchange an authorization code for tokens. Raw call — does NOT persist
 * anything. Used by the owner OAuth callback (which saves) and the per-visitor
 * listen-along callback (which stores the result in a cookie).
 */
export async function exchangeCode(
  code: string,
  redirect_uri: string
): Promise<TokenResponse> {
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

  return response.json();
}

/**
 * Exchange authorization code for tokens (used in the owner OAuth callback)
 */
export async function exchangeCodeForTokens(
  code: string,
  redirect_uri: string
): Promise<void> {
  const tokenResponse = await exchangeCode(code, redirect_uri);

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

  cachedToken = {
    access_token: tokenResponse.access_token,
    expires_at_ms: expires_at.getTime(),
  };
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
  cachedToken = null;
  const supabase = createAdminClient();
  await supabase.from("spotify_credentials").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}
