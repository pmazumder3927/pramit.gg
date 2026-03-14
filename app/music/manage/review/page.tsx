import { ReviewDeck } from "@/app/music/components/ReviewDeck";

export default function MusicManageReviewPage() {
  return (
    <ReviewDeck
      homeHref="/music/manage"
      statusHref="/music/manage/status"
    />
  );
}
