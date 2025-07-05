'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export default function About() {
  return (
    <main className="min-h-screen px-4 py-8 md:px-8 md:py-16">
      <div className="max-w-2xl mx-auto">
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
            back
          </Link>

          <h1 className="text-4xl md:text-5xl font-light mb-8">
            <span className="text-glitch" data-text="about">about</span>
          </h1>

          <div className="space-y-6 text-gray-300 leading-relaxed">
            <p>
              hey, i'm pramit. this is my digital space — a living journal where i share 
              things that capture my attention: music i'm working on, climbs i'm projecting, 
              and ideas i'm exploring.
            </p>

            <p>
              i believe in building things that feel personal and alive. this site is an 
              experiment in that philosophy — minimal but expressive, constantly evolving 
              with new content and features.
            </p>

            <p>
              currently interested in: creative coding, bouldering v6+, electronic music 
              production, and building tools that make life more interesting.
            </p>

            <div className="pt-8 space-y-4">
              <h2 className="text-xl font-light text-white">connect</h2>
              <div className="flex flex-wrap gap-4">
                <a
                  href="https://github.com/yourusername"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-cyber-orange transition-colors"
                >
                  github
                </a>
                <a
                  href="https://twitter.com/yourusername"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-neon-purple transition-colors"
                >
                  twitter
                </a>
                <a
                  href="mailto:hello@pramit.gg"
                  className="text-gray-400 hover:text-cyber-orange transition-colors"
                >
                  email
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  )
} 