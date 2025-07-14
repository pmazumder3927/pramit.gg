import { notFound } from 'next/navigation';
import { getPost, getPostSlugs } from '@/app/lib/data';
import { createPostMetadata, createStructuredData } from '@/app/lib/metadata';
import { Metadata } from 'next';
import PostClient from './PostClient';

interface PostPageProps {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  const slugs = await getPostSlugs();
  return slugs.map((slug) => ({ id: slug }));
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  
  if (!post) {
    return {
      title: 'Post Not Found | pramit.gg',
    };
  }

  return createPostMetadata(post);
}

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params;
  const post = await getPost(id);

  if (!post) {
    notFound();
  }

  const structuredData = createStructuredData(post);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
      <PostClient post={post} />
    </>
  );
}
