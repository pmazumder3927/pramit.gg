'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export default function AboutContent() {
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
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            {content.back}
          </Link>

          <h1 className="text-5xl md:text-6xl font-extralight mb-12">
            <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
              {content.title}
            </span>
          </h1>

          <div className="space-y-8 text-gray-300 font-light leading-relaxed">
            <p className="text-xl">
              {content.intro}
            </p>

            <p>
              {content.philosophy}
            </p>

            <p>
              {content.interests}
            </p>

            <div className="pt-8 border-t border-white/10">
              <h2 className="text-sm text-gray-500 uppercase tracking-wider mb-4">
                {content.connect}
              </h2>
              <div className="flex gap-6">
                <a
                  href="https://github.com/pramit-marattha"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  {content.github}
                </a>
                <a
                  href="https://instagram.com/pramit"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  {content.instagram}
                </a>
                <a
                  href="mailto:hello@pramit.gg"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  {content.email}
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  )
}