'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import ContactCard from './components/ContactCard'
import SocialLinks from './components/SocialLinks'
import ConfessionalBooth from './components/ConfessionalBooth'
import Link from 'next/link'

export default function Connect() {
  const [activeSection, setActiveSection] = useState<'contact' | 'social' | 'confessional'>('contact')

  return (
    <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black">
      {/* Ambient background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(120,119,198,0.03),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,107,61,0.02),transparent_50%)]" />
      
      <main className="relative z-10 min-h-screen">
        {/* Header */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          className="pt-12 pb-8 md:pt-20 md:pb-12"
        >
          <div className="max-w-4xl mx-auto px-6 md:px-8">
            <div className="mb-8">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-300"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                back
              </Link>
            </div>
            
            <div className="text-center">
              <motion.h1 
                className="text-4xl md:text-6xl lg:text-7xl font-extralight tracking-tight mb-4"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                  let's connect
                </span>
              </motion.h1>
              <motion.p 
                className="text-lg md:text-xl text-gray-400 font-light max-w-2xl mx-auto leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
              >
                grab my contact info, follow along, or drop an anonymous thought
              </motion.p>
            </div>
          </div>
        </motion.section>

        {/* Navigation Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="max-w-4xl mx-auto px-6 md:px-8 mb-12"
        >
          <div className="flex justify-center">
            <div className="glass-dark backdrop-blur-3xl rounded-2xl p-2 border border-white/10">
              <div className="flex gap-2">
                {[
                  { id: 'contact', label: 'contact', icon: '📱' },
                  { id: 'social', label: 'socials', icon: '🔗' },
                  { id: 'confessional', label: 'whispers', icon: '🤫' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSection(tab.id as any)}
                    className={`relative px-6 py-3 rounded-xl font-light transition-all duration-300 ${
                      activeSection === tab.id
                        ? 'text-white bg-white/10'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="mr-2">{tab.icon}</span>
                    {tab.label}
                    {activeSection === tab.id && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-gradient-to-r from-accent-orange/20 to-accent-purple/20 rounded-xl border border-white/20"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Content Sections */}
        <div className="max-w-4xl mx-auto px-6 md:px-8 pb-24">
          <AnimatePresence mode="wait">
            {activeSection === 'contact' && (
              <motion.div
                key="contact"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -40 }}
                transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <ContactCard />
              </motion.div>
            )}
            
            {activeSection === 'social' && (
              <motion.div
                key="social"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -40 }}
                transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <SocialLinks />
              </motion.div>
            )}
            
            {activeSection === 'confessional' && (
              <motion.div
                key="confessional"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -40 }}
                transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <ConfessionalBooth />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}