-- Derived, library-scale features for sequencing.
--
-- Every number here is standardised or ranked against the WHOLE library, never
-- against one playlist, so a threshold means the same thing on a 17-track list
-- and a 225-track one. The table is fully recomputed by a refit rather than
-- maintained incrementally: it is ~950 rows of arithmetic over vectors that are
-- already stored, so rebuilding it costs a couple of seconds and there is never
-- a question of whether it drifted.
create table if not exists music_track_feel (
  track_id     text primary key references music_tracks(track_id) on delete cascade,
  -- how hard the song drives, in SD of the library
  arousal      real not null,
  -- bleak to bright, in SD of the library
  valence      real not null,
  intimacy     real not null,
  nostalgia    real not null,
  -- words a minute, 0..1 across non-instrumental tracks; null when unknown
  density      real,
  -- how likely a stranger is to know it, 0..1
  familiarity  real not null,
  -- how new it is, which is a different question: `familiarity` says whether a
  -- visitor will recognise it, `freshness` says whether the owner found it
  -- recently or it came out recently. A brand-new obscure record scores high on
  -- one and low on the other, and the two want opposite things from the order.
  freshness    real,
  new_to_me    real,
  new_out      real,
  -- can someone get into it in the first ten seconds
  opens_well   boolean not null default false,
  -- what it sounds like, and what it is about, each small enough to load a
  -- playlist's worth without pulling 1536 dimensions per track
  texture      vector(12),
  meaning      vector(40),
  fitted_at    timestamptz not null default now()
);

-- Every other music_* table has this. Without it the anon key that ships in the
-- browser bundle can read, rewrite and delete the whole feature table, and the
-- sequencer would quietly order by whatever it found there. No policies: RLS on
-- with none blocks anon and authenticated outright, while the service-role
-- client every reader uses bypasses it.
alter table music_track_feel enable row level security;

create index if not exists music_track_feel_arousal_idx on music_track_feel (arousal);

-- Two measurements the audio pass already computes and throws away.
alter table music_track_sound add column if not exists pulse real;
alter table music_track_sound add column if not exists crest real;
-- What the Deezer matcher actually picked, so a wrong-song analysis is auditable
-- instead of silently permanent.
alter table music_track_sound add column if not exists deezer_id bigint;
alter table music_track_sound add column if not exists matched_title text;
alter table music_track_sound add column if not exists matched_artist text;
alter table music_track_sound add column if not exists matched_duration_s int;

alter table music_sequences add column if not exists sides jsonb;
