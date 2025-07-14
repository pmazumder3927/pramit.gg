import { MetadataRoute } from 'next';
import { getPosts } from './lib/data';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPosts();
  
  // Static routes
  const routes = [
    {
      url: 'https://pramit.gg',
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1,
    },
    {
      url: 'https://pramit.gg/about',
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: 'https://pramit.gg/music',
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
  ];

  // Dynamic post routes
  const postRoutes = posts.map((post) => ({
    url: `https://pramit.gg/post/${post.slug}`,
    lastModified: new Date(post.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }));

  return [...routes, ...postRoutes];
}