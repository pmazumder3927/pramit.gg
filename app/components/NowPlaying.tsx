'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useSWR from 'swr'
import Image from 'next/image'

interface SpotifyTrack {
  isPlaying: boolean
  title: string
  artist: string
  album: string
  albumImageUrl: string | null
  songUrl: string | null
  progress?: number
  duration?: number
  playedAt?: string
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function NowPlaying() {
  const [isExpanded, setIsExpanded] = useState(false)
  const { data: track, error } = useSWR<SpotifyTrack>('/api/spotify/now-playing', fetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds
    revalidateOnFocus: false,
  })

  if (error || !track) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>now playing:</span>
        <span className="text-cyber-orange">nothing</span>
      </div>
    )
  }

  const progressPercentage = track.progress && track.duration 
    ? (track.progress / track.duration) * 100 
    : 0

  return (
    <div className="relative">
      <motion.div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        whileHover={{ scale: 1.02 }}
      >
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <motion.div
            className={`w-2 h-2 rounded-full ${track.isPlaying ? 'bg-green-500' : 'bg-gray-500'}`}
            animate={track.isPlaying ? { opacity: [1, 0.3, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-xs text-gray-500">
            {track.isPlaying ? 'now playing:' : 'last played:'}
          </span>
        </div>

        {/* Track info */}
        <div className="flex items-center gap-2 min-w-0">
          {track.albumImageUrl && (
            <div className="relative w-4 h-4 rounded-sm overflow-hidden flex-shrink-0">
              <Image
                src={track.albumImageUrl}
                alt={track.album}
                fill
                className="object-cover"
                sizes="16px"
              />
            </div>
          )}
          
          <div className="min-w-0 flex-1">
            <motion.div
              className="text-xs text-cyber-orange truncate"
              animate={{ opacity: [1, 0.7, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              {track.title}
            </motion.div>
          </div>
        </div>

        {/* Expand icon */}
        <motion.svg
          className="w-3 h-3 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </motion.div>

      {/* Expanded view */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute bottom-full right-0 mb-2 bg-black/95 backdrop-blur-xl border border-gray-800 rounded-lg p-4 min-w-80 z-50"
          >
            <div className="flex items-start gap-3">
              {/* Album art */}
              {track.albumImageUrl && (
                <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                  <Image
                    src={track.albumImageUrl}
                    alt={track.album}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                  {track.isPlaying && (
                    <div className="absolute inset-0 bg-gradient-to-tr from-cyber-orange/20 to-transparent" />
                  )}
                </div>
              )}
              
              {/* Track details */}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white text-sm truncate mb-1">
                  {track.title}
                </h3>
                <p className="text-xs text-gray-400 truncate mb-1">
                  by {track.artist}
                </p>
                <p className="text-xs text-gray-500 truncate mb-3">
                  {track.album}
                </p>
                
                {/* Progress bar for currently playing */}
                {track.isPlaying && track.progress && track.duration && (
                  <div className="space-y-1">
                    <div className="relative h-1 bg-gray-800 rounded-full overflow-hidden">
                      <motion.div
                        className="absolute left-0 top-0 h-full bg-gradient-to-r from-cyber-orange to-neon-purple rounded-full"
                        initial={{ width: '0%' }}
                        animate={{ width: `${progressPercentage}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{formatTime(track.progress)}</span>
                      <span>{formatTime(track.duration)}</span>
                    </div>
                  </div>
                )}
                
                {/* Spotify link */}
                {track.songUrl && (
                  <motion.a
                    href={track.songUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-green-500 hover:text-green-400 transition-colors mt-2"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                    open in spotify
                  </motion.a>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
} 