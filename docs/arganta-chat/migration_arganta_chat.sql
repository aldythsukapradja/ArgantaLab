-- Arganta Chat — thread persistence + parents-only floor (audit A4).
-- Run in Supabase SQL editor. Kids are denied at the row level so even a valid
-- kid session (synthetic @kids.argantalab.app) can never read/write chat rows.

create table if not exists arganta_chat_threads (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'New chat',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists arganta_chat_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references arganta_chat_threads(id) on delete cascade,
  owner       uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('user','assistant')),
  content     text not null default '',
  blocks      jsonb not null default '[]',
  created_at  timestamptz not null default now()
);

create index if not exists idx_act_threads_owner on arganta_chat_threads(owner, updated_at desc);
create index if not exists idx_act_messages_thread on arganta_chat_messages(thread_id, created_at);

alter table arganta_chat_threads  enable row level security;
alter table arganta_chat_messages enable row level security;

-- The parents-only floor: owner must match AND must not be a kid account.
-- auth.email() is the JWT email; kid accounts all live under the synthetic domain.
create or replace function public.is_parent() returns boolean
language sql stable as $$
  select coalesce(auth.email() not like '%@kids.argantalab.app', false)
$$;

drop policy if exists act_threads_rw on arganta_chat_threads;
create policy act_threads_rw on arganta_chat_threads
  for all using (owner = auth.uid() and public.is_parent())
  with check (owner = auth.uid() and public.is_parent());

drop policy if exists act_messages_rw on arganta_chat_messages;
create policy act_messages_rw on arganta_chat_messages
  for all using (owner = auth.uid() and public.is_parent())
  with check (owner = auth.uid() and public.is_parent());

-- keep updated_at fresh
create or replace function public.act_touch() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists act_threads_touch on arganta_chat_threads;
create trigger act_threads_touch before update on arganta_chat_threads
  for each row execute function public.act_touch();
