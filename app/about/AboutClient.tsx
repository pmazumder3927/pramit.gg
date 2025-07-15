'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

interface AboutContent {
  back: string
  title: string
  intro: string
  sections: Array<{
    title: string
    items: string[]
  }>
  footer: string
}

export default function AboutClient({ content }: { content: AboutContent }) {
  return (
    <main className="min-h-screen px-4 py-8 md:px-8 md:py-16">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {content.back}
          </Link>

          <h1 className="text-4xl md:text-5xl font-light mb-12">
            <span className="text-glitch" data-text={content.title}>{content.title}</span>
          </h1>

          <div className="space-y-12">
            <motion.p 
              className="text-lg text-gray-300 leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {content.intro}
            </motion.p>

            {content.sections.map((section, sectionIndex) => (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + sectionIndex * 0.1 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-light text-white">{section.title}</h2>
                <ul className="space-y-2">
                  {section.items.map((item, itemIndex) => (
                    <motion.li
                      key={itemIndex}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ 
                        duration: 0.3, 
                        delay: 0.3 + sectionIndex * 0.1 + itemIndex * 0.05 
                      }}
                      className="text-gray-400 flex items-center gap-2"
                    >
                      <span className="text-accent-orange">•</span>
                      {item}
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            ))}

            <motion.p
              className="text-gray-300 leading-relaxed pt-8 border-t border-gray-800"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              {content.footer}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="pt-8 space-y-4"
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
            </motion.div>
          </div>
        </motion.div>
      </div>
    </main>
  )
}