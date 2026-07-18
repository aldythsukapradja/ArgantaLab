-- Command Center heartbeat — the "last seen" signal. The Arganta Bridge upserts
-- one row per node every ~60s; HQ reads it when the bridge socket is unreachable
-- so the cockpit shows "PC last seen 09:12" instead of mystery reds.
-- Security: service-role writes; operators read. Mirrors the mission table.

create table if not exists public.heartbeat (
  node           text primary key,
  bridge_version text,
  node_version   text,
  engines        jsonb not null default '[]'::jsonb,
  services       jsonb not null default '[]'::jsonb,
  at             timestamptz not null default now()
);

alter table public.heartbeat enable row level security;

drop policy if exists heartbeat_read on public.heartbeat;
create policy heartbeat_read on public.heartbeat for select using (true);
