-- migration_agent_runs.sql — WS-5 Metering & Provenance Ledger
-- (Four-Tier LLM Router, docs/media-center/Intelligence-Router.md)
--
-- The truthful record of every LLM (@arganta/ai) AND media (@arganta/media-core)
-- generation run — requested vs ACTUAL provider/model/cost, never a generic
-- label. Mirrors packages/ai/src/ledger.js's runRecord() field-for-field.
-- Powers the Sovereign Completion Rate KPI and CAPO economics (docs/media-center/Model-Rack.md).
--
-- Run in the ArgantaLab Supabase project (bdagdxgpnlialkppjwor).
--
-- Security posture (operator-only, like migration_command_graph.sql):
--   • WRITE = authenticated operator, via a SECURITY DEFINER RPC that clamps
--     every numeric field server-side (a compromised/buggy client can't corrupt
--     cost or latency stats) and is idempotent (run_id PK, ON CONFLICT DO NOTHING
--     — a retried flush can't double-count a run).
--   • READ  = operator-only, via SECURITY DEFINER RPCs. No direct table policies
--     — everything goes through the functions below.
-- HQ itself is already operator-gated (see hq_is_operator(), schema.sql), so this
-- does not open run-logging to arbitrary users.

begin;

create table if not exists public.agent_runs (
  run_id                 text primary key,
  mission_id             text,
  agent_id               text,
  domain                 text not null default 'llm' check (domain in ('llm', 'media')),
  task                   text,
  data_class             text not null default 'public' check (data_class in ('public', 'internal', 'confidential', 'restricted')),
  requested_cost_class   smallint check (requested_cost_class between 0 and 3),
  actual_cost_class      smallint check (actual_cost_class between 0 and 3),
  requested_provider     text,
  requested_model        text,
  actual_provider        text,
  actual_model           text,
  fallback_from          smallint check (fallback_from between 0 and 3),
  input_tokens           integer not null default 0,
  output_tokens          integer not null default 0,
  cached_tokens          integer not null default 0,
  latency_ms             integer not null default 0,
  cost_usd               numeric(12, 6) not null default 0,
  attempt                integer not null default 1,
  status                 text not null default 'succeeded' check (status in ('succeeded', 'failed', 'escalated', 'rejected')),
  error                  text,
  benchmark_score        numeric,
  validation_result      jsonb,
  created_by             uuid references auth.users(id),
  created_at             timestamptz not null default now()
);

create index if not exists agent_runs_created_at_idx on public.agent_runs (created_at desc);
create index if not exists agent_runs_domain_idx on public.agent_runs (domain);
create index if not exists agent_runs_cost_class_idx on public.agent_runs (actual_cost_class);

alter table public.agent_runs enable row level security;
-- No direct select/insert policies — deliberately forces all access through the
-- operator-gated SECURITY DEFINER functions below.

-- ── write: called once per run from the browser (intelligence.js / media-core) ──
create or replace function public.agent_run_log(run jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  insert into public.agent_runs (
    run_id, mission_id, agent_id, domain, task, data_class,
    requested_cost_class, actual_cost_class, requested_provider, requested_model,
    actual_provider, actual_model, fallback_from,
    input_tokens, output_tokens, cached_tokens, latency_ms, cost_usd,
    attempt, status, error, benchmark_score, validation_result, created_by
  ) values (
    run->>'runId', run->>'missionId', run->>'agentId',
    coalesce(run->>'domain', 'llm'),
    run->>'task', coalesce(run->>'dataClass', 'public'),
    (run->>'requestedCostClass')::smallint, (run->>'actualCostClass')::smallint,
    run->>'requestedProvider', run->>'requestedModel',
    run->>'actualProvider', run->>'actualModel',
    (run->>'fallbackFrom')::smallint,  -- jsonb ->> preserves a real 0 vs absent/null correctly
    greatest(coalesce((run->>'inputTokens')::int, 0), 0),
    greatest(coalesce((run->>'outputTokens')::int, 0), 0),
    greatest(coalesce((run->>'cachedTokens')::int, 0), 0),
    greatest(coalesce((run->>'latencyMs')::int, 0), 0),
    greatest(coalesce((run->>'costUsd')::numeric, 0), 0),
    greatest(coalesce((run->>'attempt')::int, 1), 1),
    coalesce(run->>'status', 'succeeded'),
    run->>'error',
    (run->>'benchmarkScore')::numeric,
    run->'validationResult',
    auth.uid()
  )
  on conflict (run_id) do nothing;
end $$;

-- ── read: recent runs, operator-only, paged ──────────────────────────────────
create or replace function public.agent_runs_recent(p_limit int default 100, p_domain text default null)
returns setof public.agent_runs
language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  return query
  select * from public.agent_runs
  where p_domain is null or domain = p_domain
  order by created_at desc
  limit least(greatest(p_limit, 1), 500);
end $$;

-- ── read: Sovereign Completion Rate + CAPO economics over a rolling window ───
create or replace function public.agent_runs_capo(p_days int default 30)
returns table(
  total_runs bigint, cost_usd numeric, cost_per_success numeric,
  sovereign_rate numeric, escalation_rate numeric, frontier_dependency numeric,
  mix_sovereign bigint, mix_sponsored bigint, mix_economy bigint, mix_frontier bigint
) language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  return query
  with w as (
    select * from public.agent_runs
    where created_at > now() - make_interval(days => greatest(p_days, 1))
      and status <> 'rejected'
  ), ok as (select * from w where status = 'succeeded')
  select
    count(*)::bigint,
    coalesce(sum(w.cost_usd), 0),
    case when (select count(*) from ok) > 0 then coalesce(sum(w.cost_usd), 0) / (select count(*) from ok) else 0 end,
    case when count(*) > 0 then count(*) filter (where w.actual_cost_class = 0)::numeric / count(*) else 0 end,
    case when count(*) > 0 then count(*) filter (where w.fallback_from is not null)::numeric / count(*) else 0 end,
    case when count(*) > 0 then count(*) filter (where w.actual_cost_class = 3)::numeric / count(*) else 0 end,
    count(*) filter (where w.actual_cost_class = 0)::bigint,
    count(*) filter (where w.actual_cost_class = 1)::bigint,
    count(*) filter (where w.actual_cost_class = 2)::bigint,
    count(*) filter (where w.actual_cost_class = 3)::bigint
  from w;
end $$;

grant execute on function public.agent_run_log(jsonb) to authenticated;
grant execute on function public.agent_runs_recent(int, text) to authenticated;
grant execute on function public.agent_runs_capo(int) to authenticated;

commit;

-- Rollback:
--   drop function if exists public.agent_run_log(jsonb);
--   drop function if exists public.agent_runs_recent(int, text);
--   drop function if exists public.agent_runs_capo(int);
--   drop table if exists public.agent_runs;
