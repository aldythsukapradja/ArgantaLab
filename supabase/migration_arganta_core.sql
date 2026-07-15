-- migration_arganta_core.sql — Arganta Core substrate (C2, Sonnet batch).
-- Implements the C1 contract frozen in packages/agent/src/thread.js verbatim:
-- THREAD_COLUMNS/MESSAGE_COLUMNS below MUST match that file's exported column
-- lists exactly (a test in the app package asserts messageToRow() produces
-- these keys — this migration is the other half of that contract).
--
-- Three pieces:
--   1. core_thread / core_message — the conversation store.
--   2. memory_chunk — pgvector semantic memory (Vault notes + past threads),
--      embedded via Cloudflare bge-base-en-v1.5 (media-proxy kind:'embed',
--      768 dims — EMBED_DIMENSIONS in media-proxy/router.js is the source of
--      truth this migration's vector(768) column must match).
--   3. Realtime on agent_runs + media_asset + core_message — replaces Model
--      Rack's polling and lets the chat UI stream without a client subscribe
--      race (docs/media-center/Persistence-and-Provider-Strategy.md's
--      "candidate: Realtime" item).
--
-- Run in the ArgantaLab Supabase project (bdagdxgpnlialkppjwor).
--
-- Security posture (mirrors migration_agent_runs.sql): RLS enabled, NO direct
-- select/insert policies — everything through operator-gated SECURITY DEFINER
-- RPCs. hq_is_operator() already exists (schema.sql).

begin;

create extension if not exists vector;

-- ── core_thread ──────────────────────────────────────────────────────────
create table if not exists public.core_thread (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default 'New thread',
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists core_thread_updated_at_idx on public.core_thread (updated_at desc);
alter table public.core_thread enable row level security;

-- ── core_message ─────────────────────────────────────────────────────────
-- role/blocks/tool_calls mirror thread.js's MESSAGE_ROLES/BLOCK_KINDS exactly;
-- the CHECK constraint is a second, DB-level enforcement of that same freeze.
create table if not exists public.core_message (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.core_thread(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant', 'tool', 'system')),
  content     text,
  blocks      jsonb not null default '[]'::jsonb,
  tool_calls  jsonb not null default '[]'::jsonb,
  run_id      text references public.agent_runs(run_id), -- same lineage pattern as media_asset
  created_at  timestamptz not null default now()
);
create index if not exists core_message_thread_idx on public.core_message (thread_id, created_at);
create index if not exists core_message_run_id_idx on public.core_message (run_id);
alter table public.core_message enable row level security;

-- ── memory_chunk — pgvector semantic memory ─────────────────────────────
-- embedding width (768) MUST match media-proxy/router.js's EMBED_DIMENSIONS —
-- pgvector similarity ops require identical dimensions on every row.
create table if not exists public.memory_chunk (
  id          uuid primary key default gen_random_uuid(),
  source      text not null check (source in ('vault', 'thread')),
  ref         text,                          -- vault note id, or core_thread.id as text
  content     text not null,
  data_class  text not null default 'internal' check (data_class in ('public', 'internal', 'confidential', 'restricted')),
  embedding   vector(768) not null,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);
create index if not exists memory_chunk_source_idx on public.memory_chunk (source);
-- ivfflat needs rows to train well; harmless to create early, cheap at this scale.
create index if not exists memory_chunk_embedding_idx on public.memory_chunk using ivfflat (embedding vector_cosine_ops) with (lists = 100);
alter table public.memory_chunk enable row level security;
-- No direct select/insert policies on any of the three tables above —
-- deliberately forces all access through the RPCs below, same discipline as
-- agent_runs / media_asset.

-- ── threads: write ──────────────────────────────────────────────────────
create or replace function public.core_thread_create(p_title text default 'New thread')
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  insert into public.core_thread (title, created_by) values (coalesce(nullif(trim(p_title), ''), 'New thread'), auth.uid())
  returning id into new_id;
  return new_id;
end $$;

create or replace function public.core_thread_rename(p_id uuid, p_title text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  update public.core_thread set title = p_title, updated_at = now() where id = p_id;
end $$;

create or replace function public.core_thread_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  delete from public.core_thread where id = p_id; -- cascades to core_message
end $$;

-- ── threads: read ───────────────────────────────────────────────────────
create or replace function public.core_threads_recent(p_limit int default 50)
returns setof public.core_thread
language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  return query select * from public.core_thread order by updated_at desc limit least(greatest(p_limit, 1), 200);
end $$;

-- ── messages: write (also bumps the parent thread's updated_at, one call) ──
create or replace function public.core_message_append(message jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
  t_id uuid := (message->>'thread_id')::uuid;
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  insert into public.core_message (id, thread_id, role, content, blocks, tool_calls, run_id, created_at)
  values (
    coalesce((message->>'id')::uuid, gen_random_uuid()), t_id,
    message->>'role', message->>'content',
    coalesce(message->'blocks', '[]'::jsonb), coalesce(message->'tool_calls', '[]'::jsonb),
    message->>'run_id', coalesce((message->>'created_at')::timestamptz, now())
  )
  returning id into new_id;
  update public.core_thread set updated_at = now() where id = t_id;
  return new_id;
end $$;

-- ── messages: read ──────────────────────────────────────────────────────
create or replace function public.core_messages_for_thread(p_thread_id uuid, p_limit int default 200)
returns setof public.core_message
language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  return query
  select * from public.core_message where thread_id = p_thread_id
  order by created_at asc limit least(greatest(p_limit, 1), 1000);
end $$;

-- ── memory: write ───────────────────────────────────────────────────────
create or replace function public.memory_chunk_upsert(chunk jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  insert into public.memory_chunk (source, ref, content, data_class, embedding, created_by)
  values (
    chunk->>'source', chunk->>'ref', chunk->>'content',
    coalesce(chunk->>'data_class', 'internal'),
    (select array_agg(x::float4)::vector from jsonb_array_elements_text(chunk->'embedding') as x),
    auth.uid()
  )
  returning id into new_id;
  return new_id;
end $$;

-- ── memory: search — cosine nearest-neighbor, dataClass-filterable so a
-- restricted/confidential caller can be excluded at the SQL layer, not just
-- trusted to the app (defence in depth, same principle as ADR-0003) ─────────
create or replace function public.memory_search(p_embedding jsonb, p_k int default 6, p_max_data_class text default 'confidential')
returns table(id uuid, source text, ref text, content text, data_class text, similarity float)
language plpgsql security definer set search_path = public as $$
declare
  q vector(768) := (select array_agg(x::float4)::vector from jsonb_array_elements_text(p_embedding) as x);
  allowed text[] := case p_max_data_class
    when 'public' then array['public']
    when 'internal' then array['public','internal']
    when 'confidential' then array['public','internal','confidential']
    else array['public','internal','confidential','restricted']
  end;
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  return query
  select mc.id, mc.source, mc.ref, mc.content, mc.data_class, 1 - (mc.embedding <=> q) as similarity
  from public.memory_chunk mc
  where mc.data_class = any(allowed)
  order by mc.embedding <=> q
  limit least(greatest(p_k, 1), 50);
end $$;

grant execute on function public.core_thread_create(text) to authenticated;
grant execute on function public.core_thread_rename(uuid, text) to authenticated;
grant execute on function public.core_thread_delete(uuid) to authenticated;
grant execute on function public.core_threads_recent(int) to authenticated;
grant execute on function public.core_message_append(jsonb) to authenticated;
grant execute on function public.core_messages_for_thread(uuid, int) to authenticated;
grant execute on function public.memory_chunk_upsert(jsonb) to authenticated;
grant execute on function public.memory_search(jsonb, int, text) to authenticated;

-- ── Realtime — replaces Model Rack's 2s poll + gives the chat UI a live push
-- the instant a run/asset/message lands. Additive to the existing publication
-- (already carries coop_session/coop_member — untouched). ─────────────────
alter publication supabase_realtime add table public.agent_runs;
alter publication supabase_realtime add table public.media_asset;
alter publication supabase_realtime add table public.core_message;

commit;

-- Rollback:
--   alter publication supabase_realtime drop table public.agent_runs;
--   alter publication supabase_realtime drop table public.media_asset;
--   alter publication supabase_realtime drop table public.core_message;
--   drop function if exists public.memory_search(jsonb, int, text);
--   drop function if exists public.memory_chunk_upsert(jsonb);
--   drop function if exists public.core_messages_for_thread(uuid, int);
--   drop function if exists public.core_message_append(jsonb);
--   drop function if exists public.core_threads_recent(int);
--   drop function if exists public.core_thread_delete(uuid);
--   drop function if exists public.core_thread_rename(uuid, text);
--   drop function if exists public.core_thread_create(text);
--   drop table if exists public.memory_chunk;
--   drop table if exists public.core_message;
--   drop table if exists public.core_thread;
