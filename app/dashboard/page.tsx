"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase, Post } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import EnhancedMarkdownEditor from "@/app/components/EnhancedMarkdownEditor";

const ACCENT_COLORS = ["#ff6b3d", "#9c5aff", "#1a1b22"];

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [isMarkdownMode, setIsMarkdownMode] = useState(true);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    type: "note" as "music" | "climb" | "note",
    media_url: "",
    tags: "",
    is_draft: false,
  });

  useEffect(() => {
    checkUser();
    fetchPosts();
  }, []);

  const checkUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/api/auth/login");
    } else {
      setUser(user);
    }
  };

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setLoading(false);
    }
  };

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
            slug,
          })
          .eq("id", editingPost.id);

        if (error) throw error;
      } else {
        // Create new post
        const { error } = await supabase.from("posts").insert([
          {
            ...formData,
            tags,
            accent_color: randomColor,
            view_count: 0,
            slug,
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

  const detectMediaType = (url: string) => {
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      setFormData({ ...formData, media_url: url, type: "climb" });
    } else if (url.includes("soundcloud.com")) {
      setFormData({ ...formData, media_url: url, type: "music" });
    } else {
      setFormData({ ...formData, media_url: url });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-cyber-orange border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-light mb-2">dashboard</h1>
          <p className="text-gray-400">welcome back, {user?.email}</p>
        </motion.header>

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
          className="w-full md:w-auto px-6 py-3 bg-cyber-orange text-black rounded-lg hover:bg-opacity-90 transition-all mb-8"
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
            className="bg-deep-graphite rounded-lg p-6 mb-8"
          >
            <div className="mb-4">
              <h2 className="text-xl font-medium">
                {editingPost ? "Edit Post" : "Create New Post"}
              </h2>
              {editingPost && (
                <p className="text-sm text-gray-400 mt-1">
                  Editing: {editingPost.title}
                </p>
              )}
            </div>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="paste a youtube/soundcloud link..."
                value={formData.media_url}
                onChange={(e) => detectMediaType(e.target.value)}
                className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg focus:border-cyber-orange focus:outline-none"
              />

              <input
                type="text"
                placeholder="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
                className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg focus:border-cyber-orange focus:outline-none"
              />

              {/* Toggle between simple textarea and markdown editor */}
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => setIsMarkdownMode(!isMarkdownMode)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    isMarkdownMode
                      ? "bg-cyber-orange text-black"
                      : "bg-white/10 text-gray-400 hover:bg-white/20"
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
                  <span className="text-xs text-gray-500">
                    ✨ Drag & drop images, markdown shortcuts, and more
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
                  className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg focus:border-cyber-orange focus:outline-none resize-none"
                />
              )}

              <input
                type="text"
                placeholder="tags (comma separated)"
                value={formData.tags}
                onChange={(e) =>
                  setFormData({ ...formData, tags: e.target.value })
                }
                className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg focus:border-cyber-orange focus:outline-none"
              />

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_draft}
                    onChange={(e) =>
                      setFormData({ ...formData, is_draft: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-gray-400">save as draft</span>
                </label>

                <div className="flex gap-2">
                  {["note", "music", "climb"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, type: type as any })
                      }
                      className={`px-3 py-1 rounded-full text-sm transition-all ${
                        formData.type === type
                          ? "bg-white text-black"
                          : "bg-white/10 text-gray-400 hover:bg-white/20"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-white text-black rounded-lg hover:bg-opacity-90 transition-all"
              >
                {editingPost ? "update post" : "publish"}
              </button>
            </div>
          </motion.form>
        )}

        {/* Posts List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {posts.map((post) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-deep-graphite rounded-lg p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium">{post.title}</h3>
                    {post.is_draft && (
                      <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-500">
                        draft
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mb-2">
                    {post.type} •{" "}
                    {new Date(post.created_at).toLocaleDateString()} •{" "}
                    {post.view_count} views
                  </p>
                  {post.content && (
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {post.content.substring(0, 100)}...
                    </p>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => router.push(`/post/${post.id}`)}
                    className="text-gray-400 hover:text-white transition-colors"
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
                    className="text-blue-400 hover:text-blue-300 transition-colors"
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
                    className="text-red-500 hover:text-red-400 transition-colors"
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
          ))}
        </div>
      </div>
    </main>
  );
}
