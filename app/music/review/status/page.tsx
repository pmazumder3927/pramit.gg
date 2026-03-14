import { createMetadata } from "@/app/lib/metadata";
import { ReviewStatus } from "@/app/music/components";

export const metadata = createMetadata({
  title: "Review Status",
  description: "Overview of song review queue, upcoming reviews, and unbucketed liked songs.",
});

export default function ReviewStatusPage() {
  return <ReviewStatus reviewHref="/music/manage/review" />;
}
