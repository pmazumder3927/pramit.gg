// ---- Post taxonomy: single source of truth ----
// Four content forms that span the table. Each maps to one of the sketchbook
// stamp tones (orange | purple | rust | ink), so badges, stamps, and tape all
// stay in sync. Stored values are singular; filters show plurals.

export const POST_TYPES = ["build", "study", "musing", "note"] as const;
export type PostType = (typeof POST_TYPES)[number];

export type PostTypeTone = "orange" | "purple" | "rust" | "ink";

export const POST_TYPE_META: Record<
  PostType,
  {
    label: string; // singular, for stamps & card badges
    plural: string; // for filter chips
    tone: PostTypeTone; // sketchbook tone (drives stamp/tape color)
    badge: string; // tailwind classes for the card badge pill
    blurb: string; // one-line description (dashboard hint / tooltips)
  }
> = {
  build: {
    label: "build",
    plural: "builds",
    tone: "orange",
    badge: "bg-accent-orange/15 text-accent-orange",
    blurb: "things i made — projects & implementation logs",
  },
  study: {
    label: "study",
    plural: "studies",
    tone: "rust",
    badge: "bg-accent-rust/15 text-accent-rust",
    blurb: "explainers, teaching & research deep-dives",
  },
  musing: {
    label: "musing",
    plural: "musings",
    tone: "purple",
    badge: "bg-accent-purple/15 text-accent-purple",
    blurb: "reflective, opinion & whimsical writing",
  },
  note: {
    label: "note",
    plural: "notes",
    tone: "ink",
    badge: "bg-ink/10 text-ink-soft",
    blurb: "short updates, fragments & ephemera",
  },
};

// Filter list for the homepage feed: "everything" + one chip per type (plural).
export const POST_TYPE_FILTERS: { key: "all" | PostType; label: string }[] = [
  { key: "all", label: "everything" },
  ...POST_TYPES.map((t) => ({ key: t, label: POST_TYPE_META[t].plural })),
];

// Dashboard toggle-button styles, keyed by tone (active / idle states).
export const TONE_BUTTON_STYLES: Record<
  PostTypeTone,
  { active: string; idle: string }
> = {
  orange: {
    active: "bg-accent-orange text-pure-white border-accent-orange",
    idle: "bg-accent-orange/10 text-accent-orange border-accent-orange/30 hover:bg-accent-orange/20",
  },
  rust: {
    active: "bg-accent-rust text-pure-white border-accent-rust",
    idle: "bg-accent-rust/10 text-accent-rust border-accent-rust/30 hover:bg-accent-rust/20",
  },
  purple: {
    active: "bg-accent-purple text-pure-white border-accent-purple",
    idle: "bg-accent-purple/10 text-accent-purple border-accent-purple/30 hover:bg-accent-purple/20",
  },
  ink: {
    active: "bg-ink text-paper border-ink",
    idle: "bg-ink/10 text-ink-soft border-ink/30 hover:bg-ink/20",
  },
};

// text-color helper for compact lists (e.g. dashboard shelf).
export const TONE_TEXT: Record<PostTypeTone, string> = {
  orange: "text-accent-orange",
  rust: "text-accent-rust",
  purple: "text-accent-purple",
  ink: "text-ink-soft",
};
