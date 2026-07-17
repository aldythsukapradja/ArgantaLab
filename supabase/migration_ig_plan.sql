-- migration_ig_plan.sql — IG Simulator plan persistence (P5).
-- The AI Influencer Studio's Instagram-mode plan rail/phone/composer read and
-- write this table so a founder's batch plan survives a browser wipe. Same
-- operator-only RLS pattern as content_draft (migration_content_drafts.sql).
--
-- Run in the ArgantaLab Supabase project (bdagdxgpnlialkppjwor).
-- Additive only — no existing table is touched.

create table if not exists ig_plan_item (
  id            text primary key,          -- client-generated (planStore's uid()), so offline items merge cleanly
  creator_id    text not null,              -- CREATORS[].id — 'arganta', 'lashira', ...
  kind          text not null,              -- 'post' | 'reel' | 'story'
  day           text not null,              -- ISO yyyy-mm-dd, plan-local date (not a timestamp — see planStore.isoDay)
  slot          text,                       -- 'morning' | 'afternoon' | 'night' — stories only
  media         text,                       -- /influencer/... path, data URL, or `pl:<id>` library ref
  look          text,                       -- 'normal' | 'formal' | 'spicy' quick-fill tag
  caption       text not null default '',
  hashtags      text not null default '',
  pillar        text,
  pinned        boolean not null default false,
  status        text not null default 'idea',   -- 'idea' | 'ready' | 'sent' | 'posted'
  sent_draft_id uuid,                       -- content_draft.id once bridged (P3); drives the posted-status readback
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists ig_plan_item_creator_idx on ig_plan_item (creator_id, day);
create index if not exists ig_plan_item_sent_draft_idx on ig_plan_item (sent_draft_id) where sent_draft_id is not null;

alter table ig_plan_item enable row level security;

drop policy if exists ig_plan_item_operator_all on ig_plan_item;
create policy ig_plan_item_operator_all on ig_plan_item
  for all using (hq_is_operator()) with check (hq_is_operator());

grant select, insert, update, delete on ig_plan_item to authenticated;
