import { notFound } from "next/navigation";
import { Post } from "@/app/lib/supabase";
import PostContent from "../PostContent";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { createMetadata } from "@/app/lib/metadata";
import { Stamp } from "@/app/components/sketchbook";
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
      {/* Draft banner — sketchbook chrome, theme-aware */}
      <div className="fixed left-0 right-0 top-0 z-50 flex justify-center border-b border-accent-rust/20 bg-accent-rust/10 py-1.5 backdrop-blur-sm">
        <Stamp tone="rust" rotate={0}>
          draft preview
        </Stamp>
      </div>

      <main className="post-reading relative z-10 min-h-screen py-8 pt-16 md:py-16">
        <PostContent key={post.id} post={post} />
      </main>
    </div>
  );
}
