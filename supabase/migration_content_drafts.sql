-- migration_content_drafts.sql — O5, the Claude Code → HQ bridge table.
-- The MCP server (tools/arganta-core-mcp) writes a draft here after calling the
-- Arganta Core Content Worker; Post Studio's Drafts inbox (S7) reads it, turns
-- the stored copy into a PostDoc via coercePost, and loads it on the canvas.
--
-- Run in the ArgantaLab Supabase project (bdagdxgpnlialkppjwor).
-- Additive only — no existing table is touched.

create table if not exists content_draft (
  id           uuid primary key default gen_random_uuid(),
  brief        text not null,
  status       text not null default 'ready',      -- 'ready' | 'error'
  copy         jsonb not null default '{}'::jsonb,  -- coerced COPY_SCHEMA (+ per-slide imageUrl)
  format       text,
  palette      text,
  platform     text,
  provenance   jsonb,                               -- worker provider/model/latency/neurons
  error        text,
  source       text not null default 'claude-code',
  created_at   timestamptz not null default now(),
  consumed_at  timestamptz                          -- set by the inbox when opened
);

create index if not exists content_draft_created_idx on content_draft (created_at desc);

alter table content_draft enable row level security;

-- Operator-only from the browser (the inbox). The MCP writes with the service-
-- role key, which bypasses RLS — so no anon insert path is opened here.
-- hq_is_operator() is the same gate every other HQ write RPC uses.
drop policy if exists content_draft_operator_all on content_draft;
create policy content_draft_operator_all on content_draft
  for all using (hq_is_operator()) with check (hq_is_operator());

grant select, insert, update, delete on content_draft to authenticated;
