import { getAllPosts } from '@/app/lib/server-utils';
import { generateHomeMetadata, generateHomeStructuredData } from '@/app/lib/seo';
import Navigation from '@/app/components/Navigation';
import NowPlaying from '@/app/components/NowPlaying';
import ClientHomePage from '@/app/components/ClientHomePage';
import { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const posts = await getAllPosts();
  return generateHomeMetadata(posts);
}

export default async function Home() {
  const posts = await getAllPosts();
  
  // Set first 3 posts as featured
  const featuredPosts = posts.slice(0, 3);
  const recentPosts = posts.slice(3);
  
  const structuredData = generateHomeStructuredData(posts);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
      
      <Navigation />
      <NowPlaying />
      
      <ClientHomePage 
        posts={recentPosts} 
        featuredPosts={featuredPosts} 
      />
    </>
  );
}
