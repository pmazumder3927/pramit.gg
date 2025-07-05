import { NextResponse } from 'next/server'

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_NOW_PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing'
const SPOTIFY_RECENTLY_PLAYED_URL = 'https://api.spotify.com/v1/me/player/recently-played?limit=1'

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

    // Try to get currently playing track
    const nowPlayingResponse = await fetch(SPOTIFY_NOW_PLAYING_URL, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    })

    if (nowPlayingResponse.status === 200) {
      const nowPlaying = await nowPlayingResponse.json()
      
      if (nowPlaying.is_playing) {
        return NextResponse.json({
          isPlaying: true,
          title: nowPlaying.item.name,
          artist: nowPlaying.item.artists.map((artist: any) => artist.name).join(', '),
          album: nowPlaying.item.album.name,
          albumImageUrl: nowPlaying.item.album.images[0]?.url,
          songUrl: nowPlaying.item.external_urls.spotify,
          progress: nowPlaying.progress_ms,
          duration: nowPlaying.item.duration_ms,
        })
      }
    }

    // If nothing is currently playing, get the last played track
    const recentlyPlayedResponse = await fetch(SPOTIFY_RECENTLY_PLAYED_URL, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    })

    if (recentlyPlayedResponse.ok) {
      const recentlyPlayed = await recentlyPlayedResponse.json()
      const lastTrack = recentlyPlayed.items[0]

      if (lastTrack) {
        return NextResponse.json({
          isPlaying: false,
          title: lastTrack.track.name,
          artist: lastTrack.track.artists.map((artist: any) => artist.name).join(', '),
          album: lastTrack.track.album.name,
          albumImageUrl: lastTrack.track.album.images[0]?.url,
          songUrl: lastTrack.track.external_urls.spotify,
          playedAt: lastTrack.played_at,
        })
      }
    }

    return NextResponse.json({
      isPlaying: false,
      title: 'nothing',
      artist: '',
      album: '',
      albumImageUrl: null,
      songUrl: null,
    })

  } catch (error) {
    console.error('Spotify API error:', error)
    return NextResponse.json({
      isPlaying: false,
      title: 'nothing',
      artist: '',
      album: '',
      albumImageUrl: null,
      songUrl: null,
    }, { status: 500 })
  }
} 