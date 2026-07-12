-- ============================================================
--  migration_item_bloom.sql
--  Adds an optional per-item Bloom override to public.items.
--
--  WHY: the "Depth of thinking" chart derives each answer's Bloom level from
--  the interaction TYPE (mcq/type/cloze → 'understand'), which caps any
--  multiple-choice reasoning question at Understand no matter how demanding it
--  actually is. This nullable column lets an author mark a specific item's true
--  cognitive level; when null, the app falls back to the type default exactly
--  as before, so existing rows are unaffected.
--
--  SAFETY: purely additive, nullable, no default backfill, no RLS change.
--  Run once in the Supabase SQL editor. Idempotent.
-- ============================================================

alter table public.items
  add column if not exists bloom text;   -- 'remember'|'understand'|'apply'|'analyze'|'create' | null

comment on column public.items.bloom is
  'Optional Bloom override; null = derive from interaction_type (see lib/taxonomy.ts bloomFor).';
