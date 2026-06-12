"use client";

// The desk — the warm foyer behind the site. Writing happens in the writing
// room (/write); this page is for picking a page back up, tending the shelf,
// and the backstage tooling.

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { formatDistanceToNow } from "date-fns";
import { supabase, Post, analyzeContent } from "@/app/lib/supabase";
import { POST_TYPE_META, TONE_TEXT } from "@/app/lib/postTypes";
import { Doodle, HandNote, Stamp } from "@/app/components/sketchbook";
import { chaosFor } from "@/app/lib/chaos";
import SpotifyConnection from "@/app/components/SpotifyConnection";
import BannerControl from "@/app/dashboard/BannerControl";

const touched = (post: Post) =>
  formatDistanceToNow(new Date(post.updated_at || post.created_at), {
    addSuffix: true,
  });

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const checkUser = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/api/auth/login");
    } else {
      setUser(user);
    }
  }, [router]);

  const fetchPosts = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard/posts", {
        cache: "no-store",
      });
      if (response.status === 401) {
        router.push("/api/auth/login");
        return;
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch posts: ${response.status}`);
      }
      const { posts } = await response.json();
      setPosts(posts || []);
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    checkUser();
    fetchPosts();
  }, [checkUser, fetchPosts]);

  const deletePost = async (post: Post) => {
    if (!confirm("tear this page out? it doesn't come back.")) return;
    try {
      const res = await fetch(`/api/dashboard/posts/${post.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete failed");
      fetchPosts();
    } catch (error) {
      console.error("Error deleting post:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-accent-orange border-t-transparent rounded-full"
        />
        <p className="font-hand text-xl text-ink-soft">
          opening the sketchbook...
        </p>
      </div>
    );
  }

  const drafts = posts.filter((p) => p.is_draft);
  const published = posts.filter((p) => !p.is_draft);

  return (
    <main className="min-h-screen p-4 md:p-8 page-reveal">
      <div className="max-w-6xl mx-auto">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <p className="font-hand text-2xl text-accent-orange -rotate-1 mb-1">
            behind the scenes
          </p>
          <h1 className="font-serif text-3xl md:text-4xl font-medium mb-2 text-ink">
            the desk
          </h1>
          <p className="text-ink-soft">welcome back, {user?.email}</p>
        </motion.header>

        {/* ---------- writing first ---------- */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 flex flex-wrap items-center gap-4"
        >
          <Link href="/write" className="btn-sketch-solid">
            ✎ start a fresh page
          </Link>
          {drafts.length === 0 && (
            <HandNote tone="rust" rotate={-2} className="text-lg">
              no half-written things. suspicious.
            </HandNote>
          )}
        </motion.div>

        {/* still wet — drafts pile */}
        {drafts.length > 0 && (
          <section className="mb-12">
            <div className="mb-4 flex items-baseline gap-3">
              <h2 className="font-serif text-2xl font-medium text-ink">
                still wet
              </h2>
              <span className="font-hand text-lg -rotate-2 text-accent-rust">
                — pick one back up ✎
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {drafts.map((post, i) => {
                const c = chaosFor(post.id);
                const { wordCount } = analyzeContent(post.content || "");
                return (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 + i * 0.03 }}
                  >
                    <Link
                      href={`/write/${post.id}`}
                      className="sketch-card relative block p-4"
                      style={{ transform: `rotate(${c.rotate}deg)` }}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <Stamp tone="rust" rotate={-3}>
                          wet ink
                        </Stamp>
                        <button
                          type="button"
                          title="tear it out"
                          onClick={(e) => {
                            e.preventDefault();
                            void deletePost(post);
                          }}
                          className="font-hand text-base text-ink-faint transition-colors hover:text-accent-rust"
                        >
                          tear out
                        </button>
                      </div>
                      <h3 className="font-serif text-lg font-medium leading-snug text-ink line-clamp-2">
                        {post.title || "untitled, for now"}
                      </h3>
                      <p className="mt-2 font-hand text-base text-ink-faint">
                        {wordCount} words · touched {touched(post)}
                      </p>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* on the shelf — published */}
        <section className="mb-12">
          <div className="mb-4 flex items-baseline gap-3">
            <h2 className="font-serif text-2xl font-medium text-ink">
              on the shelf
            </h2>
            <span className="font-hand text-lg text-ink-faint">
              {published.length} {published.length === 1 ? "entry" : "entries"}
            </span>
          </div>

          {published.length === 0 ? (
            <p className="font-hand text-2xl text-ink-faint">
              nothing here yet — the first page is yours ✎
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {published.map((post, i) => {
                const meta = POST_TYPE_META[post.type] ?? POST_TYPE_META.note;
                const { readingTime } = analyzeContent(post.content || "");
                return (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.03 + i * 0.02 }}
                    className="sketch-card p-4"
                    style={{ rotate: `${i % 2 === 0 ? -0.4 : 0.4}deg` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <h3 className="font-serif font-medium text-ink">
                            {post.title}
                          </h3>
                          {post.is_pinned && (
                            <span className="rounded-full border border-accent-orange/30 bg-accent-orange/15 px-2 py-0.5 text-xs text-accent-orange">
                              📌 pinned
                            </span>
                          )}
                          {!!post.draft && (
                            <span
                              title="this entry has kept changes not yet in print"
                              className="rounded-full border border-accent-orange/30 bg-accent-orange/10 px-2 py-0.5 text-xs text-accent-orange"
                            >
                              kept changes ✎
                            </span>
                          )}
                        </div>
                        <p className="mb-1 text-sm text-ink-soft">
                          <span className={`font-medium ${TONE_TEXT[meta.tone]}`}>
                            {post.type}
                          </span>{" "}
                          · {new Date(post.created_at).toLocaleDateString()} ·{" "}
                          {post.view_count}{" "}
                          {post.view_count === 1 ? "read" : "reads"} · ~
                          {readingTime} min
                        </p>
                        <div className="flex flex-wrap gap-x-4 font-hand text-lg">
                          <Link
                            href={`/post/${post.slug}`}
                            className="text-ink-soft transition-colors hover:text-accent-orange"
                          >
                            read →
                          </Link>
                          <Link
                            href={`/write/${post.id}`}
                            className="text-accent-purple transition-colors hover:text-accent-orange"
                          >
                            edit ✎
                          </Link>
                          <button
                            type="button"
                            onClick={() => void deletePost(post)}
                            className="text-ink-faint transition-colors hover:text-accent-rust"
                          >
                            tear out
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        <div className="mb-10 flex justify-center">
          <Doodle name="divider" tone="rust" className="h-5 w-56" strokeWidth={2.5} />
        </div>

        {/* ---------- the back room ---------- */}
        <div className="mb-4 flex items-baseline gap-3">
          <h2 className="font-serif text-2xl font-medium text-ink">
            the back room
          </h2>
          <span className="font-hand text-lg -rotate-1 text-accent-purple">
            — tools &amp; wires
          </span>
        </div>

        <div className="mb-8">
          <SpotifyConnection
            initialSuccess={searchParams.get("spotify_success") === "true"}
            initialError={searchParams.get("spotify_error") || undefined}
          />
        </div>

        <BannerControl />

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="sketch-card mb-8 p-5"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-hand text-lg tracking-wide text-accent-purple">
                private tooling
              </p>
              <h2 className="mt-1 font-serif text-xl font-medium text-ink">
                its 3 am
              </h2>
              <p className="mt-2 text-sm text-ink-soft">
                late-night music curation — review, sequence, and shape
                playlists.
              </p>
            </div>
            <Link
              href="/music/manage"
              className="inline-flex items-center justify-center rounded-full border-[1.8px] border-accent-purple px-5 py-2.5 text-sm font-medium text-accent-purple transition hover:bg-accent-purple/10"
            >
              its 3 am
            </Link>
          </div>
        </motion.div>
      </div>
    </main>
  );
}

export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 border-2 border-accent-orange border-t-transparent rounded-full"
          />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
