import { MetadataRoute } from 'next'
import { createClient } from "@/utils/supabase/server"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()
  
  // Fetch all posts for the sitemap
  const { data: posts } = await supabase
    .from('posts')
    .select('id, updated_at')
    .eq('is_draft', false)
    .order('created_at', { ascending: false })

  const postUrls = posts?.map((post: { id: string; updated_at: string }) => ({
    url: `https://pramit.gg/post/${post.id}`,
    lastModified: new Date(post.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  })) || []

  return [
    {
      url: 'https://pramit.gg',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: 'https://pramit.gg/about',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    ...postUrls,
  ]
}