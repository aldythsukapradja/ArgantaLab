-- ============================================================
--  KINETIK · BROADCAST AUTOPILOT  (run AFTER 08_broadcast.sql)
--
--  Adds the columns the automated content pipeline needs so a
--  re-running LLM job is IDEMPOTENT (never double-posts) and every
--  auto-post is traceable back to its generation batch.
--
--  The Edge Function `broadcast-autopilot` inserts with the SERVICE
--  ROLE (bypasses RLS) and dedupes on `external_key`. Operator-authored
--  posts keep origin='operator'; the pipeline stamps origin='llm'.
--
--  Additive · idempotent. Paste into Supabase → SQL Editor → Run.
-- ============================================================
begin;

alter table public.kinetik_broadcast
  add column if not exists external_key   text,          -- stable dedupe key (hash of title/body)
  add column if not exists batch_id       uuid,          -- which generation run produced it
  add column if not exists origin         text not null default 'operator',  -- 'operator' | 'llm'
  add column if not exists prompt_version text;          -- which prompt template made it

-- One row per external_key → the pipeline can retry safely (insert conflicts skip).
create unique index if not exists kinetik_broadcast_extkey_idx
  on public.kinetik_broadcast(external_key) where external_key is not null;

commit;
