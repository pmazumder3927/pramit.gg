import { Metadata } from 'next'
import { supabase } from '@/app/lib/supabase'
import HomeClient from '@/app/components/HomeClient'

export const metadata: Metadata = {
  title: 'Pramit Mazumder - Software Engineer & Creative Technologist',
  description: 'Welcome to Pramit Mazumder\'s digital space. Explore projects, thoughts, and experiences in software engineering, AI, robotics, and creative technology.',
  openGraph: {
    title: 'Pramit Mazumder - Software Engineer & Creative Technologist',
    description: 'Welcome to Pramit Mazumder\'s digital space. Explore projects, thoughts, and experiences.',
    url: 'https://pramit.gg',
  },
}

async function getPosts() {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('is_draft', false)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase error:', error)
      return { featuredPosts: [], posts: [] }
    }

    if (data) {
      return {
        featuredPosts: data.slice(0, 3),
        posts: data.slice(3)
      }
    }
  } catch (error) {
    console.error('Error fetching posts:', error)
  }

  return { featuredPosts: [], posts: [] }
}

export default async function Home() {
  const { featuredPosts, posts } = await getPosts()

  return <HomeClient featuredPosts={featuredPosts} posts={posts} />
} 