'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Mobile Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <div className="glass-dark backdrop-blur-3xl border-t border-white/10 shadow-2xl">
          <div className="flex items-center justify-around py-4 px-6">
            <Link href="/" className="text-gray-400 hover:text-white transition-all duration-300 hover:scale-110">
              <div className="p-2 rounded-xl hover:bg-white/10 transition-all duration-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
            </Link>
            <Link href="/music" className="text-gray-400 hover:text-white transition-all duration-300 hover:scale-110">
              <div className="p-2 rounded-xl hover:bg-white/10 transition-all duration-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
            </Link>
            <Link href="/about" className="text-gray-400 hover:text-white transition-all duration-300 hover:scale-110">
              <div className="p-2 rounded-xl hover:bg-white/10 transition-all duration-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </Link>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-400 hover:text-white transition-all duration-300 hover:scale-110"
            >
              <div className="p-2 rounded-xl hover:bg-white/10 transition-all duration-300">
                <motion.svg 
                  className="w-6 h-6" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  animate={{ rotate: isOpen ? 45 : 0 }}
                  transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                </motion.svg>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Navigation */}
      <div className="hidden md:block fixed top-8 right-8 z-50">
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          className="glass-dark backdrop-blur-3xl text-gray-400 hover:text-white transition-all duration-300 p-4 rounded-2xl border border-white/10 hover:border-white/20 hover:shadow-glow-subtle hover:scale-105"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <motion.div
            animate={{ rotate: isOpen ? 45 : 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </motion.div>
        </motion.button>
      </div>

      {/* Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed inset-0 z-40 bg-void-black/95 backdrop-blur-3xl"
            onClick={() => setIsOpen(false)}
          >
            {/* Ambient gradient effects */}
            <div className="absolute inset-0">
              <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-accent-orange/5 rounded-full blur-3xl" />
              <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent-purple/5 rounded-full blur-3xl" />
            </div>

            <motion.nav
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              transition={{ delay: 0.1, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
              className="relative flex flex-col items-center justify-center h-full space-y-12"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <Link
                  href="/"
                  className="block text-5xl md:text-7xl font-extralight hover:text-accent-orange transition-all duration-500 hover:scale-105 text-center"
                  onClick={() => setIsOpen(false)}
                >
                  <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent hover:from-accent-orange hover:via-accent-orange hover:to-accent-orange transition-all duration-500">
                    Home
                  </span>
                </Link>
              </motion.div>

              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <Link
                  href="/music"
                  className="block text-5xl md:text-7xl font-extralight hover:text-accent-purple transition-all duration-500 hover:scale-105 text-center"
                  onClick={() => setIsOpen(false)}
                >
                  <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent hover:from-accent-purple hover:via-accent-purple hover:to-accent-purple transition-all duration-500">
                    Music
                  </span>
                </Link>
              </motion.div>

              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <Link
                  href="/about"
                  className="block text-5xl md:text-7xl font-extralight hover:text-accent-orange transition-all duration-500 hover:scale-105 text-center"
                  onClick={() => setIsOpen(false)}
                >
                  <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent hover:from-accent-orange hover:via-accent-orange hover:to-accent-orange transition-all duration-500">
                    About
                  </span>
                </Link>
              </motion.div>

              {/* Subtle grid pattern */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="absolute inset-0 opacity-[0.015] pointer-events-none"
                style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
                  backgroundSize: '50px 50px'
                }}
              />
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
} 