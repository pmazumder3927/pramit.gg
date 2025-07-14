import { createMetadata } from '@/app/lib/metadata';
import { Metadata } from 'next';
import MusicClient from './MusicClient';

export const metadata: Metadata = createMetadata({
  title: 'Music | pramit.gg',
  description: 'Explore Pramit\'s music taste and discover what he\'s currently listening to on Spotify. Find curated playlists and recently played tracks.',
  path: '/music',
});

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
