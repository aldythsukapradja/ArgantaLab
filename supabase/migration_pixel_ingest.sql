-- ============================================================
--  CIRCLE HQ · PIXEL VAULT INGEST QUEUE  (additive, idempotent)
--  S3a Vault Ingest Contract (docs/media-center/ComfyUI-Sovereign-Fabric-Plan.md):
--  EVERY generated pixel asset (PixelLab, ComfyUI, future sources) writes its
--  bytes to the pixel-art bucket under generated/<kind>/<yyyy-mm>/ and a row
--  here — nothing reaches the canonical pixel_asset Library unreviewed.
--  Writes come from the media-gen MCP via the service key (bypasses RLS);
--  the HQ Ingest tab reads/promotes/rejects with the signed-in admin session.
--  Paste into Supabase → SQL Editor → Run. Safe to re-run.
-- ============================================================
begin;

create table if not exists public.pixel_ingest (
  id             text primary key,               -- ingest.<slug>-<shortid>
  suggested_name text not null,
  generated_via  text not null,                  -- 'pixellab' | 'comfyui' | …
  source_job_id  text,                           -- generator-side job/character id (provenance)
  style_ref_id   text,                           -- vault item it was generated against
  prompt         text,                           -- the generation prompt (reproducibility)
  kind           text not null default 'sprite', -- character | sprite | tile | tileset | background | ui | …
  size           jsonb not null default '{}',    -- { w, h }
  swatch         jsonb not null default '[]',    -- representative hex colors
  suggested_tags jsonb not null default '[]',
  animations     jsonb not null default '[]',    -- [{ name, frames, fps, directions, loop }]
  storage_path   text not null,                  -- object path in the pixel-art bucket (REQUIRED — no row without bytes)
  status         text not null default 'pending',-- pending | rejected | promoted
  promoted_id    text,                           -- → pixel_asset.id once promoted
  created_at     timestamptz not null default now(),
  reviewed_at    timestamptz
);
alter table public.pixel_ingest enable row level security;
create index if not exists pixel_ingest_status_idx on public.pixel_ingest (status);
create index if not exists pixel_ingest_created_idx on public.pixel_ingest (created_at desc);

drop policy if exists pixel_ingest_read  on public.pixel_ingest;
drop policy if exists pixel_ingest_write on public.pixel_ingest;
-- same posture as pixel_asset: any signed-in user reads, admins review/promote
-- from the client; the MCP writes with the service key (bypasses RLS).
create policy pixel_ingest_read  on public.pixel_ingest for select using (auth.uid() is not null);
create policy pixel_ingest_write on public.pixel_ingest for all    using (public.is_admin()) with check (public.is_admin());

commit;
