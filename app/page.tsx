import { getPosts } from './lib/data';
import { createMetadata } from './lib/metadata';
import { Metadata } from 'next';
import HomeClient from './components/HomeClient';

export async function generateMetadata(): Promise<Metadata> {
  return createMetadata({
    title: 'pramit.gg',
    description: 'A living, evolving journal of interests, projects, and experiences',
    path: '',
  });
}

export default async function Home() {
  const posts = await getPosts();
  
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'pramit.gg',
    description: 'A living, evolving journal of interests, projects, and experiences',
    url: 'https://pramit.gg',
    author: {
      '@type': 'Person',
      name: 'Pramit Mazumder',
      url: 'https://pramit.gg',
    },
    publisher: {
      '@type': 'Organization',
      name: 'pramit.gg',
      url: 'https://pramit.gg',
    },
    blogPost: posts.slice(0, 5).map(post => ({
      '@type': 'BlogPosting',
      headline: post.title,
      url: `https://pramit.gg/post/${post.slug}`,
      datePublished: post.created_at,
      dateModified: post.updated_at,
      author: {
        '@type': 'Person',
        name: 'Pramit Mazumder',
      },
      keywords: post.tags.join(', '),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
      <HomeClient posts={posts} />
    </>
  );
}
