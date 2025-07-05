'use client'

import { motion } from 'framer-motion'
import { Post } from '@/app/lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'
import ReactPlayer from 'react-player'

interface PostCardProps {
  post: Post
  index: number
}

export default function PostCard({ post, index }: PostCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const getAccentStyle = () => {
    return {
      borderColor: post.accent_color,
      '--accent-color': post.accent_color,
    } as React.CSSProperties
  }

  const renderMedia = () => {
    if (!post.media_url) return null

    switch (post.type) {
      case 'music':
        return (
          <div className="relative h-32 bg-deep-graphite rounded-lg overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full px-4">
                <ReactPlayer
                  url={post.media_url}
                  width="100%"
                  height="80px"
                  playing={isExpanded}
                  controls={isExpanded}
                  config={{
                    soundcloud: {
                      options: { show_artwork: false }
                    }
                  }}
                />
              </div>
            </div>
            {!isExpanded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{ scale: isHovered ? 1.1 : 1 }}
                  className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm"
                >
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                  </svg>
                </motion.div>
              </div>
            )}
          </div>
        )
      case 'climb':
        return (
          <div className="relative aspect-video bg-deep-graphite rounded-lg overflow-hidden">
            <ReactPlayer
              url={post.media_url}
              width="100%"
              height="100%"
              playing={isHovered}
              muted={!isExpanded}
              loop={!isExpanded}
              controls={isExpanded}
            />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -4 }}
      className={`relative bg-black border border-gray-900 rounded-lg p-6 cursor-pointer card-hover ${
        isExpanded ? 'col-span-full' : ''
      }`}
      style={getAccentStyle()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="space-y-4">
        {renderMedia()}
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </span>
            <span className="text-xs px-2 py-1 rounded-full bg-white/5" style={{ color: post.accent_color }}>
              {post.type}
            </span>
          </div>
          
          <h3 className="text-lg font-medium">{post.title}</h3>
          
          {(isExpanded || post.type === 'note') && (
            <p className="text-gray-400 text-sm leading-relaxed">
              {post.content}
            </p>
          )}
          
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <motion.div
        className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent"
        style={{ color: post.accent_color }}
        initial={{ width: '0%' }}
        animate={{ width: isHovered ? '100%' : '0%' }}
        transition={{ duration: 0.3 }}
      />
    </motion.article>
  )
} 