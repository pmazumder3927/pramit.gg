import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import SecretDashboard from './components/SecretDashboard'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'pramit.gg',
  description: 'a living, evolving journal of interests, projects, and experiences',
  metadataBase: new URL('https://pramit.gg'),
  openGraph: {
    title: 'pramit.gg',
    description: 'a living, evolving journal of interests, projects, and experiences',
    url: 'https://pramit.gg',
    siteName: 'pramit.gg',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'pramit.gg - a living journal',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'pramit.gg',
    description: 'a living, evolving journal of interests, projects, and experiences',
    creator: '@mazoomzoom',
    images: ['/og-image.png'],
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
  alternates: {
    canonical: '/',
  },
  verification: {
    google: 'google-site-verification-code', // Add your Google verification code
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Mark that JavaScript is enabled for animation purposes
              document.documentElement.classList.add('js-enabled');
            `,
          }}
        />
        <SecretDashboard />
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  )
} 