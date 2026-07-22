import { cache } from "react";
import { notFound } from "next/navigation";
import { Post, analyzeContent, stripWorkingCopy } from "@/app/lib/supabase";
import { extractImageUrls, probeImageDims } from "@/app/lib/imageDims";
import PostContent, { type PostNav } from "./PostContent";
import PostMarkdown from "./PostMarkdown";
import { createPublicClient } from "@/utils/supabase/server";
import { createMetadata, siteConfig } from "@/app/lib/metadata";
import { articleSchema, breadcrumbSchema } from "@/app/lib/structured-data";
import JsonLd from "@/app/components/JsonLd";
import { Metadata } from "next";

interface PostPageProps {
  params: Promise<{ id: string }>;
}

// Enable ISR with 5 minute revalidation for posts
export const revalidate = 300;

// Deduplicate fetchPost calls within the same request (metadata + page)
const fetchPost = cache(async (identifier: string): Promise<Post | null> => {
  try {
    const supabase = createPublicClient();

    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("slug", identifier)
      .eq("is_draft", false)
      .single();

    if (error) return null;
    // never let the writing room's working copy reach the public payload
    return stripWorkingCopy(data);
  } catch (error) {
    console.error("Error fetching post:", error);
    return null;
  }
});

// Onward navigation: the adjacent newer entry, the adjacent older entry, and
// the most tag-similar entry. Readers overwhelmingly arrive from topic-specific
// link drops (robotics forums, HN) — analytics showed they scroll to the end of
// the entry and still leave, so the footer's second card offers the most
// kindred entry rather than the merely chronological one.
type Onward = {
  prev: PostNav | null;
  next: PostNav | null;
  kindred: PostNav | null;
};

type OnwardRow = { slug: string; title: string; type: string; tags?: string[] | null };

const fetchOnward = cache(
  async (slug: string, createdAt: string, tags: string[]): Promise<Onward> => {
    try {
      const supabase = createPublicClient();
      const [{ data: newer }, { data: older }, { data: related }] =
        await Promise.all([
          supabase
            .from("posts")
            .select("slug,title,type")
            .eq("is_draft", false)
            .gt("created_at", createdAt)
            .order("created_at", { ascending: true })
            .limit(1),
          supabase
            .from("posts")
            .select("slug,title,type")
            .eq("is_draft", false)
            .lt("created_at", createdAt)
            .order("created_at", { ascending: false })
            .limit(1),
          tags.length
            ? supabase
                .from("posts")
                .select("slug,title,type,tags")
                .eq("is_draft", false)
                .neq("slug", slug)
                .overlaps("tags", tags)
                .order("created_at", { ascending: false })
                .limit(20)
            : Promise.resolve({ data: [] as OnwardRow[] }),
        ]);

      const prev = (newer?.[0] as OnwardRow | undefined) ?? null;
      const next = (older?.[0] as OnwardRow | undefined) ?? null;

      const tagSet = new Set(tags);
      const kindred =
        ((related ?? []) as OnwardRow[])
          .map((p) => ({
            p,
            overlap: (p.tags ?? []).filter((t) => tagSet.has(t)).length,
          }))
          // never duplicate the newer card sitting beside it
          .filter((x) => x.overlap > 0 && x.p.slug !== prev?.slug)
          .sort((a, b) => b.overlap - a.overlap)[0]?.p ?? null;

      const pick = (p: OnwardRow | null) =>
        p ? { slug: p.slug, title: p.title, type: p.type as Post["type"] } : null;
      return { prev: pick(prev), next: pick(next), kindred: pick(kindred) };
    } catch (error) {
      console.error("Error fetching onward posts:", error);
      return { prev: null, next: null, kindred: null };
    }
  },
);

// Pre-render all published posts at build time
export async function generateStaticParams() {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("posts")
    .select("slug")
    .eq("is_draft", false);

  return (data || []).map((post) => ({ id: post.slug }));
}

// Helper function to generate excerpt from content
function generateExcerpt(content: string): string {
  const cleanText = content
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, "")
    .replace(/[#*`_~]/g, "")
    .replace(/\n+/g, " ")
    .trim();

  return cleanText.length > 160
    ? cleanText.substring(0, 160) + "..."
    : cleanText;
}

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await fetchPost(id);

  if (!post) {
    return createMetadata({
      title: "post not found",
      description: "the requested post could not be found",
      noIndex: true,
    });
  }

  return createMetadata({
    title: post.title,
    description: post.description || generateExcerpt(post.content),
    // When no custom image exists, omit it so the generated per-post
    // opengraph-image (app/post/[id]/opengraph-image.tsx) is used.
    image: post.meta_image || post.media_url || undefined,
    path: `/post/${post.slug}`,
    keywords: post.tags?.length
      ? [...siteConfig.keywords, ...post.tags]
      : siteConfig.keywords,
    openGraph: {
      type: "article",
      publishedTime: post.created_at,
      modifiedTime: post.updated_at || post.created_at,
      authors: [siteConfig.author],
      tags: post.tags,
    },
  });
}

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params;
  const post = await fetchPost(id);

  if (!post) {
    notFound();
  }

  const [{ prev, next, kindred }, imageDims] = await Promise.all([
    fetchOnward(post.slug, post.created_at, post.tags ?? []),
    // intrinsic sizes for inline images so the sheet doesn't reflow mid-read
    probeImageDims(extractImageUrls(post.content || "")),
  ]);

  const postUrl = `${siteConfig.url}/post/${post.slug}`;
  const schemaImage =
    post.meta_image || `${postUrl}/opengraph-image`;

  return (
    <div className="min-h-screen page-reveal">
      <JsonLd
        data={[
          articleSchema(post, schemaImage),
          breadcrumbSchema([
            { name: "home", url: siteConfig.url },
            { name: post.title, url: postUrl },
          ]),
        ]}
      />
      <main className="post-reading relative z-10 min-h-screen py-8 sm:py-10 md:py-16">
        {/* the body renders here on the server; the client shell only gets
            the interactive chrome (TOC, progress ink, share, view count) —
            the raw markdown never ships, so content is blanked from the
            serialized post */}
        <PostContent
          key={post.id}
          post={{ ...post, content: "" }}
          body={<PostMarkdown content={post.content} imageDims={imageDims} />}
          readingTime={analyzeContent(post.content || "").readingTime}
          prev={prev}
          next={next}
          kindred={kindred}
        />
      </main>
    </div>
  );
}
