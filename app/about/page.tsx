import { Metadata } from 'next';
import AboutClient from './AboutClient';

export const metadata: Metadata = {
  title: 'About | pramit.gg',
  description: 'Learn about Pramit Mazumder - a passionate developer interested in reinforcement learning, robotics, bouldering, and electronic music production.',
  metadataBase: new URL('https://pramit.gg'),
  alternates: {
    canonical: 'https://pramit.gg/about',
  },
  openGraph: {
    title: 'About | pramit.gg',
    description: 'Learn about Pramit Mazumder - a passionate developer interested in reinforcement learning, robotics, bouldering, and electronic music production.',
    url: 'https://pramit.gg/about',
    siteName: 'pramit.gg',
    images: [
      {
        url: 'https://pramit.gg/og-about.jpg',
        width: 1200,
        height: 630,
        alt: 'About Pramit Mazumder',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About | pramit.gg',
    description: 'Learn about Pramit Mazumder - a passionate developer interested in reinforcement learning, robotics, bouldering, and electronic music production.',
    images: ['https://pramit.gg/og-about.jpg'],
  },
  keywords: 'pramit mazumder, about, developer, reinforcement learning, robotics, bouldering, electronic music',
  authors: [{ name: 'Pramit Mazumder' }],
  creator: 'Pramit Mazumder',
};

export default function About() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Pramit Mazumder',
    url: 'https://pramit.gg',
    sameAs: [
      'https://github.com/pramitmazumder', // Update with actual URLs
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