import { Post } from '@/app/lib/supabase';
import PostCard from './PostCard';

interface ServerPostsGridProps {
  posts: Post[];
  featuredPosts: Post[];
}

export default function ServerPostsGrid({ posts, featuredPosts }: ServerPostsGridProps) {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Featured Posts Section */}
      {featuredPosts.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-white">Featured Posts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}

      {/* Recent Posts Section */}
      {posts.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold mb-6 text-white">Recent Posts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}

      {/* No posts message */}
      {posts.length === 0 && featuredPosts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400">No posts found.</p>
        </div>
      )}
    </div>
  );
}