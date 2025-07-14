import { Metadata } from 'next';
import { Post } from './supabase';

const siteConfig = {
  name: 'pramit.gg',
  description: 'A living, evolving journal of interests, projects, and experiences',
  url: 'https://pramit.gg',
  ogImage: 'https://pramit.gg/og-image.jpg',
  author: 'Pramit Mazumder',
  twitterUsername: '@pramitmazumder',
};

export function createMetadata({
  title,
  description,
  image,
  path = '',
  type = 'website',
}: {
  title: string;
  description: string;
  image?: string;
  path?: string;
  type?: 'website' | 'article';
}): Metadata {
  const url = `${siteConfig.url}${path}`;
  const ogImage = image || siteConfig.ogImage;

  return {
    title,
    description,
    metadataBase: new URL(siteConfig.url),
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: siteConfig.name,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: 'en_US',
      type,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
      creator: siteConfig.twitterUsername,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

export function createPostMetadata(post: Post): Metadata {
  const title = `${post.title} | ${siteConfig.name}`;
  const description = post.content.slice(0, 160).replace(/[#*\-`]/g, '').trim();
  const path = `/post/${post.slug}`;
  
  // Extract first image from markdown content
  const imageMatch = post.content.match(/!\[.*?\]\((.*?)\)/);
  const image = imageMatch?.[1] || post.media_url || siteConfig.ogImage;

  const baseMetadata = createMetadata({
    title,
    description,
    image,
    path,
    type: 'article',
  });

  return {
    ...baseMetadata,
    keywords: post.tags.join(', '),
    authors: [{ name: siteConfig.author }],
    openGraph: {
      ...baseMetadata.openGraph,
      type: 'article',
      publishedTime: post.created_at,
      modifiedTime: post.updated_at,
    },
  };
}

export function createStructuredData(post: Post) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.content.slice(0, 160).replace(/[#*\-`]/g, '').trim(),
    image: post.media_url || siteConfig.ogImage,
    datePublished: post.created_at,
    dateModified: post.updated_at,
    author: {
      '@type': 'Person',
      name: siteConfig.author,
      url: siteConfig.url,
    },
    publisher: {
      '@type': 'Organization',
      name: siteConfig.name,
      url: siteConfig.url,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteConfig.url}/post/${post.slug}`,
    },
    keywords: post.tags.join(', '),
    articleSection: post.type,
    wordCount: post.content.split(/\s+/).length,
  };
}

export { siteConfig };