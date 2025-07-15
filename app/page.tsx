import { getPosts } from "@/app/lib/server-actions";
import Navigation from "@/app/components/Navigation";
import PostCardBase from "@/app/components/PostCardBase";
import NowPlaying from "@/app/components/NowPlaying";
import ClientEnhancements from "@/app/components/ClientEnhancements";

export const metadata = {
  alternates: {
    canonical: '/',
  },
};

export default async function Home() {
  const posts = await getPosts();
  const featuredPosts = posts.slice(0, 3);
  const remainingPosts = posts.slice(3);
  
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(120,119,198,0.03),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,107,61,0.02),transparent_50%)]" />

        <main className="relative z-10 min-h-screen">
          <Navigation />

          {/* Hero Section - Works without JS */}
          <section className="relative pt-20 pb-12 md:pt-32 md:pb-20">
            <div className="max-w-7xl mx-auto px-6 md:px-8">
              <div className="text-center">
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-extralight tracking-tight mb-6 hero-title">
                  <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                    pramit mazumder
                  </span>
                </h1>
                <p className="text-xl md:text-2xl text-gray-400 font-light max-w-2xl mx-auto leading-relaxed hero-subtitle">
                  a living, evolving journal of interests, projects, and experiences
                </p>
              </div>
            </div>
          </section>

          <div className="max-w-7xl mx-auto px-6 md:px-8">
            {/* Featured Posts */}
            {featuredPosts.length > 0 && (
              <section className="mb-16 md:mb-24 featured-section">
                <div className="mb-8">
                  <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Featured
                  </h2>
                  <div className="h-px bg-gradient-to-r from-accent-orange/20 via-accent-purple/20 to-transparent" />
                </div>

                <div className="overflow-x-auto scrollbar-hide ios-momentum-scroll">
                  <div className="flex gap-6 md:gap-8 pb-4">
                    {featuredPosts.map((post, index) => (
                      <div
                        key={post.id}
                        className="flex-shrink-0 w-80 md:w-96 lg:w-[420px] post-card"
                        data-index={index}
                      >
                        <PostCardBase post={post} index={index} featured={true} />
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Main Posts Grid */}
            {remainingPosts.length === 0 && featuredPosts.length === 0 ? (
              <div className="text-center py-24">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-white/5 rounded-full mb-6">
                  <svg
                    className="w-8 h-8 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                    />
                  </svg>
                </div>
                <p className="text-gray-500 text-lg font-light">
                  No posts yet. Check back soon.
                </p>
              </div>
            ) : (
              <section className="mb-16 posts-section">
                {remainingPosts.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                      All Posts
                    </h2>
                    <div className="h-px bg-gradient-to-r from-accent-purple/20 via-accent-orange/20 to-transparent" />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                  {remainingPosts.map((post, index) => (
                    <div
                      key={post.id}
                      className="group post-card"
                      data-index={index + 3}
                    >
                      <PostCardBase
                        post={post}
                        index={index + 3}
                        featured={false}
                      />
                    </div>
                  ))}
                </div>
              </section>
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
                  <a
                    href="/about"
                    className="hover:text-white transition-colors duration-300 font-light"
                  >
                    About
                  </a>
                  <div className="w-1 h-1 bg-gray-700 rounded-full" />
                  <span className="font-light">© 2025 pramit mazumder</span>
                </div>
              </div>
            </div>
          </footer>
        </main>
      </div>

      {/* Progressive Enhancement - Only loads if JS is available */}
      <ClientEnhancements />
      
      {/* JSON-LD structured data for the homepage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "pramit.gg",
            url: "https://pramit.gg",
            description: "a living, evolving journal of interests, projects, and experiences",
            author: {
              "@type": "Person",
              name: "Pramit",
              url: "https://pramit.gg/about"
            },
            potentialAction: {
              "@type": "SearchAction",
              target: {
                "@type": "EntryPoint",
                urlTemplate: "https://pramit.gg/search?q={search_term_string}"
              },
              "query-input": "required name=search_term_string"
            }
          }),
        }}
      />
    </>
  );
}
