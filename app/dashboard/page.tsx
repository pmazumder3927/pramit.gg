"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { supabase, Post } from "@/app/lib/supabase";
import {
  POST_TYPES,
  POST_TYPE_META,
  PostType,
  TONE_BUTTON_STYLES,
  TONE_TEXT,
} from "@/app/lib/postTypes";
import { useRouter, useSearchParams } from "next/navigation";
import EnhancedMarkdownEditor from "@/app/components/EnhancedMarkdownEditor";
import SpotifyConnection from "@/app/components/SpotifyConnection";
import BannerControl from "@/app/dashboard/BannerControl";

const ACCENT_COLORS = ["#ff6b3d", "#9c5aff", "#1a1b22"];

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [isMarkdownMode, setIsMarkdownMode] = useState(true);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    type: "note" as PostType,
    media_url: "",
    tags: "",
    is_draft: false,
    is_pinned: false,
    display_size: "" as "" | "massive" | "hero" | "large" | "medium" | "small" | "tiny" | "micro",
    description: "",
    meta_image: "",
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const randomColor =
      ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)];
    const tags = formData.tags
      .split(",")
      .map((tag: string) => tag.trim())
      .filter(Boolean);

    // Generate slug from title
    const slug = formData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    try {
      if (editingPost) {
        // Update existing post
        const { error } = await supabase
          .from("posts")
          .update({
            title: formData.title,
            content: formData.content,
            type: formData.type,
            media_url: formData.media_url,
            tags,
            is_draft: formData.is_draft,
            is_pinned: formData.is_pinned,
            slug,
            display_size: formData.display_size || null,
            description: formData.description || null,
            meta_image: formData.meta_image || null,
          })
          .eq("id", editingPost.id);

        if (error) throw error;
      } else {
        // Create new post
        const { error } = await supabase.from("posts").insert([
          {
            title: formData.title,
            content: formData.content,
            type: formData.type,
            media_url: formData.media_url,
            tags,
            is_draft: formData.is_draft,
            is_pinned: formData.is_pinned,
            accent_color: randomColor,
            view_count: 0,
            slug,
            display_size: formData.display_size || null,
            description: formData.description || null,
            meta_image: formData.meta_image || null,
          },
        ]);

        if (error) throw error;
      }

      // Reset form
      setFormData({
        title: "",
        content: "",
        type: "note",
        media_url: "",
        tags: "",
        is_draft: false,
        is_pinned: false,
        display_size: "",
        description: "",
        meta_image: "",
      });
      setShowCreateForm(false);
      setEditingPost(null);
      setIsMarkdownMode(false);
      fetchPosts();
    } catch (error) {
      console.error("Error saving post:", error);
    }
  };

  const startEditing = (post: Post) => {
    setEditingPost(post);
    setFormData({
      title: post.title,
      content: post.content || "",
      type: post.type,
      media_url: post.media_url || "",
      tags: Array.isArray(post.tags) ? post.tags.join(", ") : "",
      is_draft: post.is_draft || false,
      is_pinned: post.is_pinned || false,
      display_size: post.display_size || "",
      description: post.description || "",
      meta_image: post.meta_image || "",
    });
    setShowCreateForm(true);
    setIsMarkdownMode(true);
  };

  const cancelEditing = () => {
    setEditingPost(null);
    setShowCreateForm(false);
    setFormData({
      title: "",
      content: "",
      type: "note",
      media_url: "",
      tags: "",
      is_draft: false,
      is_pinned: false,
      display_size: "",
      description: "",
      meta_image: "",
    });
  };

  const deletePost = async (id: string) => {
    if (!confirm("are you sure you want to delete this post?")) return;

    try {
      const { error } = await supabase.from("posts").delete().eq("id", id);

      if (error) throw error;
      fetchPosts();
    } catch (error) {
      console.error("Error deleting post:", error);
    }
  };

  // Media no longer drives the post type — the player auto-detects audio vs
  // video from the URL, so a build/study can embed a video freely.
  const detectMediaType = (url: string) => {
    setFormData({ ...formData, media_url: url });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-accent-orange border-t-transparent rounded-full"
        />
        <p className="font-hand text-xl text-ink-soft">opening the sketchbook...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-8 page-reveal">
      <div className="max-w-6xl mx-auto">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <p className="font-hand text-2xl text-accent-orange -rotate-1 mb-1">
            behind the scenes
          </p>
          <h1 className="font-serif text-3xl md:text-4xl font-medium mb-2 text-ink">
            dashboard
          </h1>
          <p className="text-ink-soft">welcome back, {user?.email}</p>
        </motion.header>

        {/* Spotify Connection */}
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
                late-night music curation — review, sequence, and shape playlists.
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

        {/* Quick Create Button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => {
            if (showCreateForm && !editingPost) {
              setShowCreateForm(false);
            } else if (editingPost) {
              cancelEditing();
            } else {
              setShowCreateForm(true);
            }
          }}
          className="btn-sketch-solid mb-8 w-full md:w-auto justify-center"
        >
          {showCreateForm
            ? editingPost
              ? "cancel editing"
              : "cancel"
            : "+ create new post"}
        </motion.button>

        {/* Create/Edit Form */}
        {showCreateForm && (
          <motion.form
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="sketch-card p-6 mb-8"
          >
            <div className="mb-5">
              <h2 className="font-serif text-xl font-medium text-ink">
                {editingPost ? "edit post" : "create new post"}
              </h2>
              {editingPost && (
                <p className="font-hand text-base text-accent-orange mt-1">
                  editing: {editingPost.title}
                </p>
              )}
            </div>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="paste a youtube/soundcloud link..."
                value={formData.media_url}
                onChange={(e) => detectMediaType(e.target.value)}
                className="w-full px-4 py-2 bg-paper-2 text-ink placeholder:text-ink-faint border border-line rounded-lg focus:border-accent-orange focus:outline-none focus:ring-1 focus:ring-accent-orange/40 transition-colors"
              />

              <input
                type="text"
                placeholder="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
                className="w-full px-4 py-2 bg-paper-2 text-ink placeholder:text-ink-faint border border-line rounded-lg focus:border-accent-orange focus:outline-none focus:ring-1 focus:ring-accent-orange/40 transition-colors"
              />

              {/* Toggle between simple textarea and markdown editor */}
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => setIsMarkdownMode(!isMarkdownMode)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    isMarkdownMode
                      ? "bg-accent-orange text-pure-white"
                      : "bg-ink/5 text-ink-soft hover:bg-ink/10 border border-line"
                  }`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  {isMarkdownMode ? "Enhanced Editor" : "Simple Editor"}
                </button>
                {isMarkdownMode && (
                  <span className="text-xs text-ink-faint">
                    ✨ drag & drop images, markdown shortcuts, and more
                  </span>
                )}
              </div>

              {isMarkdownMode ? (
                <EnhancedMarkdownEditor
                  value={formData.content}
                  onChange={(value) =>
                    setFormData({ ...formData, content: value })
                  }
                  placeholder="write your content in markdown..."
                  height={400}
                />
              ) : (
                <textarea
                  placeholder="thoughts..."
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  rows={6}
                  className="w-full px-4 py-2 bg-paper-2 text-ink placeholder:text-ink-faint border border-line rounded-lg focus:border-accent-orange focus:outline-none focus:ring-1 focus:ring-accent-orange/40 transition-colors resize-none"
                />
              )}

              <input
                type="text"
                placeholder="tags (comma separated)"
                value={formData.tags}
                onChange={(e) =>
                  setFormData({ ...formData, tags: e.target.value })
                }
                className="w-full px-4 py-2 bg-paper-2 text-ink placeholder:text-ink-faint border border-line rounded-lg focus:border-accent-orange focus:outline-none focus:ring-1 focus:ring-accent-orange/40 transition-colors"
              />

              {/* Display Settings */}
              <div className="border border-dashed border-line rounded-lg p-4 space-y-4 bg-paper/40">
                <h3 className="font-hand text-lg text-accent-rust">display settings</h3>

                <div>
                  <label className="block text-xs text-ink-soft mb-1">card size (leave empty for random)</label>
                  <select
                    value={formData.display_size}
                    onChange={(e) =>
                      setFormData({ ...formData, display_size: e.target.value as any })
                    }
                    className="w-full px-4 py-2 bg-paper-2 text-ink placeholder:text-ink-faint border border-line rounded-lg focus:border-accent-orange focus:outline-none focus:ring-1 focus:ring-accent-orange/40 transition-colors"
                  >
                    <option value="">Random (default)</option>
                    <option value="massive">Massive (2x2 → 3x3)</option>
                    <option value="hero">Hero (1x2 → 2x2)</option>
                    <option value="large">Large (1x2 → 2x2)</option>
                    <option value="medium">Medium (1x1 → 1x2)</option>
                    <option value="small">Small (1x1)</option>
                    <option value="tiny">Tiny (1x1)</option>
                    <option value="micro">Micro (1x1)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-ink-soft mb-1">description (preview text & social embeds)</label>
                  <textarea
                    placeholder="Custom description for cards and social sharing..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={2}
                    className="w-full px-4 py-2 bg-paper-2 text-ink placeholder:text-ink-faint border border-line rounded-lg focus:border-accent-orange focus:outline-none focus:ring-1 focus:ring-accent-orange/40 transition-colors resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-ink-soft mb-1">meta image url (for social embeds)</label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={formData.meta_image}
                    onChange={(e) =>
                      setFormData({ ...formData, meta_image: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-paper-2 text-ink placeholder:text-ink-faint border border-line rounded-lg focus:border-accent-orange focus:outline-none focus:ring-1 focus:ring-accent-orange/40 transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_draft}
                      onChange={(e) =>
                        setFormData({ ...formData, is_draft: e.target.checked })
                      }
                      className="w-4 h-4 accent-accent-orange"
                    />
                    <span className="text-ink-soft">save as draft</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_pinned}
                      onChange={(e) =>
                        setFormData({ ...formData, is_pinned: e.target.checked })
                      }
                      className="w-4 h-4 accent-accent-orange"
                    />
                    <span className="text-ink-soft">📌 pin to top</span>
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  {POST_TYPES.map((type) => {
                    const meta = POST_TYPE_META[type];
                    const styles = TONE_BUTTON_STYLES[meta.tone];
                    const active = formData.type === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        title={meta.blurb}
                        onClick={() => setFormData({ ...formData, type })}
                        className={`px-3 py-1 rounded-full text-sm transition-all border ${
                          active ? styles.active : styles.idle
                        }`}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="btn-sketch-solid w-full justify-center"
              >
                {editingPost ? "update post" : "publish"}
              </button>
            </div>
          </motion.form>
        )}

        {/* Posts List */}
        <div className="mb-4 flex items-baseline gap-3">
          <h2 className="font-serif text-2xl font-medium text-ink">the shelf</h2>
          <span className="font-hand text-lg text-ink-faint">
            {posts.length} {posts.length === 1 ? "entry" : "entries"}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {posts.map((post, i) => {
            const typeColor =
              TONE_TEXT[(POST_TYPE_META[post.type] ?? POST_TYPE_META.note).tone];
            return (
            <motion.div
              key={post.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="sketch-card p-4"
              style={{ rotate: `${(i % 2 === 0 ? -0.5 : 0.5)}deg` }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-serif font-medium text-ink">{post.title}</h3>
                    {post.is_pinned && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent-orange/15 text-accent-orange border border-accent-orange/30">
                        📌 pinned
                      </span>
                    )}
                    {post.is_draft && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent-rust/15 text-accent-rust border border-accent-rust/30">
                        draft
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ink-soft mb-2">
                    <span className={`font-medium ${typeColor}`}>{post.type}</span> •{" "}
                    {new Date(post.created_at).toLocaleDateString()} •{" "}
                    {post.view_count} views
                  </p>
                  {post.content && (
                    <p className="text-xs text-ink-faint line-clamp-2">
                      {post.content.substring(0, 100)}...
                    </p>
                  )}
                </div>
                <div className="flex gap-2 ml-4 shrink-0">
                  <button
                    onClick={() => router.push(`/post/${post.slug}${post.is_draft ? '/preview' : ''}`)}
                    className="text-ink-soft hover:text-ink transition-colors"
                    title="View post"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => startEditing(post)}
                    className="text-accent-purple hover:opacity-70 transition-opacity"
                    title="Edit post"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => deletePost(post.id)}
                    className="text-accent-rust hover:opacity-70 transition-opacity"
                    title="Delete post"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </motion.div>
            );
          })}
        </div>
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
            className="w-8 h-8 border-2 border-cyber-orange border-t-transparent rounded-full"
          />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
