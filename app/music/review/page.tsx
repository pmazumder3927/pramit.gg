import { createMetadata } from "@/app/lib/metadata";
import { ReviewDeck } from "@/app/music/components";

export const metadata = createMetadata({
  title: "Music Review",
  description:
    "Private Spotify review workflow for maintaining liked songs and mood buckets over time.",
});

export default function MusicReviewPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black px-4 pb-24 pt-20 text-white md:pt-28">
      <ReviewDeck />
    </main>
  );
}
