"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { useNowPlayingContext } from "./NowPlayingContext";
import { AlbumArt, TrackInfo } from "./NowPlayingWidget";

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  // Use shared context instead of separate SWR call
  const { track, albumColor } = useNowPlayingContext();

  // Lock body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* Mobile Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <div className="bg-void-black/95 backdrop-blur-2xl border-t border-white/[0.06]">
          <div className="flex items-center justify-between py-3 px-4">
            {/* Now Playing - left side */}
            {track ? (
              <Link href="/music" className="flex items-center gap-3 flex-1 min-w-0 mr-3">
                <AlbumArt track={track} accentColor={albumColor} size="sm" />
                <TrackInfo track={track} accentColor={albumColor} compact />
              </Link>
            ) : (
              <div className="flex-1" />
            )}

            {/* Nav buttons - right side */}
            <div className="flex items-center gap-1">
              <Link
                href="/"
                className="text-gray-500 hover:text-white transition-colors duration-300 p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </Link>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-gray-500 hover:text-white transition-colors duration-300 p-2"
              >
                <motion.svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  animate={{ rotate: isOpen ? 45 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                </motion.svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Navigation */}
      <div className="hidden md:block fixed top-8 right-8 z-50">
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-void-black/80 backdrop-blur-xl text-gray-500 hover:text-white transition-all duration-300 p-4 rounded-2xl border border-white/[0.06] hover:border-white/[0.12]"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <motion.div
            animate={{ rotate: isOpen ? 45 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </motion.div>
        </motion.button>
      </div>

      {/* Full Screen Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-void-black"
            onClick={() => setIsOpen(false)}
          >
            {/* Subtle noise texture */}
            <div
              className="absolute inset-0 opacity-[0.015] pointer-events-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              }}
            />

            {/* Navigation */}
            <nav
              className="relative flex flex-col items-center justify-center h-full"
              onClick={(e) => e.stopPropagation()}
            >
              {[
                { href: "/", label: "home" },
                { href: "/music", label: "music" },
                { href: "/about", label: "about" },
                { href: "/connect", label: "connect" },
              ].map((item, index) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{
                    delay: 0.05 + index * 0.05,
                    duration: 0.4,
                    ease: [0.25, 0.1, 0.25, 1],
                  }}
                  className="my-4 md:my-6"
                >
                  <Link
                    href={item.href}
                    className="group relative block text-5xl md:text-7xl lg:text-8xl font-extralight text-white/80 hover:text-white transition-colors duration-300"
                    onClick={() => setIsOpen(false)}
                  >
                    {item.label}

                    {/* Underline with album color */}
                    <span
                      className="absolute -bottom-2 left-0 w-0 h-px group-hover:w-full transition-all duration-500 ease-out"
                      style={{ backgroundColor: albumColor }}
                    />
                  </Link>
                </motion.div>
              ))}

              {/* Corner accents with album color */}
              <div className="absolute top-8 left-8 w-8 h-px" style={{ backgroundColor: `${albumColor}30` }} />
              <div className="absolute top-8 left-8 w-px h-8" style={{ backgroundColor: `${albumColor}30` }} />
              <div className="absolute bottom-8 right-8 w-8 h-px" style={{ backgroundColor: `${albumColor}30` }} />
              <div className="absolute bottom-8 right-8 w-px h-8" style={{ backgroundColor: `${albumColor}30` }} />
            </nav>

            {/* Now playing indicator at bottom - higher on mobile to avoid nav bar */}
            {track && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="absolute bottom-24 md:bottom-8 left-1/2 -translate-x-1/2"
              >
                <Link
                  href="/music"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 rounded-full border transition-all duration-300 hover:scale-105"
                  style={{
                    borderColor: `${albumColor}25`,
                    backgroundColor: `${albumColor}08`,
                  }}
                >
                  {track.albumImageUrl && (
                    <div className="w-8 h-8 rounded-full overflow-hidden">
                      <img
                        src={track.albumImageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span
                      className="text-[10px] uppercase tracking-wider"
                      style={{ color: albumColor }}
                    >
                      {track.isPlaying ? "Now Playing" : "Last Played"}
                    </span>
                    <span className="text-sm text-white/70 font-light max-w-[150px] truncate">
                      {track.title}
                    </span>
                  </div>
                  {track.isPlaying && (
                    <div className="flex items-end gap-[2px] h-3 ml-1">
                      {[0, 0.15, 0.3].map((delay, i) => (
                        <motion.div
                          key={i}
                          className="w-[2px] rounded-full"
                          style={{ backgroundColor: albumColor }}
                          animate={{ height: ["4px", "12px", "4px"] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay }}
                        />
                      ))}
                    </div>
                  )}
                </Link>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
