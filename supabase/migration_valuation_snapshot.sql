-- ============================================================
--  CIRCLE HQ · VALUATION SNAPSHOT  (append-only, idempotent)
--  The Actuary's history ledger — one row per method per snapshot, written by
--  the monthly automation (Bridge → valuation_estimate). Same append-only
--  discipline as diamond_ledger: no updates, no deletes. Read = founder/admin;
--  insert = service role only. Paste into Supabase → SQL Editor → Run. Safe to re-run.
-- ============================================================
begin;

create table if not exists public.valuation_snapshot (
  id         uuid primary key default gen_random_uuid(),
  taken_at   timestamptz not null default now(),
  method     text not null check (method in (
    'cost_to_duplicate','berkus','risk_factor_sum',
    'scorecard','vc_method','first_chicago','synthesized')),
  low_usd    numeric not null,          -- USD (not millions) for ledger precision
  high_usd   numeric not null,
  provenance text not null check (provenance in ('live','partial','simulated','placeholder')),
  inputs     jsonb not null default '{}',   -- the graph inputs behind this row (auditable)
  created_by text not null default 'bridge'
);
alter table public.valuation_snapshot enable row level security;
create index if not exists valuation_snapshot_taken_idx  on public.valuation_snapshot (taken_at desc);
create index if not exists valuation_snapshot_method_idx on public.valuation_snapshot (method, taken_at desc);

-- read: founder/admin only (it's a private company number); insert: service role (bypasses RLS)
drop policy if exists valuation_snapshot_read on public.valuation_snapshot;
create policy valuation_snapshot_read on public.valuation_snapshot for select using (public.is_admin());
-- no update/delete policy: append-only by construction

commit;

-- The monthly snapshot (Render cron or Supabase scheduled fn) inserts one row per
-- method from valuation_estimate(); valuation_history then reads the series.
