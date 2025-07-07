import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import SecretDashboard from './components/SecretDashboard'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Pramit Mazumder - pramit.gg',
  description: 'Pramit Mazumder\'s personal website - a living, evolving journal of interests in reinforcement learning, robotics, bouldering, and electronic music production',
  metadataBase: new URL('https://pramit.gg'),
  keywords: ['Pramit Mazumder', 'Pramit', 'pramit.gg', 'reinforcement learning', 'robotics', 'bouldering', 'electronic music', 'personal blog'],
  authors: [{ name: 'Pramit Mazumder', url: 'https://pramit.gg' }],
  creator: 'Pramit Mazumder',
  publisher: 'Pramit Mazumder',
  alternates: {
    canonical: 'https://pramit.gg',
  },
  openGraph: {
    title: 'Pramit Mazumder - pramit.gg',
    description: 'Pramit Mazumder\'s personal website - a living, evolving journal of interests in reinforcement learning, robotics, bouldering, and electronic music production',
    url: 'https://pramit.gg',
    siteName: 'Pramit Mazumder',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Pramit Mazumder - pramit.gg',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pramit Mazumder - pramit.gg',
    description: 'Pramit Mazumder\'s personal website - exploring reinforcement learning, robotics, and creative pursuits',
    creator: '@pramit',
    images: ['/og-image.jpg'],
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
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.className}>
      <body className="grain min-h-screen">
        <script src="/structured-data.js" defer />
        <SecretDashboard />
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  )
} 