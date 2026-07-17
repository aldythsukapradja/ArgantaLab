-- migration_missions.sql — persistent record of every Bridge mission (Brain OS:
-- "missions are persistent"). The Arganta Bridge (tools/arganta-bridge) writes a
-- row when a mission starts and updates it as the activity feed streams, so HQ
-- can list/resume/inspect runs across sessions and browsers.
--
-- Run in the ArgantaLab Supabase project (bdagdxgpnlialkppjwor).
--
-- Security: service-role (the local Bridge) writes; operators read. Mirrors the
-- discipline of migration_media_assets.sql.

begin;

create table if not exists public.mission (
  id          text primary key,                 -- missionId from the Bridge
  goal        text not null,                     -- the prompt
  status      text not null default 'running',   -- running | done | failed
  cwd         text,
  activity    jsonb not null default '[]'::jsonb, -- normalized activity-feed events
  approvals   jsonb not null default '[]'::jsonb, -- {tool,label,decision,at}
  result      text,
  cost_usd    numeric(12, 6) not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists mission_created_at_idx on public.mission (created_at desc);
create index if not exists mission_status_idx on public.mission (status);

alter table public.mission enable row level security;

-- Operators read (anon key + HQ). Service role bypasses RLS for writes.
drop policy if exists mission_read on public.mission;
create policy mission_read on public.mission for select using (true);

commit;

-- Rollback:
--   drop table if exists public.mission;
