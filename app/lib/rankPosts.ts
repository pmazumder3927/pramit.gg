import { Post } from "./supabase";

const DAY_MS = 86_400_000;

// A post keeps half its freshness after two months — long enough that a new
// piece owns the top of the table for weeks, short enough that the archive's
// proven work (by view count) wins back the spotlight afterwards.
const FRESHNESS_HALF_LIFE_DAYS = 62;

const FRESHNESS_WEIGHT = 0.55;
const ENGAGEMENT_WEIGHT = 0.45;
// Pinning nudges a post up a few slots; it no longer outranks everything.
const PIN_BOOST = 0.15;

export function postAgeDays(post: Post, now: number): number {
  return Math.max(0, (now - new Date(post.created_at).getTime()) / DAY_MS);
}

export function isFreshPost(post: Post, now: number): boolean {
  return postAgeDays(post, now) <= 21;
}

/**
 * Order posts for the front page: fresh work first, then the posts readers
 * actually return to, with pins as a gentle thumb on the scale.
 */
export function rankPosts(posts: Post[], now = Date.now()): Post[] {
  const maxViews = Math.max(1, ...posts.map((p) => p.view_count || 0));

  const score = (p: Post) => {
    const freshness = Math.exp(
      (-Math.LN2 * postAgeDays(p, now)) / FRESHNESS_HALF_LIFE_DAYS,
    );
    const engagement = Math.log1p(p.view_count || 0) / Math.log1p(maxViews);
    return (
      FRESHNESS_WEIGHT * freshness +
      ENGAGEMENT_WEIGHT * engagement +
      (p.is_pinned ? PIN_BOOST : 0)
    );
  };

  return posts
    .map((post) => ({ post, score: score(post) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        new Date(b.post.created_at).getTime() -
          new Date(a.post.created_at).getTime(),
    )
    .map(({ post }) => post);
}
