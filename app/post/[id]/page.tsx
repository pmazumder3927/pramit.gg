import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabase, generateSlug } from '@/app/lib/supabase'
import PostClient from '@/app/components/PostClient'

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const post = await getPost(params.id)
  
  if (!post) {
    return {
      title: 'Post Not Found',
    }
  }

  return {
    title: post.title,
    description: post.content.substring(0, 160) + '...',
    openGraph: {
      title: `${post.title} | Pramit Mazumder`,
      description: post.content.substring(0, 160) + '...',
      url: `https://pramit.gg/post/${generateSlug(post.title)}`,
      type: 'article',
      publishedTime: post.created_at,
      authors: ['Pramit Mazumder'],
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(post.title)}&subtitle=${encodeURIComponent(post.type)}`,
          width: 1200,
          height: 630,
        }
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${post.title} | Pramit Mazumder`,
      description: post.content.substring(0, 160) + '...',
      images: [`/api/og?title=${encodeURIComponent(post.title)}&subtitle=${encodeURIComponent(post.type)}`],
    },
  }
}

async function getPost(identifier: string) {
  try {
    let foundPost = null
    
    // First, try to find by ID (UUID format)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)
    
    if (isUUID) {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('id', identifier)
        .single()

      if (!error && data) {
        foundPost = data
      }
    } else {
      // Try to find by matching generated slug
      const { data: allPosts, error } = await supabase
        .from('posts')
        .select('*')
        .eq('is_draft', false)

      if (!error && allPosts) {
        const matchingPost = allPosts.find((post: any) => generateSlug(post.title) === identifier)
        
        if (matchingPost) {
          foundPost = matchingPost
        }
      }
    }

    return foundPost
  } catch (error) {
    console.error('Error fetching post:', error)
    return null
  }
}

export default async function PostPage({ params }: PageProps) {
  const post = await getPost(params.id)
  
  if (!post) {
    notFound()
  }

  // Increment view count
  await supabase
    .from('posts')
    .update({ view_count: (post.view_count || 0) + 1 })
    .eq('id', post.id)

  return <PostClient post={post} />
}
