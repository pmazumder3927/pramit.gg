import { notFound } from 'next/navigation';
import { getPostBySlug, getAllPostSlugs } from '@/app/lib/server-utils';
import { generatePostMetadata, generateStructuredData } from '@/app/lib/seo';
import PostContent from './PostContent';
import ClientViewTracker from '@/app/components/ClientViewTracker';
import { Metadata } from 'next';

interface PostPageProps {
  params: {
    id: string;
  };
}

export async function generateStaticParams() {
  const slugs = await getAllPostSlugs();
  return slugs.map((slug) => ({
    id: slug,
  }));
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const post = await getPostBySlug(params.id);
  
  if (!post) {
    return {
      title: 'Post Not Found | pramit.gg',
    };
  }

  return generatePostMetadata(post);
}

export default async function PostPage({ params }: PostPageProps) {
  const post = await getPostBySlug(params.id);

  if (!post) {
    notFound();
  }

  const structuredData = generateStructuredData(post);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
      
      <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(120,119,198,0.03),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,107,61,0.02),transparent_50%)]" />
        
        <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
          <ClientViewTracker postId={post.id} />
          <PostContent post={post} />
        </div>
      </div>
    </>
  );
}
