import { createMetadata } from '@/app/lib/metadata';
import { Metadata } from 'next';
import AboutClient from './AboutClient';

export const metadata: Metadata = createMetadata({
  title: 'About | pramit.gg',
  description: 'Learn about Pramit Mazumder - a passionate developer interested in reinforcement learning, robotics, bouldering, and electronic music production.',
  path: '/about',
});

export default function About() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Pramit Mazumder',
    url: 'https://pramit.gg',
    sameAs: [
      'https://github.com/pramitmazumder',
      'https://instagram.com/pramitmazumder',
    ],
    knowsAbout: [
      'Reinforcement Learning',
      'Robotics',
      'Bouldering',
      'Electronic Music Production',
      'Web Development',
      'Software Engineering',
    ],
    description: 'A passionate developer interested in reinforcement learning, robotics, bouldering, and electronic music production.',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
      <AboutClient />
    </>
  );
} 