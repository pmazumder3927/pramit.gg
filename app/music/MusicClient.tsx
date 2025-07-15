import { Metadata } from 'next'
import MusicClient from './MusicClient'

export const metadata: Metadata = {
  title: 'Music | pramit.gg',
  description: 'Explore my music taste through recently played tracks, curated playlists, and live Spotify activity.',
  openGraph: {
    title: 'Music - pramit.gg',
    description: 'Explore my music taste through recently played tracks, curated playlists, and live Spotify activity.',
    type: 'website',
  },
  alternates: {
    canonical: '/music',
  },
}

export default function MusicPage() {
  return <MusicClient />
}