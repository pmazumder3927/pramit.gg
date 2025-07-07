import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import SecretDashboard from './components/SecretDashboard'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Pramit Mazumder - Software Engineer & Creative Technologist',
    template: '%s | Pramit Mazumder'
  },
  description: 'Pramit Mazumder\'s personal website - a living journal of interests, projects, and experiences in software engineering, AI, robotics, and creative technology.',
  keywords: ['Pramit Mazumder', 'Pramit', 'Software Engineer', 'AI', 'Robotics', 'Reinforcement Learning', 'Creative Technology', 'pramit.gg'],
  authors: [{ name: 'Pramit Mazumder' }],
  creator: 'Pramit Mazumder',
  publisher: 'Pramit Mazumder',
  metadataBase: new URL('https://pramit.gg'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Pramit Mazumder - Software Engineer & Creative Technologist',
    description: 'Explore Pramit Mazumder\'s digital space - featuring projects, thoughts, and experiences in technology and creativity.',
    url: 'https://pramit.gg',
    siteName: 'Pramit Mazumder',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'Pramit Mazumder - Personal Website',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pramit Mazumder - Software Engineer & Creative Technologist',
    description: 'Explore Pramit Mazumder\'s digital space - featuring projects, thoughts, and experiences.',
    images: ['/api/og'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Add your Google Search Console verification code here
    // google: 'your-google-verification-code',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Pramit Mazumder',
    url: 'https://pramit.gg',
    sameAs: [
      'https://github.com/pmazumder3927',
      'https://www.instagram.com/mazoomzoom/',
    ],
    jobTitle: 'Software Engineer',
    knowsAbout: ['Software Engineering', 'Artificial Intelligence', 'Robotics', 'Reinforcement Learning', 'Creative Technology'],
    email: 'me@pramit.gg',
  }

  return (
    <html lang="en" className={inter.className}>
      <head>
        <Script
          id="json-ld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <link rel="canonical" href="https://pramit.gg" />
        <meta name="author" content="Pramit Mazumder" />
      </head>
      <body className="grain min-h-screen">
        <SecretDashboard />
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  )
} 