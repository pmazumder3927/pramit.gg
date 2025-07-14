import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import SecretDashboard from './components/SecretDashboard'
import { createMetadata } from './lib/metadata'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = createMetadata({
  title: 'pramit.gg',
  description: 'A living, evolving journal of interests, projects, and experiences',
  path: '',
})

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