-- ============================================================
--  CIRCLE HQ · PIXEL VAULT  (additive, idempotent)
--  The private, login-walled pixel-art database. Binaries live in a PRIVATE
--  Storage bucket (pixel-art); metadata lives in pixel_asset. Personal use —
--  read is gated to signed-in users, writes to admins (the sync uses the service
--  key and bypasses RLS). Paste into Supabase → SQL Editor → Run. Safe to re-run.
-- ============================================================
begin;

-- 1 · the catalogue — one row per asset, metadata mirrors the app's VaultItem
create table if not exists public.pixel_asset (
  id           text primary key,               -- immutable, e.g. asset.mount.emberfox
  name         text not null,
  source       jsonb not null default '{}',    -- { name, sourceId, pack, url, author, license, tier, fetchedAt }
  curated      jsonb not null default '{}',     -- { domain[], kind, isCharacter, characterType, theme[], style, groupId, tags[], verified }
  form         jsonb not null default '{}',     -- { size, perspective, paletteId, colorCount, swatch[] }
  animations   jsonb not null default '[]',
  tier         text not null default 'T0',      -- T0 | T1 | T2 (denormalised for fast filtering)
  license      text,
  status       text,                            -- draft | published | deprecated (null = reference)
  storage_path text,                            -- object path in the pixel-art bucket (null until synced)
  updated_at   timestamptz not null default now()
);
alter table public.pixel_asset enable row level security;
create index if not exists pixel_asset_tier_idx   on public.pixel_asset (tier);
create index if not exists pixel_asset_status_idx on public.pixel_asset (status);
create index if not exists pixel_asset_curated_idx on public.pixel_asset using gin (curated);

drop policy if exists pixel_asset_read  on public.pixel_asset;
drop policy if exists pixel_asset_write on public.pixel_asset;
-- private app: any signed-in user reads; only admins write from the client
create policy pixel_asset_read  on public.pixel_asset for select using (auth.uid() is not null);
create policy pixel_asset_write on public.pixel_asset for all    using (public.is_admin()) with check (public.is_admin());

-- 2 · shared palettes (Lospec-shaped)
create table if not exists public.pixel_palette (
  id       text primary key,
  name     text not null,
  author   text,
  colors   jsonb not null default '[]',
  source   text,
  license  text,
  tags     jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
alter table public.pixel_palette enable row level security;
drop policy if exists pixel_palette_read  on public.pixel_palette;
drop policy if exists pixel_palette_write on public.pixel_palette;
create policy pixel_palette_read  on public.pixel_palette for select using (auth.uid() is not null);
create policy pixel_palette_write on public.pixel_palette for all    using (public.is_admin()) with check (public.is_admin());

-- 3 · PRIVATE storage bucket for the binaries
insert into storage.buckets (id, name, public)
values ('pixel-art', 'pixel-art', false)
on conflict (id) do nothing;

drop policy if exists pixel_art_read  on storage.objects;
drop policy if exists pixel_art_write on storage.objects;
create policy pixel_art_read  on storage.objects for select
  using (bucket_id = 'pixel-art' and auth.uid() is not null);
create policy pixel_art_write on storage.objects for all
  using (bucket_id = 'pixel-art' and public.is_admin())
  with check (bucket_id = 'pixel-art' and public.is_admin());

-- 4 · consumption view — what the apps/agents read (published, ship-ready)
create or replace view public.pixel_manifest as
  select id, name, tier, license, form, animations, storage_path, curated
  from public.pixel_asset
  where status = 'published';

commit;

-- After running: `cd apps/mcp && SUPABASE_URL=… SUPABASE_SERVICE_KEY=… npx tsx scripts/pixel-sync.ts`
-- uploads the repo's real art to the bucket and upserts every catalogue row.
