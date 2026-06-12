-- Writing room: safe autosave for published posts + revision snapshots.
--
-- The /write room works without this migration (published edits then autosave
-- to this device only, and "earlier ink" is hidden). Applying it unlocks:
--   1. posts.draft — a working copy for published posts: autosave writes here,
--      never the live row, so readers never see half-finished sentences.
--      "set the page" copies draft -> live columns and clears it.
--   2. post_revisions — snapshots taken at every publish/republish plus a
--      throttled trail (~10 min) while writing. Restore from "earlier ink ↺".

alter table public.posts add column if not exists draft jsonb;

create table if not exists public.post_revisions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  snapshot jsonb not null,
  kind text not null default 'autosnap',
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists post_revisions_post_id_created_at_idx
  on public.post_revisions (post_id, created_at desc);

-- Only the service role (server routes, after an auth check) ever touches
-- revisions: RLS on with no policies blocks anon + authenticated entirely.
alter table public.post_revisions enable row level security;
