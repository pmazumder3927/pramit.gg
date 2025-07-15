import { Metadata } from 'next'
import Link from 'next/link'
import ClientEnhancements from '@/app/components/ClientEnhancements'

export const metadata: Metadata = {
  title: 'About | pramit.gg',
  description: 'Learn more about Pramit Mazumder - interests in reinforcement learning, robotics, bouldering, and electronic music production.',
  openGraph: {
    title: 'About Pramit Mazumder',
    description: 'Learn more about Pramit Mazumder - interests in reinforcement learning, robotics, bouldering, and electronic music production.',
    type: 'profile',
  },
  alternates: {
    canonical: '/about',
  },
}

export default function AboutPage() {
  const content = {
    back: 'back',
    title: 'about',
    intro: "hey, i'm pramit. this is my digital space — a living journal where i share things that capture my attention",
    philosophy: "i believe in building things that feels personal and alive. this site is an experiment in that philosophy",
    interests: "currently interested in: reinforcement learning, robotics, bouldering, electronic music production, and spending way too much time optimizing my life",
    connect: 'connect',
    github: 'github',
    instagram: 'instagram',
    email: 'email'
  }

  return (
    <>
      <main className="min-h-screen px-4 py-8 md:px-8 md:py-16">
        <div className="max-w-2xl mx-auto about-content">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {content.back}
            </Link>

            <h1 className="text-4xl md:text-5xl font-light mb-8">
              <span className="text-glitch" data-text={content.title}>{content.title}</span>
            </h1>

            <div className="space-y-6 text-gray-300 leading-relaxed">
              <p>{content.intro}</p>

              <p>{content.philosophy}</p>

              <p>{content.interests}</p>

              <div className="pt-8 space-y-4">
                <h2 className="text-xl font-light text-white">{content.connect}</h2>
                <div className="flex flex-wrap gap-4">
                  <a
                    href="https://github.com/pmazumder3927"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-cyber-orange transition-colors"
                  >
                    {content.github}
                  </a>
                  <a
                    href="https://www.instagram.com/mazoomzoom/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-neon-purple transition-colors"
                  >
                    {content.instagram}
                  </a>
                  <a
                    href="mailto:me@pramit.gg"
                    className="text-gray-400 hover:text-cyber-orange transition-colors"
                  >
                    {content.email}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Progressive Enhancement */}
      <ClientEnhancements />
      
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            name: "Pramit Mazumder",
            url: "https://pramit.gg",
            email: "me@pramit.gg",
            sameAs: [
              "https://github.com/pramit",
              "https://www.instagram.com/mazoomzoom/"
            ],
            jobTitle: "Developer",
            description: "Interested in reinforcement learning, robotics, bouldering, and electronic music production",
          }),
        }}
      />
    </>
  )
} 