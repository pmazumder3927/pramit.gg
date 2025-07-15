import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { Post } from "@/app/lib/supabase";
import Navigation from "@/app/components/Navigation";
import NowPlaying from "@/app/components/NowPlaying";
import HomeAnimations from "./components/HomeAnimations";

function PostCard({ post, featured = false }: { post: Post; featured?: boolean }) {
  const postDate = new Date(post.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <Link 
      href={`/post/${post.slug}`} 
      className={`block group ${featured ? 'flex-shrink-0 w-80 md:w-96 lg:w-[420px]' : ''}`}
      data-animate="fade-up"
    >
      <div className="h-full bg-gradient-to-br from-charcoal-black/90 via-charcoal-black/70 to-void-black/90 backdrop-blur-xl border border-white/5 rounded-2xl p-6 overflow-hidden transition-all duration-700 hover:border-white/10 hover:shadow-2xl hover:shadow-black/50 hover:scale-[1.02]">
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
              post.type === 'music' ? 'bg-accent-purple/10 text-accent-purple border border-accent-purple/20' :
              post.type === 'climb' ? 'bg-accent-orange/10 text-accent-orange border border-accent-orange/20' :
              'bg-accent-blue/10 text-accent-blue border border-accent-blue/20'
            }`}>
              {post.type}
            </span>
            <time className="text-xs text-gray-500" dateTime={post.created_at}>
              {postDate}
            </time>
          </div>

          <h2 className={`${featured ? 'text-xl' : 'text-lg'} font-light text-white mb-3 line-clamp-2 group-hover:text-accent-orange transition-colors duration-300`}>
            {post.title}
          </h2>

          <p className="text-gray-400 text-sm line-clamp-3 mb-4">
            {post.content?.replace(/[#*`]/g, '').substring(0, 150)}...
          </p>

          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {post.tags?.slice(0, 3).map((tag) => (
                <span key={tag} className="text-xs text-gray-500">
                  #{tag}
                </span>
              ))}
            </div>
            {post.view_count > 0 && (
              <span className="text-xs text-gray-500">
                {post.view_count} views
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default async function Home() {
  const supabase = await createClient();
  
  const { data: posts, error } = await supabase
    .from("posts")
    .select("*")
    .eq("is_draft", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching posts:", error);
  }

  const featuredPosts = posts?.slice(0, 3) || [];
  const remainingPosts = posts?.slice(3) || [];

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(120,119,198,0.03),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,107,61,0.02),transparent_50%)]" />

        <main className="relative z-10 min-h-screen">
          <Navigation />

          {/* Hero Section */}
          <section 
            className="relative pt-20 pb-12 md:pt-32 md:pb-20"
            data-animate="fade-in"
          >
            <div className="max-w-7xl mx-auto px-6 md:px-8">
              <div className="text-center">
                <h1 
                  className="text-5xl md:text-7xl lg:text-8xl font-extralight tracking-tight mb-6"
                  data-animate="fade-up"
                  data-delay="200"
                >
                  <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                    pramit mazumder
                  </span>
                </h1>
                <p 
                  className="text-xl md:text-2xl text-gray-400 font-light max-w-2xl mx-auto leading-relaxed"
                  data-animate="fade-up"
                  data-delay="400"
                >
                  a living, evolving journal of interests, projects, and experiences
                </p>
              </div>
            </div>
          </section>

          <div className="max-w-7xl mx-auto px-6 md:px-8">
            {/* Featured Posts */}
            {featuredPosts.length > 0 && (
              <section 
                className="mb-16 md:mb-24"
                data-animate="fade-up"
                data-delay="600"
              >
                <div className="mb-8">
                  <h2 
                    className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2"
                    data-animate="slide-right"
                    data-delay="800"
                  >
                    Featured
                  </h2>
                  <div 
                    className="h-px bg-gradient-to-r from-accent-orange/20 via-accent-purple/20 to-transparent"
                    data-animate="scale-x"
                    data-delay="900"
                  />
                </div>

                <div className="overflow-x-auto scrollbar-hide ios-momentum-scroll">
                  <div className="flex gap-6 md:gap-8 pb-4">
                    {featuredPosts.map((post, index) => (
                      <div
                        key={post.id}
                        data-animate="fade-scale"
                        data-delay={`${800 + index * 100}`}
                      >
                        <PostCard post={post} featured={true} />
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* All Posts Grid */}
            {posts && posts.length > 0 ? (
              <section className="mb-16">
                {remainingPosts.length > 0 && (
                  <>
                    <div className="mb-8">
                      <h2 
                        className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2"
                        data-animate="slide-right"
                        data-delay="1200"
                      >
                        All Posts
                      </h2>
                      <div 
                        className="h-px bg-gradient-to-r from-accent-purple/20 via-accent-orange/20 to-transparent"
                        data-animate="scale-x"
                        data-delay="1300"
                      />
                    </div>

                    <div 
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8"
                      data-animate-children="stagger"
                      data-delay="1400"
                    >
                      {remainingPosts.map((post, index) => (
                        <div
                          key={post.id}
                          data-animate="fade-up"
                          data-stagger-delay={`${index * 50}`}
                        >
                          <PostCard post={post} />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
            ) : (
              <div 
                className="text-center py-24"
                data-animate="fade-in"
                data-delay="1000"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-white/5 rounded-full mb-6">
                  <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                </div>
                <p className="text-gray-500 text-lg font-light">
                  No posts yet. Check back soon.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="mt-24 pb-24 md:pb-16">
            <div className="max-w-7xl mx-auto px-6 md:px-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                  <NowPlaying />
                </div>
                <div className="flex items-center gap-6 text-sm text-gray-500">
                  <Link href="/about" className="hover:text-white transition-colors duration-300 font-light">
                    About
                  </Link>
                  <div className="w-1 h-1 bg-gray-700 rounded-full" />
                  <span className="font-light">© 2025 pramit mazumder</span>
                </div>
              </div>
            </div>
          </footer>
        </main>
      </div>

      {/* Client-side animations */}
      <HomeAnimations />
    </>
  );
}
