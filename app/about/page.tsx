import { Metadata } from 'next'
import Link from 'next/link'
import AboutAnimations from './AboutAnimations'

export const metadata: Metadata = {
  title: 'About | pramit.gg',
  description: "Hey, I'm Pramit. This is my digital space — a living journal where I share things that capture my attention",
  openGraph: {
    title: 'About Pramit',
    description: "Hey, I'm Pramit. This is my digital space — a living journal where I share things that capture my attention",
    type: 'profile',
    firstName: 'Pramit',
    lastName: 'Mazumder',
  },
  alternates: {
    canonical: '/about',
  },
}

export default function About() {
  const sections = [
    {
      title: 'current focus',
      items: [
        'building software that makes a difference',
        'climbing (v3-v4 on a good day)',
        'curating playlists that tell stories',
        'exploring the intersection of tech and creativity',
      ],
    },
    {
      title: 'what to expect',
      items: [
        'climbing beta and outdoor adventures',
        'music discoveries and playlist deep-dives',
        'thoughts on tech, design, and building things',
        'random musings that don\'t fit elsewhere',
      ],
    },
    {
      title: 'principles',
      items: [
        'authenticity over perfection',
        'curiosity as a compass',
        'creating > consuming',
        'embracing the journey',
      ],
    },
  ];

  return (
    <>
      <main className="min-h-screen px-4 py-8 md:px-8 md:py-16">
        <div className="max-w-3xl mx-auto">
          <div data-animate="fade-in">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              back
            </Link>

            <h1 className="text-4xl md:text-5xl font-light mb-12">
              <span className="text-glitch" data-text="about">about</span>
            </h1>

            <div className="space-y-12">
              <p 
                className="text-lg text-gray-300 leading-relaxed"
                data-animate="fade-up"
                data-delay="100"
              >
                hey, i'm pramit. this is my digital space — a living journal where i share things that capture my attention
              </p>

              {sections.map((section, sectionIndex) => (
                <div
                  key={section.title}
                  className="space-y-4"
                  data-animate="fade-up"
                  data-delay={`${200 + sectionIndex * 100}`}
                >
                  <h2 className="text-xl font-light text-white">{section.title}</h2>
                  <ul className="space-y-2">
                    {section.items.map((item, itemIndex) => (
                      <li
                        key={itemIndex}
                        className="text-gray-400 flex items-center gap-2"
                        data-animate="slide-right"
                        data-delay={`${300 + sectionIndex * 100 + itemIndex * 50}`}
                      >
                        <span className="text-accent-orange">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <p
                className="text-gray-300 leading-relaxed pt-8 border-t border-gray-800"
                data-animate="fade-up"
                data-delay="600"
              >
                thanks for stopping by. feel free to explore, and don't hesitate to reach out if something resonates.
              </p>

              <div
                className="pt-8 space-y-4"
                data-animate="fade-up"
                data-delay="700"
              >
                <h2 className="text-xl font-light text-white">connect</h2>
                <div className="flex flex-wrap gap-4">
                  <a
                    href="https://github.com/pmazumder3927"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-cyber-orange transition-colors"
                  >
                    github
                  </a>
                  <a
                    href="https://www.instagram.com/mazoomzoom/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-neon-purple transition-colors"
                  >
                    instagram
                  </a>
                  <a
                    href="mailto:me@pramit.gg"
                    className="text-gray-400 hover:text-cyber-orange transition-colors"
                  >
                    email
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <AboutAnimations />
    </>
  )
} 