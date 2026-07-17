-- Bridge mission persistence (Brain OS: "missions are persistent").
-- Mirror of supabase/migration_missions.sql, staged for `supabase db push`.
create table if not exists public.mission (
  id          text primary key,
  goal        text not null,
  status      text not null default 'running',
  cwd         text,
  activity    jsonb not null default '[]'::jsonb,
  approvals   jsonb not null default '[]'::jsonb,
  result      text,
  cost_usd    numeric(12, 6) not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists mission_created_at_idx on public.mission (created_at desc);
create index if not exists mission_status_idx on public.mission (status);
alter table public.mission enable row level security;
drop policy if exists mission_read on public.mission;
create policy mission_read on public.mission for select using (true);
