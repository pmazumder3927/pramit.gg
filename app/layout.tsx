import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import SecretDashboard from './components/SecretDashboard'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'pramit.gg',
  description: 'a living, evolving journal of interests, projects, and experiences',
  metadataBase: new URL('https://pramit.gg'),
  verification: {
    google: 'your-google-site-verification-code', // Add your Google verification code
  },
  openGraph: {
    title: 'pramit.gg',
    description: 'a living, evolving journal of interests, projects, and experiences',
    url: 'https://pramit.gg',
    siteName: 'pramit.gg',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: 'https://pramit.gg/og-default.jpg',
        width: 1200,
        height: 630,
        alt: 'pramit.gg',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'pramit.gg',
    description: 'a living, evolving journal of interests, projects, and experiences',
    images: ['https://pramit.gg/og-default.jpg'],
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
        <SecretDashboard />
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  )
} 