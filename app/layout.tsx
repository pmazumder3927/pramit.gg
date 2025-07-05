import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

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
  },
  twitter: {
    card: 'summary_large_image',
    title: 'pramit.gg',
    description: 'a living, evolving journal of interests, projects, and experiences',
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
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  )
} 