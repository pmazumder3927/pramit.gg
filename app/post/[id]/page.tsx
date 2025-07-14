import { Metadata } from "next";
import { getPostBySlug, generatePostMetadata } from "@/app/lib/server-actions";
import PostContent from "./PostContent";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await getPostBySlug(id);
  const metadata = await generatePostMetadata(post);

  return {
    title: `${metadata.title} | pramit.gg`,
    description: metadata.description,
    openGraph: {
      title: metadata.title,
      description: metadata.description,
      type: "article",
      publishedTime: metadata.publishedTime,
      modifiedTime: metadata.modifiedTime,
      authors: ["Pramit"],
      tags: metadata.tags,
      images: metadata.ogImage ? [
        {
          url: metadata.ogImage,
          width: 1200,
          height: 630,
          alt: metadata.title,
        }
      ] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: metadata.title,
      description: metadata.description,
      images: metadata.ogImage ? [metadata.ogImage] : undefined,
    },
    alternates: {
      canonical: `/post/${id}`,
    },
  };
}

export default async function PostPage({ params }: PageProps) {
  const { id } = await params;
  const post = await getPostBySlug(id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(120,119,198,0.03),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,107,61,0.02),transparent_50%)]" />

      <main className="relative z-10 min-h-screen px-4 py-8 md:px-8 md:py-16">
        <article className="max-w-4xl mx-auto">
          <PostContent post={post} />
          
          {/* JSON-LD structured data for better SEO */}
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
                  url: "https://pramit.gg/about"
                },
                publisher: {
                  "@type": "Person",
                  name: "Pramit",
                  url: "https://pramit.gg"
                },
                description: post.content.substring(0, 160),
                keywords: post.tags.join(", "),
                mainEntityOfPage: {
                  "@type": "WebPage",
                  "@id": `https://pramit.gg/post/${id}`
                }
              }),
            }}
          />
        </article>
      </main>
    </div>
  );
}
