-- migration_core_projects.sql — C5-B3 · Drawer v2 substrate.
--
-- Adds what a Claude/ChatGPT-grade left drawer needs and migration_arganta_core.sql
-- never had: projects (grouped threads with shared standing context), plus
-- pin/rename/delete on threads.
--
-- Additive only: core_thread gains two nullable columns, so every existing RPC
-- (core_threads_recent/core_message_append/…) keeps working untouched, and the
-- app degrades honestly to a flat, unpinnable thread list until this is applied.
--
-- Run in the ArgantaLab Supabase project (bdagdxgpnlialkppjwor).
--
-- Security posture (mirrors migration_arganta_core.sql exactly): RLS enabled,
-- NO direct select/insert policies — everything through operator-gated
-- SECURITY DEFINER RPCs. hq_is_operator() already exists (schema.sql).

begin;

-- ── core_project ─────────────────────────────────────────────────────────
-- `context` is the project's standing instruction, prepended to the system
-- prompt for every thread inside it (Claude Projects' "project knowledge").
create table if not exists public.core_project (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  emoji       text,
  context     text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists core_project_updated_at_idx on public.core_project (updated_at desc);
alter table public.core_project enable row level security;

-- ── core_thread: pinning + project membership ────────────────────────────
-- on delete set null: deleting a project must never cascade away the founder's
-- conversations. They fall back to loose chats, which is recoverable; deleted
-- threads are not.
alter table public.core_thread add column if not exists pinned boolean not null default false;
alter table public.core_thread add column if not exists project_id uuid references public.core_project(id) on delete set null;
create index if not exists core_thread_project_idx on public.core_thread (project_id, updated_at desc);
create index if not exists core_thread_pinned_idx on public.core_thread (pinned, updated_at desc);

-- ── project RPCs ─────────────────────────────────────────────────────────
create or replace function public.core_project_create(p_name text, p_emoji text default null, p_context text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  insert into public.core_project (name, emoji, context, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'New project'), p_emoji, p_context, auth.uid())
  returning id into new_id;
  return new_id;
end $$;

create or replace function public.core_projects_recent(p_limit int default 50)
returns setof public.core_project
language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  return query select * from public.core_project order by updated_at desc limit least(greatest(p_limit, 1), 200);
end $$;

create or replace function public.core_project_update(p_id uuid, p_name text default null, p_emoji text default null, p_context text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  -- coalesce so a null argument means "leave alone", not "blank it out"
  update public.core_project
     set name = coalesce(nullif(trim(p_name), ''), name),
         emoji = coalesce(p_emoji, emoji),
         context = coalesce(p_context, context),
         updated_at = now()
   where id = p_id;
end $$;

create or replace function public.core_project_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  delete from public.core_project where id = p_id;  -- threads survive (FK is set null)
end $$;

-- ── thread RPCs: rename / pin / move / delete ────────────────────────────
create or replace function public.core_thread_rename(p_id uuid, p_title text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  update public.core_thread set title = coalesce(nullif(trim(p_title), ''), title) where id = p_id;
end $$;

create or replace function public.core_thread_set_pinned(p_id uuid, p_pinned boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  update public.core_thread set pinned = coalesce(p_pinned, false) where id = p_id;
end $$;

create or replace function public.core_thread_set_project(p_id uuid, p_project_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  update public.core_thread set project_id = p_project_id where id = p_id;
end $$;

-- Deletes the thread and (via core_message's on delete cascade) its messages.
-- Irreversible — the UI must confirm before calling this.
create or replace function public.core_thread_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  delete from public.core_thread where id = p_id;
end $$;

-- ── search across message CONTENT, not just titles ───────────────────────
-- The drawer's search could only filter titles before, which misses everything
-- actually said in a thread. Plain ILIKE, deliberately: memory_search already
-- covers semantic recall, and this is the literal "where did I say that word"
-- case where exact matching is what the founder wants.
create or replace function public.core_threads_search(p_query text, p_limit int default 30)
returns table (id uuid, title text, updated_at timestamptz, pinned boolean, project_id uuid, snippet text)
language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  return query
    select t.id, t.title, t.updated_at, t.pinned, t.project_id,
           (select left(m.content, 160) from public.core_message m
             where m.thread_id = t.id and m.content ilike '%' || p_query || '%'
             order by m.created_at limit 1) as snippet
      from public.core_thread t
     where t.title ilike '%' || p_query || '%'
        or exists (select 1 from public.core_message m
                    where m.thread_id = t.id and m.content ilike '%' || p_query || '%')
     order by t.updated_at desc
     limit least(greatest(p_limit, 1), 100);
end $$;

grant execute on function public.core_project_create(text, text, text) to authenticated;
grant execute on function public.core_projects_recent(int) to authenticated;
grant execute on function public.core_project_update(uuid, text, text, text) to authenticated;
grant execute on function public.core_project_delete(uuid) to authenticated;
grant execute on function public.core_thread_rename(uuid, text) to authenticated;
grant execute on function public.core_thread_set_pinned(uuid, boolean) to authenticated;
grant execute on function public.core_thread_set_project(uuid, uuid) to authenticated;
grant execute on function public.core_thread_delete(uuid) to authenticated;
grant execute on function public.core_threads_search(text, int) to authenticated;

commit;
