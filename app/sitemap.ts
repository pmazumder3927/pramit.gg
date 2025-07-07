import { MetadataRoute } from 'next'
import { supabase } from '@/app/lib/supabase'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://pramit.gg'
  
  // Fetch all published posts
  const { data: posts } = await supabase
    .from('posts')
    .select('slug, updated_at')
    .eq('is_draft', false)
    .order('created_at', { ascending: false })

  const postUrls = posts?.map((post: any) => ({
    url: `${baseUrl}/post/${post.slug}`,
    lastModified: new Date(post.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  })) || []

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    ...postUrls,
  ]
}