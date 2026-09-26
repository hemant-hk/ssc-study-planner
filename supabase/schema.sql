-- Study Buddy cloud storage schema
-- Run this once in your Supabase project: Dashboard -> SQL Editor -> New query
--   -> paste -> Run. This creates the study_cache table and the RLS policies
--   the app's server-side routes need to read/write cloud data.
--
-- The app stores two kinds of rows in this single table:
--   * study-plan cache rows   key = a YouTube videoId
--   * subject rows            key = "subject:<subjectId>"
-- Plus one marker row (key = "subject:__seeded__") that records when the app
-- first migrated local data to the cloud.

create table if not exists public.study_cache (
  key        text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.study_cache is
  'Cloud store for study plans and subjects. key is a videoId or subject:<id>.';

-- Enable RLS, then allow anonymous + authenticated access. The app's server
-- routes use the Supabase service-role key (which bypasses RLS) when it is set,
-- and fall back to the anon/publishable key otherwise — so anon must have full
-- access for the fallback path to work.
alter table public.study_cache enable row level security;

drop policy if exists "study_cache_all_anon" on public.study_cache;
create policy "study_cache_all_anon" on public.study_cache
  for all
  to anon
  using (true)
  with check (true);

drop policy if exists "study_cache_all_authenticated" on public.study_cache;
create policy "study_cache_all_authenticated" on public.study_cache
  for all
  to authenticated
  using (true)
  with check (true);