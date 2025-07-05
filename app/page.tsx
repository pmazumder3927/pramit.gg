'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Masonry from 'react-masonry-css'
import { Post, supabase } from '@/app/lib/supabase'
import PostCard from '@/app/components/PostCard'
import Navigation from '@/app/components/Navigation'

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('is_draft', false)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPosts(data || [])
    } catch (error) {
      console.error('Error fetching posts:', error)
    } finally {
      setLoading(false)
    }
  }

  const breakpointColumns = {
    default: 3,
    1100: 2,
    700: 1
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-8 md:py-16 pb-24 md:pb-8">
      <Navigation />
      
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto mb-12"
      >
        <h1 className="text-4xl md:text-6xl font-light mb-4">
          <span className="text-glitch" data-text="pramit mazumder">pramit mazumder</span>
        </h1>
        <p className="text-gray-400 text-lg">
          a living, evolving journal of interests, projects, and experiences
        </p>
      </motion.header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-8 h-8 border-2 border-cyber-orange border-t-transparent rounded-full"
          />
        </div>
      ) : posts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <p className="text-gray-500">no posts yet. check back soon.</p>
        </motion.div>
      ) : (
        <Masonry
          breakpointCols={breakpointColumns}
          className="flex -ml-4 w-auto max-w-7xl mx-auto"
          columnClassName="pl-4 bg-clip-padding"
        >
          {posts.map((post, index) => (
            <div key={post.id} className="mb-4">
              <PostCard post={post} index={index} />
            </div>
          ))}
        </Masonry>
      )}
      
      <footer className="fixed bottom-0 left-0 right-0 md:relative md:mt-16 bg-black/80 backdrop-blur-lg border-t border-gray-900 md:border-0 md:bg-transparent md:backdrop-blur-none">
        <div className="max-w-7xl mx-auto px-4 py-3 md:py-8 flex items-center justify-between">
          <p className="text-xs text-gray-500">© 2024 pramit mazumder</p>
          <div className="flex items-center gap-4">
            <a
              href="/about"
              className="text-xs text-gray-500 hover:text-white transition-colors"
            >
              about
            </a>
            <span className="text-xs text-gray-700">•</span>
            <span className="text-xs text-gray-500">
              now playing: <span className="text-cyber-orange">nothing</span>
            </span>
          </div>
        </div>
      </footer>
    </main>
  )
} 