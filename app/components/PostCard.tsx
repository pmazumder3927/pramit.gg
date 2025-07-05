'use client'

import { motion } from 'framer-motion'
import { Post } from '@/app/lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'
import ReactPlayer from 'react-player'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface PostCardProps {
  post: Post
  index: number
}

export default function PostCard({ post, index }: PostCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const router = useRouter()

  const getAccentStyle = () => {
    return {
      '--accent-color': post.accent_color,
    } as React.CSSProperties
  }

  // Get content preview (first 150 characters)
  const getPreview = () => {
    if (!post.content) return ''
    const plainText = post.content.replace(/[#*`\[\]()]/g, '').trim()
    return plainText.length > 150 ? plainText.substring(0, 150) + '...' : plainText
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    router.push(`/post/${post.id}`)
  }

  const renderMedia = () => {
    if (!post.media_url) return null

    switch (post.type) {
      case 'music':
        return (
          <div className="relative h-24 bg-gradient-to-br from-deep-graphite to-black rounded-lg overflow-hidden mb-4">
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={{ scale: isHovered ? 1.1 : 1 }}
                className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm"
              >
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                </svg>
              </motion.div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </div>
        )
      case 'climb':
        return (
          <div className="relative aspect-video bg-deep-graphite rounded-lg overflow-hidden mb-4 group">
            <div className="absolute inset-0">
              <ReactPlayer
                url={post.media_url}
                width="100%"
                height="100%"
                playing={isHovered}
                muted={true}
                loop={true}
                playsinline={true}
                config={{
                  youtube: {
                    playerVars: {
                      modestbranding: 1,
                      controls: 0,
                      showinfo: 0,
                      rel: 0
                    }
                  }
                }}
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            </div>
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
      transition={{ 
        delay: index * 0.05,
        duration: 0.5,
        ease: [0.25, 0.1, 0.25, 1]
      }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className="group cursor-pointer"
      style={getAccentStyle()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      <div className="relative bg-black/50 backdrop-blur-sm border border-gray-900/50 rounded-2xl p-5 md:p-6 overflow-hidden transition-all duration-300 hover:border-gray-800 hover:bg-black/70">
        {/* Accent gradient on hover */}
        <motion.div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${post.accent_color}15 0%, transparent 70%)`,
          }}
        />
        
        <div className="relative z-10">
          {renderMedia()}
          
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </span>
              <span 
                className="px-2 py-1 rounded-full bg-white/5 transition-colors duration-300 group-hover:bg-white/10"
                style={{ color: post.accent_color }}
              >
                {post.type}
              </span>
            </div>
            
            <h3 className="text-lg md:text-xl font-light leading-tight group-hover:text-white transition-colors">
              {post.title}
            </h3>
            
            {post.content && (
              <p className="text-gray-400 text-sm leading-relaxed line-clamp-3">
                {getPreview()}
              </p>
            )}
            
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {post.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-500"
                  >
                    #{tag}
                  </span>
                ))}
                {post.tags.length > 3 && (
                  <span className="text-xs text-gray-500">+{post.tags.length - 3}</span>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Bottom accent line */}
        <motion.div
          className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent"
          style={{ color: post.accent_color }}
          initial={{ width: '0%' }}
          animate={{ width: isHovered ? '100%' : '0%' }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </motion.article>
  )
} 