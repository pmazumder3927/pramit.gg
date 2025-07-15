import { Metadata } from "next";
import { getPost } from "@/app/lib/server-data";
import { generatePreviewText, extractImages } from "@/app/lib/supabase";
import PostContent from "./PostContent";

interface PostPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  
  // Extract first image or use a default
  const images = extractImages(post.content);
  const ogImage = post.media_url || (images.length > 0 ? images[0] : null);
  
  // Generate description from content
  const description = generatePreviewText(post.content).substring(0, 160);
  
  // Use dynamic OG image or fallback to media_url/extracted image
  const dynamicOgImage = `/api/og?title=${encodeURIComponent(post.title)}&description=${encodeURIComponent(description || '')}&type=${post.type}`;
  const finalOgImage = ogImage || dynamicOgImage;
  
  return {
    title: `${post.title} | pramit.gg`,
    description: description || `Read "${post.title}" on pramit.gg`,
    openGraph: {
      title: post.title,
      description: description || `Read "${post.title}" on pramit.gg`,
      type: "article",
      publishedTime: post.created_at,
      modifiedTime: post.updated_at,
      authors: ["Pramit"],
      tags: post.tags,
      images: [
        {
          url: finalOgImage,
          width: 1200,
          height: 630,
          alt: post.title,
        }
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: description || `Read "${post.title}" on pramit.gg`,
      images: [finalOgImage],
    },
    alternates: {
      canonical: `/post/${post.slug}`,
    },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params;
  const post = await getPost(id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(120,119,198,0.03),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,107,61,0.02),transparent_50%)]" />

      <main className="relative z-10 min-h-screen px-4 py-8 md:px-8 md:py-16">
        <article className="max-w-4xl mx-auto">
          {/* Add structured data for SEO */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BlogPosting",
                headline: post.title,
                datePublished: post.created_at,
                dateModified: post.updated_at,
                author: {
                  "@type": "Person",
                  name: "Pramit",
                },
                description: generatePreviewText(post.content).substring(0, 160),
                mainEntityOfPage: {
                  "@type": "WebPage",
                  "@id": `https://pramit.gg/post/${post.slug}`,
                },
              }),
            }}
          />
          <PostContent post={post} />
        </article>
      </main>
    </div>
  );
}
