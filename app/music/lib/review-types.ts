export interface ReviewBucket {
  bucketId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  playlistUrl: string | null;
  trackCount: number;
  followerCount: number;
  isActive: boolean;
  score?: number;
  reason?: string;
}

export interface ReviewTrack {
  trackId: string;
  spotifyUri: string | null;
  title: string;
  artistDisplay: string;
  artistNames: string[];
  albumName: string | null;
  albumImageUrl: string | null;
  previewUrl: string | null;
  songUrl: string | null;
  durationMs: number | null;
  popularity: number | null;
  explicit: boolean;
  isLiked: boolean;
  addedToLikedAt: string | null;
  removedFromLikedAt: string | null;
  lastPlayedAt: string | null;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  intervalDays: number;
  easeFactor: number;
  reviewCount: number;
  confirmStreak: number;
  deferCount: number;
  unsureCount: number;
  surfacedCount: number;
  dueScore: number;
  overdueDays: number;
  daysSinceListen: number | null;
  daysSinceReview: number | null;
  activeBuckets: ReviewBucket[];
  suggestedBuckets: ReviewBucket[];
  reasons: string[];
}

export interface ReviewQueueSnapshot {
  authenticated: boolean;
  connected: boolean;
  sync: {
    status: "idle" | "running" | "error";
    lastCompletedAt: string | null;
    lastError: string | null;
    needsReconnect: boolean;
  };
  stats: {
    dueNow: number;
    dueSoon: number;
    rediscoveryCount: number;
    neglectedCount: number;
  };
  session: {
    headline: string;
    subhead: string;
  };
  currentTrack: ReviewTrack | null;
  upcoming: ReviewTrack[];
  allBuckets: ReviewBucket[];
}

export interface ReviewActionInput {
  trackId: string;
  bucketIds: string[];
  liked: boolean;
  intent: "confirm" | "update_buckets" | "unlike" | "defer" | "unsure";
}

export interface ReviewStatusSnapshot {
  stats: {
    total: number;
    dueNow: number;
    dueSoon: number;
    reviewed: number;
    neverReviewed: number;
    unbucketedCount: number;
  };
  dueNow: ReviewTrack[];
  upcoming: ReviewTrack[];
  unbucketed: ReviewTrack[];
  allBuckets: ReviewBucket[];
}
