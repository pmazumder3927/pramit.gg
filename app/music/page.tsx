import { Metadata } from 'next';
import MusicClient from './MusicClient';

export const metadata: Metadata = {
  title: 'Music | pramit.gg',
  description: 'Explore Pramit\'s music taste and discover what he\'s currently listening to on Spotify. Find curated playlists and recently played tracks.',
  metadataBase: new URL('https://pramit.gg'),
  alternates: {
    canonical: 'https://pramit.gg/music',
  },
  openGraph: {
    title: 'Music | pramit.gg',
    description: 'Explore Pramit\'s music taste and discover what he\'s currently listening to on Spotify. Find curated playlists and recently played tracks.',
    url: 'https://pramit.gg/music',
    siteName: 'pramit.gg',
    images: [
      {
        url: 'https://pramit.gg/og-music.jpg',
        width: 1200,
        height: 630,
        alt: 'Music - pramit.gg',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Music | pramit.gg',
    description: 'Explore Pramit\'s music taste and discover what he\'s currently listening to on Spotify.',
    images: ['https://pramit.gg/og-music.jpg'],
  },
  keywords: 'music, spotify, playlists, electronic music, now playing, pramit mazumder',
  authors: [{ name: 'Pramit Mazumder' }],
  creator: 'Pramit Mazumder',
};

export default function Music() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Music | pramit.gg',
    description: 'Explore Pramit\'s music taste and discover what he\'s currently listening to on Spotify.',
    url: 'https://pramit.gg/music',
    mainEntity: {
      '@type': 'MusicPlaylist',
      name: 'Pramit\'s Music Collection',
      description: 'A curated collection of music that Pramit is currently listening to.',
      creator: {
        '@type': 'Person',
        name: 'Pramit Mazumder',
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
      <MusicClient />
    </>
  );
}
