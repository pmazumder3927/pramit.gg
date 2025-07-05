'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Post, supabase } from '@/app/lib/supabase'
import PostCard from '@/app/components/PostCard'
import Navigation from '@/app/components/Navigation'
import { useInView } from 'react-intersection-observer'

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [featuredPosts, setFeaturedPosts] = useState<Post[]>([])
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true
  })

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
      
      if (data) {
        // Set first 3 posts as featured for horizontal scroll
        setFeaturedPosts(data.slice(0, 3))
        setPosts(data.slice(3))
      }
    } catch (error) {
      console.error('Error fetching posts:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen pb-24 md:pb-8">
      <Navigation />
      
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 py-8 md:px-8 md:py-16"
      >
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-light mb-4">
            <span className="text-glitch" data-text="pramit mazumder">pramit mazumder</span>
          </h1>
          <p className="text-gray-400 text-lg">
            a living, evolving journal of interests, projects, and experiences
          </p>
        </div>
      </motion.header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-8 h-8 border-2 border-cyber-orange border-t-transparent rounded-full"
          />
        </div>
      ) : (
        <>
          {/* Featured Posts - Horizontal Scroll on Mobile */}
          {featuredPosts.length > 0 && (
            <section className="mb-8 md:mb-12">
              <div className="px-4 md:px-8 mb-4">
                <h2 className="text-sm text-gray-500">featured</h2>
              </div>
              <div className="overflow-x-auto scrollbar-hide">
                <div className="flex gap-4 px-4 md:px-8 pb-4">
                  {featuredPosts.map((post, index) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex-shrink-0 w-80 md:w-96"
                    >
                      <PostCard post={post} index={index} />
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* All Posts - Responsive Grid */}
          {posts.length === 0 && featuredPosts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <p className="text-gray-500">no posts yet. check back soon.</p>
            </motion.div>
          ) : (
            <section className="px-4 md:px-8">
              <div className="max-w-7xl mx-auto">
                {posts.length > 0 && (
                  <div className="mb-4">
                    <h2 className="text-sm text-gray-500">all posts</h2>
                  </div>
                )}
                <div 
                  ref={ref}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
                >
                  <AnimatePresence>
                    {posts.map((post, index) => (
                      <motion.div
                        key={post.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={inView ? { opacity: 1, y: 0 } : {}}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ 
                          delay: index * 0.05,
                          duration: 0.4,
                          ease: [0.25, 0.1, 0.25, 1]
                        }}
                      >
                        <PostCard post={post} index={index + 3} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </section>
          )}
        </>
      )}
      
      <footer className="mt-16 px-4 py-8 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-gray-500">
          <p>© 2024 pramit mazumder</p>
          <div className="flex items-center gap-4">
            <a
              href="/about"
              className="hover:text-white transition-colors"
            >
              about
            </a>
            <span className="text-gray-700">•</span>
            <span>
              now playing: <span className="text-cyber-orange">nothing</span>
            </span>
          </div>
        </div>
      </footer>
    </main>
  )
} 