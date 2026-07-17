-- ============================================================
--  CIRCLE HQ · PIXEL BRIEF QUEUE  (additive, idempotent)
--  S3b Pixel Studio Forge tab. The browser can't call the PixelLab MCP directly
--  (MCP is agent-driven), so the Forge tab composes a generation BRIEF here;
--  Claude reads pending briefs (pixel_brief_list), generates via PixelLab /
--  ComfyUI pixel-LoRA, and calls pixel_vault_ingest — the results land in the
--  Pixel → Ingest queue (migration_pixel_ingest.sql) for review. This closes the
--  loop: brief → generate → ingest → promote → Library.
--  Paste into Supabase → SQL Editor → Run. Safe to re-run.
-- ============================================================
begin;

create table if not exists public.pixel_brief (
  id           text primary key,               -- brief.<slug>-<shortid>
  kind         text not null default 'sprite', -- character | sprite | tile | tileset | animation | ui | …
  prompt       text not null,                  -- what to generate
  count        int  not null default 1,        -- how many variants
  style_ref_id text,                            -- vault item to match style
  size         jsonb not null default '{}',    -- { w, h } hint
  via          text not null default 'pixellab', -- pixellab | comfyui
  status       text not null default 'pending',-- pending | claimed | done | cancelled
  note         text,                            -- founder note to the generator
  result_count int not null default 0,          -- how many ingest rows it produced
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
alter table public.pixel_brief enable row level security;
create index if not exists pixel_brief_status_idx on public.pixel_brief (status);

drop policy if exists pixel_brief_read  on public.pixel_brief;
drop policy if exists pixel_brief_write on public.pixel_brief;
create policy pixel_brief_read  on public.pixel_brief for select using (auth.uid() is not null);
create policy pixel_brief_write on public.pixel_brief for all    using (public.is_admin()) with check (public.is_admin());

commit;
