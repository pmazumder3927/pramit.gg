import { Metadata } from 'next'
import { createClient } from "@/utils/supabase/server"
import { Post } from '@/app/lib/supabase'
import HomeContent from '@/app/components/HomeContent'

export const metadata: Metadata = {
  title: 'Pramit Mazumder - pramit.gg',
  description: 'Pramit Mazumder\'s personal website - a living, evolving journal of interests in reinforcement learning, robotics, bouldering, and electronic music production',
  openGraph: {
    title: 'Pramit Mazumder - pramit.gg', 
    description: 'Pramit Mazumder\'s personal website - exploring reinforcement learning, robotics, and creative pursuits',
  },
}

async function getPosts() {
  const supabase = await createClient()
  
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .eq('is_draft', false)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching posts:', error)
    return { featuredPosts: [], posts: [] }
  }

  const featuredPosts = posts?.slice(0, 3) || []
  const remainingPosts = posts?.slice(3) || []

  return { featuredPosts, posts: remainingPosts }
}

export default async function Home() {
  const { featuredPosts, posts } = await getPosts()

  return <HomeContent featuredPosts={featuredPosts} posts={posts} />
} 