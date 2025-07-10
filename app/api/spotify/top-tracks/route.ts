import { NextResponse } from 'next/server'

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_TOP_TRACKS_URL = 'https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=short_term'

async function getAccessToken() {
  const refresh_token = process.env.SPOTIFY_REFRESH_TOKEN
  const client_id = process.env.SPOTIFY_CLIENT_ID
  const client_secret = process.env.SPOTIFY_CLIENT_SECRET

  if (!refresh_token || !client_id || !client_secret) {
    throw new Error('Missing Spotify credentials')
  }

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${client_id}:${client_secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to refresh token')
  }

  return response.json()
}

export async function GET() {
  try {
    const { access_token } = await getAccessToken()

    const response = await fetch(SPOTIFY_TOP_TRACKS_URL, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    })

    if (response.ok) {
      const data = await response.json()
      const tracks = data.items.map((track: any) => ({
        id: track.id,
        title: track.name,
        artist: track.artists.map((artist: any) => artist.name).join(', '),
        album: track.album.name,
        albumImageUrl: track.album.images[0]?.url,
        songUrl: track.external_urls.spotify,
        duration: track.duration_ms,
        preview_url: track.preview_url,
        popularity: track.popularity,
        explicit: track.explicit,
      }))

      return NextResponse.json({ tracks })
    }

    return NextResponse.json({ tracks: [] })

  } catch (error) {
    console.error('Spotify Top Tracks API error:', error)
    return NextResponse.json({ tracks: [] }, { status: 500 })
  }
}