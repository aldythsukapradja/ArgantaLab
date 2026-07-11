-- Video-asset storage pipeline — lets Circle HQ's Video Builder use Supabase
-- Storage as its media library (footage, images, music, fonts) + render sink.
-- Run once in the ArgantaLab Supabase project (bdagdxgpnlialkppjwor).
--
-- Security posture (mirrors migration_audio_library.sql):
--   • Buckets are PUBLIC-READ (assets are marketing media, no secrets) so
--     getPublicUrl + on-the-fly image transforms work without signing.
--   • WRITE (upload / import / delete) = operator only, enforced on both
--     storage.objects and the metadata table.
--   • hq_video_asset is the fast, filterable index the Media panel queries
--     (never lists the raw bucket).

begin;

-- ── operator guard ─────────────────────────────────────────────────────────
create or replace function public.video_is_operator()
returns boolean language sql stable security definer set search_path = public as $$
  select lower(coalesce((auth.jwt() ->> 'email'), '')) = 'aldhyt.sukapradja@gmail.com'
$$;

-- ── buckets ────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('video-assets',  'video-assets',  true, 52428800),   -- 50MB/std upload; use TUS for bigger
  ('video-renders', 'video-renders', true, 524288000)   -- 500MB renders
on conflict (id) do nothing;

-- ── storage.objects RLS for these two buckets ──────────────────────────────
-- Public read (buckets are public), operator-only mutations.
drop policy if exists video_objs_read on storage.objects;
create policy video_objs_read on storage.objects
  for select using (bucket_id in ('video-assets','video-renders'));

drop policy if exists video_objs_insert on storage.objects;
create policy video_objs_insert on storage.objects
  for insert with check (bucket_id in ('video-assets','video-renders') and public.video_is_operator());

drop policy if exists video_objs_update on storage.objects;
create policy video_objs_update on storage.objects
  for update using (bucket_id in ('video-assets','video-renders') and public.video_is_operator());

drop policy if exists video_objs_delete on storage.objects;
create policy video_objs_delete on storage.objects
  for delete using (bucket_id in ('video-assets','video-renders') and public.video_is_operator());

-- ── metadata index table ───────────────────────────────────────────────────
create table if not exists public.hq_video_asset (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('image','video','audio','font')),
  bucket       text not null default 'video-assets',
  path         text not null,
  name         text,
  mime         text,
  bytes        bigint,
  width        int,
  height       int,
  duration     real,
  tags         text[] not null default '{}',
  source       text not null default 'upload',   -- upload | pexels | pixabay | render | generated
  attribution  text,                             -- required for stock (photographer + link)
  thumb_path   text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);
create index if not exists hq_video_asset_kind_idx on public.hq_video_asset (kind, created_at desc);
create index if not exists hq_video_asset_tags_idx on public.hq_video_asset using gin (tags);
create unique index if not exists hq_video_asset_path_idx on public.hq_video_asset (bucket, path);

alter table public.hq_video_asset enable row level security;

-- Read = anyone (library carries no secrets; Kinetik posts need public read).
drop policy if exists hq_video_asset_read on public.hq_video_asset;
create policy hq_video_asset_read on public.hq_video_asset for select using (true);

drop policy if exists hq_video_asset_write on public.hq_video_asset;
create policy hq_video_asset_write on public.hq_video_asset
  for all using (public.video_is_operator()) with check (public.video_is_operator());

grant execute on function public.video_is_operator() to authenticated, anon;

commit;

-- Rollback:
--   drop table if exists public.hq_video_asset;
--   drop policy if exists video_objs_read on storage.objects;
--   drop policy if exists video_objs_insert on storage.objects;
--   drop policy if exists video_objs_update on storage.objects;
--   drop policy if exists video_objs_delete on storage.objects;
--   drop function if exists public.video_is_operator();
--   delete from storage.buckets where id in ('video-assets','video-renders');
