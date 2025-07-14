import Link from 'next/link'
import Navigation from './components/Navigation'

export const metadata = {
  title: '404 - Page Not Found | pramit.gg',
  description: 'The page you are looking for could not be found.',
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(120,119,198,0.03),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,107,61,0.02),transparent_50%)]" />

      <main className="relative z-10 min-h-screen">
        <Navigation />
        
        <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
          <div className="text-center px-6">
            <h1 className="text-8xl md:text-9xl font-extralight text-white/10 mb-4">
              404
            </h1>
            <h2 className="text-2xl md:text-3xl font-light text-white mb-6">
              Page Not Found
            </h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              The page you're looking for doesn't exist or has been moved.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all duration-300 group"
            >
              <svg
                className="w-4 h-4 transition-transform group-hover:-translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}