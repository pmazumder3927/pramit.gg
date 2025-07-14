'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export default function AboutClient() {
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
                  href="https://github.com/pramitmazumder"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" />
                  </svg>
                  {content.github}
                </a>
                <a
                  href="https://instagram.com/pramitmazumder"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 2.2c2.65 0 2.97.01 4.02.06 1.95.09 3.01.41 3.72 1.11.7.71 1.02 1.77 1.11 3.72.05 1.05.06 1.37.06 4.02s-.01 2.97-.06 4.02c-.09 1.95-.41 3.01-1.11 3.72-.71.7-1.77 1.02-3.72 1.11-1.05.05-1.37.06-4.02.06s-2.97-.01-4.02-.06c-1.95-.09-3.01-.41-3.72-1.11-.7-.71-1.02-1.77-1.11-3.72-.05-1.05-.06-1.37-.06-4.02s.01-2.97.06-4.02c.09-1.95.41-3.01 1.11-3.72.71-.7 1.77-1.02 3.72-1.11 1.05-.05 1.37-.06 4.02-.06zm0-2.2c-2.7 0-3.03.01-4.08.06-1.52.07-2.55.32-3.46.68-.94.37-1.73.86-2.52 1.65-.79.79-1.28 1.58-1.65 2.52-.36.91-.61 1.94-.68 3.46-.05 1.05-.06 1.38-.06 4.08s.01 3.03.06 4.08c.07 1.52.32 2.55.68 3.46.37.94.86 1.73 1.65 2.52.79.79 1.58 1.28 2.52 1.65.91.36 1.94.61 3.46.68 1.05.05 1.38.06 4.08.06s3.03-.01 4.08-.06c1.52-.07 2.55-.32 3.46-.68.94-.37 1.73-.86 2.52-1.65.79-.79 1.28-1.58 1.65-2.52.36-.91.61-1.94.68-3.46.05-1.05.06-1.38.06-4.08s-.01-3.03-.06-4.08c-.07-1.52-.32-2.55-.68-3.46-.37-.94-.86-1.73-1.65-2.52-.79-.79-1.58-1.28-2.52-1.65-.91-.36-1.94-.61-3.46-.68-1.05-.05-1.38-.06-4.08-.06zm0 5.84c-2.3 0-4.16 1.86-4.16 4.16s1.86 4.16 4.16 4.16 4.16-1.86 4.16-4.16-1.86-4.16-4.16-4.16zm0 6.85c-1.49 0-2.69-1.2-2.69-2.69s1.2-2.69 2.69-2.69 2.69 1.2 2.69 2.69-1.2 2.69-2.69 2.69zm5.28-6.35c0 .54-.44.98-.98.98s-.98-.44-.98-.98.44-.98.98-.98.98.44.98.98z" />
                  </svg>
                  {content.instagram}
                </a>
                <a
                  href="mailto:pramit@pramit.gg"
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
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