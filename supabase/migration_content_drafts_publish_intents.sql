-- migration_content_drafts_publish_intents.sql — Path C (Content-Workflow.md
-- §3): Claude Code attaches PUBLISH INTENTS to a draft; HQ's Drafts inbox
-- shows them and fans out to every destination with one approval click.
-- Additive only — content_draft's existing columns are untouched.
--
-- Run in the ArgantaLab Supabase project (bdagdxgpnlialkppjwor), after
-- migration_content_drafts.sql.

alter table content_draft
  add column if not exists publish_to jsonb not null default '[]'::jsonb,
  -- requested destinations, set by the MCP at draft-creation time, e.g.:
  --   [{"dest":"moment","circleId":"..."},{"dest":"buffer","channelId":"...","mode":"addToQueue"}]
  add column if not exists published_to jsonb not null default '[]'::jsonb;
  -- ACTUAL results after "Approve & publish everywhere", e.g.:
  --   [{"dest":"moment","circleId":"...","postId":"...","publishedAt":"..."},
  --    {"dest":"buffer","channelId":"...","postId":"...","mode":"addToQueue","publishedAt":"..."}]
  -- A destination with no matching entry here hasn't been published yet (or failed —
  -- failures are NOT written here; the inbox surfaces the error and lets you retry).

comment on column content_draft.publish_to is
  'Requested destinations (intents) for this draft — set at creation, read by the Drafts inbox to show intent badges.';
comment on column content_draft.published_to is
  'Actual publish results per destination, written by "Approve & publish everywhere". Never contains failures.';
