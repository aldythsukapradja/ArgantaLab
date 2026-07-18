-- migration_command_heartbeat.sql — the Command Center's "last seen" signal.
-- The Arganta Bridge (tools/arganta-bridge) upserts one row per node every ~60s
-- with a snapshot of local health. When the bridge socket is unreachable (PC
-- off / asleep), HQ reads this row so the cockpit shows "PC last seen 09:12"
-- instead of a wall of mystery reds.
--
-- Run in the ArgantaLab Supabase project (bdagdxgpnlialkppjwor).
--
-- Security: service-role (the local Bridge) writes; operators read. Mirrors
-- migration_missions.sql.

begin;

create table if not exists public.heartbeat (
  node           text primary key,                  -- 'laptop' | 'mini' | ...
  bridge_version text,
  node_version   text,
  engines        jsonb not null default '[]'::jsonb, -- [{id,label,ready,detail}]
  services       jsonb not null default '[]'::jsonb, -- [{id,label,up,detail}]
  at             timestamptz not null default now()
);

alter table public.heartbeat enable row level security;

-- Operators read (anon key + HQ). Service role bypasses RLS for the upsert.
drop policy if exists heartbeat_read on public.heartbeat;
create policy heartbeat_read on public.heartbeat for select using (true);

commit;

-- Rollback:
--   drop table if exists public.heartbeat;
