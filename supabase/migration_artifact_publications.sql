-- migration_artifact_publications.sql — B5 publish runtime storage (Sonnet
-- batch, implementing docs/adr/0006-public-artifact-runtime.md's Decisions
-- 2 and 4). Additive only — does NOT touch hq_artifact/artifact_version,
-- whose columns are B1-frozen and test-asserted exact (migration_hq_artifacts.sql).
--
-- One new table:
--   artifact_publication — the PUBLIC-FACING pointer, separate from
--   hq_artifact.current_version. One row per artifact (artifact_id unique):
--   the slug is assigned once and immutable; re-publishing UPDATES
--   version_number/is_live/published_at in place, it never mints a new slug
--   or a new row. This is deliberately a mutable pointer, same shape as
--   hq_artifact.current_version is a pointer into artifact_version — publish
--   v3, keep editing to v5, the public keeps seeing v3 until re-published.
--
-- Three RPCs:
--   hq_artifact_publish / hq_artifact_unpublish — operator-gated, same
--   discipline as every other write RPC in this project.
--   publication_by_slug — the ONE deliberate exception: granted to `anon`,
--   read-only, returns ONLY is_live publications' {kind, html, version_number}.
--   This is what the Cloudflare Worker (build-artifact-runtime) calls to
--   serve a published artifact — nothing else in this schema is reachable
--   without hq_is_operator().
--
-- Run in the ArgantaLab Supabase project (bdagdxgpnlialkppjwor).

begin;

-- ── artifact_publication ────────────────────────────────────────────────
create table if not exists public.artifact_publication (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  artifact_id     uuid not null unique references public.hq_artifact(id) on delete cascade,
  kind            text not null check (kind in ('application', 'website')),
  version_number  int not null,
  is_live         boolean not null default true,
  published_at    timestamptz not null default now(),
  published_by    uuid references auth.users(id)
);
create index if not exists artifact_publication_slug_live_idx on public.artifact_publication (slug) where is_live;
alter table public.artifact_publication enable row level security;
-- No direct select/insert policies — every write goes through the operator-
-- gated RPCs below; the one read path for anon is publication_by_slug,
-- which returns a narrow projection, never the row itself.

-- ── slug generation — lowercase, non-alnum collapsed to '-', trimmed,
-- capped at 40 chars. A reserved-word denylist keeps a slug from ever
-- shadowing a runtime route (a/, w/, api/, health checks, etc). ──────────
create or replace function public._artifact_slugify(p_text text)
returns text language sql immutable as $$
  select nullif(left(trim(both '-' from regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g')), 40), '')
$$;

create or replace function public._artifact_slug_reserved(p_slug text)
returns boolean language sql immutable as $$
  select p_slug = any(array[
    'a', 'w', 'api', 'admin', 'health', '_health', 'status',
    'assets', 'static', 'robots.txt', 'sitemap.xml', 'favicon.ico',
    'publish', 'unpublish', 'preview', 'www'
  ])
$$;

-- ── publish: assigns a slug once, reuses it forever after; pins the
-- published version independent of hq_artifact.current_version; up to 8
-- attempts to dodge a slug collision (denylist or an existing slug) by
-- appending a short random suffix. ──────────────────────────────────────
create or replace function public.hq_artifact_publish(p_artifact_id uuid, p_version_number int default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_kind text; v_title text; v_current_version int;
  v_version int := p_version_number;
  v_existing_slug text;
  v_base_slug text; v_candidate text; v_attempt int := 0;
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;

  select kind, title, current_version into v_kind, v_title, v_current_version from public.hq_artifact where id = p_artifact_id;
  if v_kind is null then raise exception 'no such artifact: %', p_artifact_id; end if;
  if v_version is null then v_version := v_current_version; end if;
  if not exists (select 1 from public.artifact_version where artifact_id = p_artifact_id and version_number = v_version) then
    raise exception 'no such version % for artifact %', v_version, p_artifact_id;
  end if;

  select slug into v_existing_slug from public.artifact_publication where artifact_id = p_artifact_id;
  if v_existing_slug is not null then
    update public.artifact_publication
    set version_number = v_version, is_live = true, published_at = now(), published_by = auth.uid()
    where artifact_id = p_artifact_id;
    return v_existing_slug;
  end if;

  v_base_slug := coalesce(public._artifact_slugify(v_title), 'app');
  v_candidate := v_base_slug;
  while public._artifact_slug_reserved(v_candidate) or exists (select 1 from public.artifact_publication where slug = v_candidate) loop
    v_attempt := v_attempt + 1;
    if v_attempt > 8 then raise exception 'could not assign a unique slug for artifact %', p_artifact_id; end if;
    v_candidate := v_base_slug || '-' || substr(md5(random()::text), 1, 5);
  end loop;

  insert into public.artifact_publication (slug, artifact_id, kind, version_number, is_live, published_by)
  values (v_candidate, p_artifact_id, v_kind, v_version, true, auth.uid());

  update public.hq_artifact set status = 'published', visibility = 'public', updated_at = now() where id = p_artifact_id;

  return v_candidate;
end $$;

-- ── unpublish: instant, reversible takedown. Never deletes the row or any
-- version history — re-publishing later reuses the same slug. ───────────
create or replace function public.hq_artifact_unpublish(p_artifact_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  update public.artifact_publication set is_live = false where artifact_id = p_artifact_id;
end $$;

-- ── read: one artifact's publication state (slug/is_live), for the
-- founder-facing UI to show "published at build.arganta.app/w/<slug>" or
-- offer to publish. Operator-gated like everything else in hq_artifact's
-- orbit — only publication_by_slug is public. ────────────────────────────
create or replace function public.hq_artifact_publication(p_artifact_id uuid)
returns setof public.artifact_publication
language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  return query select * from public.artifact_publication where artifact_id = p_artifact_id;
end $$;

-- ── the one anon-readable path: live publications only, narrow projection
-- (kind/html/version_number) — never the artifact_publication row itself,
-- never a non-live or missing slug (both return zero rows). This is what
-- the Cloudflare Worker calls with the anon key. ─────────────────────────
create or replace function public.publication_by_slug(p_slug text)
returns table(kind text, html text, version_number int)
language sql security definer set search_path = public stable as $$
  select ap.kind, av.html, ap.version_number
  from public.artifact_publication ap
  join public.artifact_version av on av.artifact_id = ap.artifact_id and av.version_number = ap.version_number
  where ap.slug = p_slug and ap.is_live
  limit 1
$$;

grant execute on function public.hq_artifact_publish(uuid, int) to authenticated;
grant execute on function public.hq_artifact_unpublish(uuid) to authenticated;
grant execute on function public.hq_artifact_publication(uuid) to authenticated;
-- The deliberate exception (ADR-0006 Decision 4): unauthenticated visitors
-- to build.arganta.app call this directly with the anon key.
grant execute on function public.publication_by_slug(text) to anon, authenticated;

commit;

-- Rollback:
--   revoke execute on function public.publication_by_slug(text) from anon, authenticated;
--   drop function if exists public.publication_by_slug(text);
--   drop function if exists public.hq_artifact_publication(uuid);
--   drop function if exists public.hq_artifact_unpublish(uuid);
--   drop function if exists public.hq_artifact_publish(uuid, int);
--   drop function if exists public._artifact_slug_reserved(text);
--   drop function if exists public._artifact_slugify(text);
--   drop table if exists public.artifact_publication;
