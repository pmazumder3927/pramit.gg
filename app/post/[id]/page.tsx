'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import { Post, supabase } from '@/app/lib/supabase'
import ReactPlayer from 'react-player'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github-dark.css'

export default function PostPage() {
  const params = useParams()
  const router = useRouter()
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.id) {
      fetchPost(params.id as string)
    }
  }, [params.id])

  const fetchPost = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      setPost(data)
      
      // Increment view count
      await supabase
        .from('posts')
        .update({ view_count: (data.view_count || 0) + 1 })
        .eq('id', id)
    } catch (error) {
      console.error('Error fetching post:', error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-cyber-orange border-t-transparent rounded-full"
        />
      </div>
    )
  }

  if (!post) return null

  return (
    <main className="min-h-screen px-4 py-8 md:px-8 md:py-16">
      <article className="max-w-4xl mx-auto">
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
            back
          </Link>

          {/* Post Header */}
          <header className="mb-12">
            <div className="flex items-center gap-4 mb-4">
              <span 
                className="text-sm px-3 py-1 rounded-full bg-white/10"
                style={{ color: post.accent_color }}
              >
                {post.type}
              </span>
              <span className="text-sm text-gray-500">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </span>
              <span className="text-sm text-gray-500">
                {post.view_count} views
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-light mb-6">{post.title}</h1>
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-sm px-3 py-1 rounded-full bg-white/5 text-gray-400"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </header>

          {/* Media */}
          {post.media_url && (
            <div className="mb-12">
              {post.type === 'music' ? (
                <div className="bg-deep-graphite rounded-lg p-8">
                  <ReactPlayer
                    url={post.media_url}
                    width="100%"
                    height="160px"
                    controls
                    config={{
                      soundcloud: {
                        options: { 
                          show_artwork: true,
                          show_playcount: true,
                          show_user: true
                        }
                      }
                    }}
                  />
                </div>
              ) : post.type === 'climb' ? (
                <div className="relative aspect-video bg-deep-graphite rounded-lg overflow-hidden">
                  <ReactPlayer
                    url={post.media_url}
                    width="100%"
                    height="100%"
                    controls
                    playing={false}
                  />
                </div>
              ) : null}
            </div>
          )}

          {/* Content */}
          <div className="prose prose-invert prose-lg max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex, rehypeHighlight]}
              components={{
                h1: ({ children }) => <h1 className="text-3xl font-light mt-8 mb-4">{children}</h1>,
                h2: ({ children }) => <h2 className="text-2xl font-light mt-6 mb-3">{children}</h2>,
                h3: ({ children }) => <h3 className="text-xl font-light mt-4 mb-2">{children}</h3>,
                p: ({ children }) => <p className="text-gray-300 leading-relaxed mb-4">{children}</p>,
                a: ({ href, children }) => (
                  <a href={href} className="text-cyber-orange hover:underline" target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
                code: (props: any) => 
                  props.inline ? (
                    <code className="px-1 py-0.5 bg-white/10 rounded text-sm">{props.children}</code>
                  ) : (
                    <code>{props.children}</code>
                  ),
                pre: ({ children }) => (
                  <pre className="bg-deep-graphite rounded-lg p-4 overflow-x-auto my-4">{children}</pre>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-cyber-orange pl-4 my-4 italic text-gray-400">
                    {children}
                  </blockquote>
                ),
                ul: ({ children }) => <ul className="list-disc list-inside space-y-2 my-4">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside space-y-2 my-4">{children}</ol>,
                li: ({ children }) => <li className="text-gray-300">{children}</li>,
              }}
            >
              {post.content}
            </ReactMarkdown>
          </div>
        </motion.div>
      </article>
    </main>
  )
} 