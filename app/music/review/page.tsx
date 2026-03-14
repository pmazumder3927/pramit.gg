import { createMetadata } from "@/app/lib/metadata";
import { ReviewDeck } from "@/app/music/components";

export const metadata = createMetadata({
  title: "Music Review",
  description:
    "Private Spotify review workflow for maintaining liked songs and mood buckets over time.",
});

export default function MusicReviewPage() {
  return <ReviewDeck />;
}
