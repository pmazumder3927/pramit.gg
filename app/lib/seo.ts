import { Metadata } from "next";
import { Post } from "./supabase";

export function generatePostMetadata(post: Post): Metadata {
  const title = `${post.title} | pramit.gg`;
  const description = post.content.slice(0, 160).replace(/[#*\-]/g, '').trim() + '...';
  const url = `https://pramit.gg/post/${post.slug}`;
  
  // Extract first image from content for Open Graph
  const imageMatch = post.content.match(/!\[.*?\]\((.*?)\)/);
  const ogImage = imageMatch ? imageMatch[1] : 
    post.media_url || 
    'https://pramit.gg/og-default.jpg';

  return {
    title,
    description,
    metadataBase: new URL('https://pramit.gg'),
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: 'pramit.gg',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
      locale: 'en_US',
      type: 'article',
      publishedTime: post.created_at,
      modifiedTime: post.updated_at,
      authors: ['Pramit'],
      tags: post.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    keywords: post.tags.join(', '),
    authors: [{ name: 'Pramit' }],
    creator: 'Pramit',
    publisher: 'pramit.gg',
  };
}

export function generateStructuredData(post: Post) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.content.slice(0, 160).replace(/[#*\-]/g, '').trim(),
    author: {
      '@type': 'Person',
      name: 'Pramit',
      url: 'https://pramit.gg',
    },
    publisher: {
      '@type': 'Organization',
      name: 'pramit.gg',
      url: 'https://pramit.gg',
    },
    datePublished: post.created_at,
    dateModified: post.updated_at,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://pramit.gg/post/${post.slug}`,
    },
    image: post.media_url || 'https://pramit.gg/og-default.jpg',
    keywords: post.tags.join(', '),
    articleSection: post.type,
    wordCount: post.content.split(/\s+/).length,
    url: `https://pramit.gg/post/${post.slug}`,
  };
}

export function generateHomeMetadata(posts: Post[]): Metadata {
  const latestPosts = posts.slice(0, 3);
  const description = 'A living, evolving journal of interests, projects, and experiences. Discover posts about music, climbing, and technology.';
  
  return {
    title: 'pramit.gg - Personal Journal & Blog',
    description,
    metadataBase: new URL('https://pramit.gg'),
    alternates: {
      canonical: 'https://pramit.gg',
    },
    openGraph: {
      title: 'pramit.gg',
      description,
      url: 'https://pramit.gg',
      siteName: 'pramit.gg',
      images: [
        {
          url: 'https://pramit.gg/og-home.jpg',
          width: 1200,
          height: 630,
          alt: 'pramit.gg - Personal Journal & Blog',
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'pramit.gg',
      description,
      images: ['https://pramit.gg/og-home.jpg'],
    },
    keywords: 'personal blog, journal, music, climbing, technology, projects',
    authors: [{ name: 'Pramit' }],
    creator: 'Pramit',
    other: {
      'article:author': 'Pramit',
    },
  };
}

export function generateHomeStructuredData(posts: Post[]) {
  const latestPosts = posts.slice(0, 5);
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'pramit.gg',
    description: 'A living, evolving journal of interests, projects, and experiences',
    url: 'https://pramit.gg',
    author: {
      '@type': 'Person',
      name: 'Pramit',
      url: 'https://pramit.gg',
    },
    publisher: {
      '@type': 'Organization',
      name: 'pramit.gg',
      url: 'https://pramit.gg',
    },
    blogPost: latestPosts.map(post => ({
      '@type': 'BlogPosting',
      headline: post.title,
      url: `https://pramit.gg/post/${post.slug}`,
      datePublished: post.created_at,
      dateModified: post.updated_at,
      author: {
        '@type': 'Person',
        name: 'Pramit',
      },
      keywords: post.tags.join(', '),
    })),
  };
}