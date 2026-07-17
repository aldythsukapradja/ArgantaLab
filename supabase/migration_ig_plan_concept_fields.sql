-- migration_ig_plan_concept_fields.sql — adds the platform matrix, highlight
-- grouping and concept-board fields to ig_plan_item (migration_ig_plan.sql,
-- already run on the live project). Additive only — no existing column touched.
--
-- Run in the ArgantaLab Supabase project (bdagdxgpnlialkppjwor), AFTER
-- migration_ig_plan.sql.

alter table ig_plan_item
  add column if not exists highlight text,               -- which of the creator's 5 highlight bubbles, e.g. 'Journey'
  add column if not exists platforms text[] not null default array['ig'],  -- one master, many outlets
  add column if not exists platform_captions jsonb,       -- optional per-platform caption override, keyed by platform id
  add column if not exists is_concept boolean not null default false;      -- true = brainstorm entry, not yet scheduled

create index if not exists ig_plan_item_concept_idx on ig_plan_item (creator_id) where is_concept;
