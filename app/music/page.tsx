import { Metadata } from 'next'
import MusicClient from './MusicClient'

export const metadata: Metadata = {
  title: 'Music | pramit.gg',
  description: "Discover Pramit's music journey - recent listening history, favorite tracks, and curated playlists from Spotify.",
  openGraph: {
    title: 'Music - pramit.gg',
    description: "Discover Pramit's music journey - recent listening history, favorite tracks, and curated playlists from Spotify.",
    type: 'website',
  },
  alternates: {
    canonical: '/music',
  },
}

export default function MusicPage() {
  return (
    <>
      <MusicClient />
      
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Music - pramit.gg",
            description: "Music listening history and playlists",
            url: "https://pramit.gg/music",
            isPartOf: {
              "@type": "WebSite",
              name: "pramit.gg",
              url: "https://pramit.gg"
            }
          }),
        }}
      />
    </>
  )
}