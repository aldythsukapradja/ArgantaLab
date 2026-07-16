-- ─────────────────────────────────────────────────────────────────────────
-- GB-2 · Admit 'game' as a first-class artifact kind.
--
-- @arganta/builder's ARTIFACT_KINDS grew from ('application','website') to
-- include 'game' (GB-1). Three things in the database still gate it out, and
-- each one would fail a real create_game call at INSERT time rather than
-- degrading — so all three move together, in one transaction:
--
--   1. hq_artifact.kind check constraint          → create_game insert fails
--   2. artifact_publication.kind check constraint → publish fails
--   3. _artifact_slug_reserved denylist           → a game slugged 'g' would
--      shadow the public runtime's /g/:slug route (the same reason 'a' and
--      'w' are already reserved)
--
-- Idempotent: safe to re-run. Constraint drops are IF EXISTS and the
-- re-adds are the full, widened definition — never a second overlapping
-- constraint.
--
-- Run in the Supabase SQL editor against the ArgantaLab project.
-- Pairs with: packages/builder (GB-1), apps/hq/src/builder-core/gameShell.ts,
-- workers/build-artifact-runtime (the /g/ route).
-- ─────────────────────────────────────────────────────────────────────────

begin;

-- ── 1 · hq_artifact accepts kind='game' ─────────────────────────────────
alter table public.hq_artifact
  drop constraint if exists hq_artifact_kind_check;
alter table public.hq_artifact
  add constraint hq_artifact_kind_check
  check (kind in ('application', 'website', 'game'));

-- ── 2 · artifact_publication accepts kind='game' ────────────────────────
alter table public.artifact_publication
  drop constraint if exists artifact_publication_kind_check;
alter table public.artifact_publication
  add constraint artifact_publication_kind_check
  check (kind in ('application', 'website', 'game'));

-- ── 3 · reserve 'g' so a slug can never shadow the /g/:slug route ───────
create or replace function public._artifact_slug_reserved(p_slug text)
returns boolean language sql immutable as $$
  select p_slug = any(array[
    'a', 'w', 'g', 'api', 'admin', 'health', '_health', 'status',
    'assets', 'static', 'robots.txt', 'sitemap.xml', 'favicon.ico',
    'publish', 'unpublish', 'preview', 'www'
  ])
$$;

commit;

-- ── verify ──────────────────────────────────────────────────────────────
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conname in ('hq_artifact_kind_check', 'artifact_publication_kind_check');
-- select public._artifact_slug_reserved('g');  -- expect: true

-- ── rollback (only if no game artifacts exist — the constraint re-add
-- would fail on existing rows, which is the correct, loud behaviour) ─────
-- alter table public.hq_artifact drop constraint if exists hq_artifact_kind_check;
-- alter table public.hq_artifact add constraint hq_artifact_kind_check
--   check (kind in ('application', 'website'));
