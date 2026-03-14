import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAccessToken } from "@/app/lib/spotify";

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

type PlaybackRequest = {
  deviceId?: string | null;
  ensureActive?: boolean;
  uri?: string;
};

async function readSpotifyError(response: Response) {
  try {
    const payload = (await response.json()) as {
      error?: { message?: string; reason?: string } | string;
    };

    if (typeof payload.error === "string") {
      return payload.error;
    }

    return (
      payload.error?.reason ||
      payload.error?.message ||
      `${response.status} ${response.statusText}`
    );
  } catch {
    const text = await response.text();
    return text || `${response.status} ${response.statusText}`;
  }
}

async function spotifyPlayerRequest(
  accessToken: string,
  path: string,
  init: RequestInit
) {
  return fetch(`${SPOTIFY_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function transferPlayback(accessToken: string, deviceId: string) {
  return spotifyPlayerRequest(accessToken, "/me/player", {
    method: "PUT",
    body: JSON.stringify({
      device_ids: [deviceId],
      play: false,
    }),
  });
}

async function playTrack(
  accessToken: string,
  uri: string,
  deviceId?: string | null
) {
  const suffix = deviceId
    ? `?device_id=${encodeURIComponent(deviceId)}`
    : "";

  return spotifyPlayerRequest(accessToken, `/me/player/play${suffix}`, {
    method: "PUT",
    body: JSON.stringify({ uris: [uri] }),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { deviceId, ensureActive = false, uri } =
      (await request.json()) as PlaybackRequest;

    if (!uri) {
      return NextResponse.json({ error: "Missing track URI" }, { status: 400 });
    }

    const accessToken = await getAccessToken();
    let transferred = false;

    if (deviceId && ensureActive) {
      const transferResponse = await transferPlayback(accessToken, deviceId);

      if (transferResponse.ok || transferResponse.status === 204) {
        transferred = true;
      } else {
        const transferError = await readSpotifyError(transferResponse);
        return NextResponse.json(
          { error: transferError, playing: false, transferred },
          { status: 200 }
        );
      }
    }

    let response = await playTrack(accessToken, uri, deviceId);

    if (deviceId && response.status === 404) {
      const retryTransferResponse = await transferPlayback(accessToken, deviceId);
      if (retryTransferResponse.ok || retryTransferResponse.status === 204) {
        transferred = true;
        response = await playTrack(accessToken, uri, deviceId);
      }
    }

    if (response.status === 404) {
      return NextResponse.json(
        { error: "No active Spotify playback device was available.", playing: false },
        { status: 200 }
      );
    }

    if (!response.ok) {
      const text = await readSpotifyError(response);
      return NextResponse.json(
        { error: text, playing: false, transferred },
        { status: 200 }
      );
    }

    return NextResponse.json({ playing: true, transferred });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Playback failed";
    return NextResponse.json({ error: message, playing: false }, { status: 200 });
  }
}
