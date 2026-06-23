-- ============================================================
--  BUILDER · FEATURING & ANALYTICS SPINE
--  Apply after schema.sql. Idempotent — safe to re-run.
--  Adds featuring columns, telemetry capture, daily rollups,
--  a curator audit log, and helper RPCs.
-- ============================================================

-- ── Featuring / analytics columns on artifacts ────────────────────────
alter table public.games
  add column if not exists featured        boolean not null default false,
  add column if not exists featured_rank   int,
  add column if not exists featured_set_at timestamptz,
  add column if not exists pinned          boolean not null default false,
  add column if not exists rating_avg      numeric(3,2),
  add column if not exists rating_count    int not null default 0,
  add column if not exists share_count     int not null default 0,
  add column if not exists engagement_score numeric,
  add column if not exists engagement_updated_at timestamptz;

-- hq_app becomes a first-class publishable artifact too.
alter table public.hq_app
  add column if not exists html            text,
  add column if not exists description     text,
  add column if not exists visibility      text not null default 'public',
  add column if not exists circle_ids      uuid[],
  add column if not exists plays           int not null default 0,
  add column if not exists thumbnail       text,
  add column if not exists featured        boolean not null default false,
  add column if not exists featured_rank   int,
  add column if not exists featured_set_at timestamptz,
  add column if not exists pinned          boolean not null default false,
  add column if not exists rating_avg      numeric(3,2),
  add column if not exists rating_count    int not null default 0,
  add column if not exists share_count     int not null default 0,
  add column if not exists engagement_score numeric,
  add column if not exists engagement_updated_at timestamptz;

-- ── Telemetry: every SDK event from a live play ───────────────────────
create table if not exists public.artifact_telemetry (
  id            uuid primary key default gen_random_uuid(),
  artifact_id   uuid not null,
  artifact_kind text not null check (artifact_kind in ('game','app')),
  event_type    text not null,
  user_id       uuid,
  circle_id     uuid,
  payload       jsonb default '{}'::jsonb,
  emitted_at    timestamptz not null default now()
);
create index if not exists idx_telemetry_artifact on public.artifact_telemetry (artifact_id, emitted_at desc);
create index if not exists idx_telemetry_event on public.artifact_telemetry (artifact_kind, event_type);

alter table public.artifact_telemetry enable row level security;

-- Anyone authenticated can append their own events; reads are operator-only
-- (mirror your existing operator gate — adjust to your is_operator() helper).
drop policy if exists telemetry_insert on public.artifact_telemetry;
create policy telemetry_insert on public.artifact_telemetry
  for insert to authenticated with check (true);

drop policy if exists telemetry_read on public.artifact_telemetry;
create policy telemetry_read on public.artifact_telemetry
  for select to authenticated using (true);

-- ── Daily analytics rollup (computed by cron / edge function) ─────────
create table if not exists public.artifact_analytics (
  id               uuid primary key default gen_random_uuid(),
  artifact_id      uuid not null,
  artifact_kind    text not null check (artifact_kind in ('game','app')),
  date             date not null,
  plays            int not null default 0,
  unique_circles   int not null default 0,
  unique_users     int not null default 0,
  avg_session_mins numeric,
  share_count      int not null default 0,
  rating_avg       numeric(3,2),
  rating_count     int not null default 0,
  engagement_score numeric,
  computed_at      timestamptz not null default now(),
  unique (artifact_id, date)
);
create index if not exists idx_analytics_artifact on public.artifact_analytics (artifact_id, date desc);

alter table public.artifact_analytics enable row level security;
drop policy if exists analytics_read on public.artifact_analytics;
create policy analytics_read on public.artifact_analytics
  for select to authenticated using (true);

-- ── Curator audit log (who featured what, and why) ────────────────────
create table if not exists public.featured_curator_log (
  id            uuid primary key default gen_random_uuid(),
  artifact_id   uuid not null,
  artifact_kind text not null check (artifact_kind in ('game','app')),
  rank          int,
  reason        text,                          -- 'algorithm' | 'manual_pin' | 'promoted_via_rec'
  curator_id    uuid default auth.uid(),
  set_at        timestamptz not null default now()
);

-- ── Helper RPC: increment lifetime plays atomically ───────────────────
create or replace function public.increment_plays(p_kind text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_kind = 'game' then
    update public.games set plays = coalesce(plays,0) + 1 where id = p_id;
  elsif p_kind = 'app' then
    update public.hq_app set plays = coalesce(plays,0) + 1 where id = p_id;
  end if;
end; $$;
grant execute on function public.increment_plays(text, uuid) to authenticated;

-- ── Helper RPC: compute & persist engagement score (mirrors algorithm.ts) ─
-- Deterministic weighted blend; recompute on a schedule or after telemetry writes.
create or replace function public.recompute_engagement(p_kind text)
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  if p_kind = 'game' then
    update public.games g set
      engagement_score = (
        (coalesce(g.plays,0) * 0.40) +
        (coalesce(g.rating_avg,0) * 1000 * 0.25) +
        (coalesce(g.rating_count,0) * 5 * 0.15) +
        (coalesce(g.share_count,0) * 50 * 0.10) +
        (least(extract(day from now() - g.created_at), 60) * 10 * 0.10)
      ) * (case when now() - g.created_at <= interval '7 days' then 1.10 else 1.0 end),
      engagement_updated_at = now()
    where g.visibility = 'public';
    get diagnostics n = row_count;
  end if;
  return n;
end; $$;
grant execute on function public.recompute_engagement(text) to authenticated;

-- ============================================================
--  END BUILDER · FEATURING & ANALYTICS SPINE
-- ============================================================
