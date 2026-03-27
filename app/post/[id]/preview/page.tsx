import { notFound } from "next/navigation";
import { Post } from "@/app/lib/supabase";
import PostContent from "../PostContent";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { createMetadata } from "@/app/lib/metadata";
import { Metadata } from "next";

interface PreviewPageProps {
  params: Promise<{ id: string }>;
}

// Never cache preview pages
export const dynamic = "force-dynamic";

async function fetchDraftPost(slug: string): Promise<Post | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("posts")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) return null;
  return data;
}

export async function generateMetadata({ params }: PreviewPageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await fetchDraftPost(id);

  if (!post) {
    return createMetadata({
      title: "Post Not Found",
      noIndex: true,
    });
  }

  return createMetadata({
    title: `[Preview] ${post.title}`,
    noIndex: true,
  });
}

export default async function PreviewPostPage({ params }: PreviewPageProps) {
  const { id } = await params;
  const post = await fetchDraftPost(id);

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen page-reveal">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(120,119,198,0.03),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,107,61,0.02),transparent_50%)]" />

      {/* Preview banner */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500/90 text-black text-center text-sm py-1 font-medium">
        Draft Preview
      </div>

      <main className="relative z-10 min-h-screen px-5 py-8 sm:px-6 md:px-8 md:py-16 pt-14">
        <article className="max-w-2xl md:max-w-3xl lg:max-w-5xl mx-auto">
          <PostContent post={post} />
        </article>
      </main>
    </div>
  );
}
