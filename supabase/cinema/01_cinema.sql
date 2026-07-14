-- Cinema Director — cloud persistence for scenario edits, versions, and audio.
-- Run in the ArgantaLab Supabase project. RLS: every founder owns their own rows.
-- Mirrors the offline localStorage store (hq_cinema_director_v1) so the app can
-- swap the persistence adapter from 'local' to 'supabase' with no UI change.

-- ── Per-scene edits (the live overrides) ────────────────────────────────────
create table if not exists public.cinema_scene_edits (
  user_id     uuid not null references auth.users(id) on delete cascade,
  scene_id    text not null,                 -- "3.12" — the story-lock scene key
  idea        text,
  title       text,
  voice       text check (voice in ('JM','KF')),
  narration   text,
  audio_path  text,                          -- object path in the cinema-audio bucket
  audio_name  text,
  tts_tier    text check (tts_tier in ('experiment','economical','premium')),
  updated_at  timestamptz not null default now(),
  primary key (user_id, scene_id)
);

-- ── Version snapshots (full override map at a point in time) ─────────────────
create table if not exists public.cinema_versions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  label       text not null,
  snapshot    jsonb not null,                -- { [sceneId]: SceneEdit }
  created_at  timestamptz not null default now()
);
create index if not exists cinema_versions_user_idx on public.cinema_versions (user_id, created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.cinema_scene_edits enable row level security;
alter table public.cinema_versions    enable row level security;

drop policy if exists cinema_edits_owner on public.cinema_scene_edits;
create policy cinema_edits_owner on public.cinema_scene_edits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists cinema_versions_owner on public.cinema_versions;
create policy cinema_versions_owner on public.cinema_versions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Audio storage bucket (replaces the localStorage data-URL clips) ─────────
-- Private bucket; owners read/write their own <uid>/<scene>.<ext> objects.
insert into storage.buckets (id, name, public)
  values ('cinema-audio', 'cinema-audio', false)
  on conflict (id) do nothing;

drop policy if exists cinema_audio_rw on storage.objects;
create policy cinema_audio_rw on storage.objects
  for all to authenticated
  using (bucket_id = 'cinema-audio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'cinema-audio' and (storage.foldername(name))[1] = auth.uid()::text);
