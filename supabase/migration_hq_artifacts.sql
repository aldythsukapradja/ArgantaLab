-- migration_hq_artifacts.sql — Single-File Builder storage (B3, Sonnet batch).
-- Implements the B1 contract frozen in packages/builder/src/schema.js verbatim:
-- ARTIFACT_COLUMNS/VERSION_COLUMNS below MUST match that file's exported
-- column lists exactly (a test in that package asserts artifactToRow()/
-- versionToRow() produce these keys — this migration is the other half of
-- that contract, same discipline as migration_arganta_core.sql's C1 pairing).
--
-- Two tables:
--   1. hq_artifact     — the founder-scoped artifact (current state pointer).
--   2. artifact_version — immutable history, one row per save, run_id lineage
--      into agent_runs (same pattern as media_asset/core_message).
--
-- ADR-0005: NOT an extension of hq_app (Circle-distribution-shaped, no
-- versioning). "Export to Circle" is a later COPY into hq_app, not a shared
-- table — this migration doesn't touch hq_app at all.
--
-- Run in the ArgantaLab Supabase project (bdagdxgpnlialkppjwor).
--
-- Security posture (mirrors migration_arganta_core.sql): RLS enabled, NO
-- direct select/insert policies — everything through operator-gated
-- SECURITY DEFINER RPCs. hq_is_operator() already exists (schema.sql).

begin;

-- ── hq_artifact ──────────────────────────────────────────────────────────
create table if not exists public.hq_artifact (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('application', 'website')),
  title           text not null default 'Untitled',
  description     text,
  current_html    text not null default '',
  current_version int not null default 1,
  template_id     text,
  brand_kit_id    text,
  status          text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  visibility      text not null default 'private' check (visibility in ('private', 'circle', 'public')),
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists hq_artifact_updated_at_idx on public.hq_artifact (updated_at desc);
create index if not exists hq_artifact_created_by_idx on public.hq_artifact (created_by);
alter table public.hq_artifact enable row level security;

-- ── artifact_version — immutable; never updated or deleted by the RPCs
-- below, only inserted. restore just moves hq_artifact's current pointer. ──
create table if not exists public.artifact_version (
  id             uuid primary key default gen_random_uuid(),
  artifact_id    uuid not null references public.hq_artifact(id) on delete cascade,
  version_number int not null,
  html           text not null,
  instruction    text,                          -- the revision instruction, null for the initial version
  template_id    text,
  component_ids  text[] not null default '{}',
  provider       text,
  model          text,
  cost_usd       numeric not null default 0,
  validation     jsonb,                          -- ValidationResult snapshot (validate.js) at save time
  run_id         text references public.agent_runs(run_id),
  created_at     timestamptz not null default now(),
  unique (artifact_id, version_number)
);
create index if not exists artifact_version_artifact_idx on public.artifact_version (artifact_id, version_number desc);
alter table public.artifact_version enable row level security;
-- No direct select/insert policies — same discipline as core_thread/core_message.

-- ── create: persists a fresh draft + its version 1, atomically ────────────
create or replace function public.hq_artifact_create(
  p_kind text, p_title text, p_html text,
  p_description text default null, p_template_id text default null, p_brand_kit_id text default null,
  p_visibility text default 'private',
  p_provider text default null, p_model text default null, p_cost_usd numeric default 0,
  p_validation jsonb default null, p_run_id text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  insert into public.hq_artifact (kind, title, description, current_html, current_version, template_id, brand_kit_id, visibility, created_by)
  values (p_kind, coalesce(nullif(trim(p_title), ''), 'Untitled'), p_description, p_html, 1, p_template_id, p_brand_kit_id, p_visibility, auth.uid())
  returning id into new_id;
  insert into public.artifact_version (artifact_id, version_number, html, template_id, provider, model, cost_usd, validation, run_id)
  values (new_id, 1, p_html, p_template_id, p_provider, p_model, p_cost_usd, p_validation, p_run_id);
  return new_id;
end $$;

-- ── save a new version (revise_artifact and the plain save_version tool
-- both call this — instruction is null for a manual/non-revision save).
-- version_number is always max(existing)+1, NOT current_version+1, so a
-- restore followed by a new save can never collide with a version created
-- after the restored point. ──────────────────────────────────────────────
create or replace function public.hq_artifact_save_version(
  p_artifact_id uuid, p_html text,
  p_instruction text default null, p_template_id text default null, p_component_ids text[] default '{}',
  p_provider text default null, p_model text default null, p_cost_usd numeric default 0,
  p_validation jsonb default null, p_run_id text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid; next_version int;
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  select coalesce(max(version_number), 0) + 1 into next_version from public.artifact_version where artifact_id = p_artifact_id;
  insert into public.artifact_version (artifact_id, version_number, html, instruction, template_id, component_ids, provider, model, cost_usd, validation, run_id)
  values (p_artifact_id, next_version, p_html, p_instruction, p_template_id, p_component_ids, p_provider, p_model, p_cost_usd, p_validation, p_run_id)
  returning id into new_id;
  update public.hq_artifact set current_html = p_html, current_version = next_version, updated_at = now() where id = p_artifact_id;
  return new_id;
end $$;

-- ── restore: moves the current pointer back to an existing version's html.
-- Never deletes or rewrites version rows — the full history stays intact,
-- exactly as the tool spec promises. ──────────────────────────────────────
create or replace function public.hq_artifact_restore_version(p_artifact_id uuid, p_version_number int)
returns void language plpgsql security definer set search_path = public as $$
declare restored_html text;
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  select html into restored_html from public.artifact_version where artifact_id = p_artifact_id and version_number = p_version_number;
  if restored_html is null then raise exception 'no such version: % for artifact %', p_version_number, p_artifact_id; end if;
  update public.hq_artifact set current_html = restored_html, current_version = p_version_number, updated_at = now() where id = p_artifact_id;
end $$;

-- ── read: one artifact (revise_artifact/validate_artifact need current_html) ──
create or replace function public.hq_artifact_get(p_id uuid)
returns setof public.hq_artifact
language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  return query select * from public.hq_artifact where id = p_id;
end $$;

-- ── read: recent artifacts (gallery/rail) ──────────────────────────────────
create or replace function public.hq_artifacts_recent(p_limit int default 50)
returns setof public.hq_artifact
language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  return query select * from public.hq_artifact order by updated_at desc limit least(greatest(p_limit, 1), 200);
end $$;

-- ── read: version history for one artifact ─────────────────────────────────
create or replace function public.hq_artifact_versions(p_artifact_id uuid)
returns setof public.artifact_version
language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  return query select * from public.artifact_version where artifact_id = p_artifact_id order by version_number desc;
end $$;

grant execute on function public.hq_artifact_create(text, text, text, text, text, text, text, text, text, numeric, jsonb, text) to authenticated;
grant execute on function public.hq_artifact_save_version(uuid, text, text, text, text[], text, text, numeric, jsonb, text) to authenticated;
grant execute on function public.hq_artifact_restore_version(uuid, int) to authenticated;
grant execute on function public.hq_artifact_get(uuid) to authenticated;
grant execute on function public.hq_artifacts_recent(int) to authenticated;
grant execute on function public.hq_artifact_versions(uuid) to authenticated;

commit;

-- Rollback:
--   drop function if exists public.hq_artifact_versions(uuid);
--   drop function if exists public.hq_artifacts_recent(int);
--   drop function if exists public.hq_artifact_get(uuid);
--   drop function if exists public.hq_artifact_restore_version(uuid, int);
--   drop function if exists public.hq_artifact_save_version(uuid, text, text, text, text[], text, text, numeric, jsonb, text);
--   drop function if exists public.hq_artifact_create(text, text, text, text, text, text, text, text, text, numeric, jsonb, text);
--   drop table if exists public.artifact_version;
--   drop table if exists public.hq_artifact;
