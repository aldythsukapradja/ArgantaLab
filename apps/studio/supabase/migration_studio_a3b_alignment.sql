-- ArgantaStudio — A3b: knowledge-architecture alignment (additive)
-- Run AFTER migration_studio_a3.sql. Purely additive — existing rows stay valid.
-- Aligns studio_runs with the media-core provenance envelope + vault-style
-- entity fields, and adds the character→generation→post edge chain.

-- ─── Provenance envelope + entity fields on runs ─────────────────────────────
alter table public.studio_runs add column if not exists estimated      boolean not null default false;  -- cost is a guess (paid tiers) vs measured
alter table public.studio_runs add column if not exists checksum       text;                            -- reproducibility proof (sovereign)
alter table public.studio_runs add column if not exists correlation_id text;                            -- ties multi-step work together
alter table public.studio_runs add column if not exists tags           text[] not null default '{}';    -- deterministic-extracted tags
alter table public.studio_runs add column if not exists character_id   uuid references public.characters (id) on delete set null;
create index if not exists studio_runs_character_idx on public.studio_runs (character_id);

-- ─── Deterministic-extracted asset metadata ──────────────────────────────────
alter table public.studio_assets add column if not exists palette     jsonb;  -- dominant colors [{hex,weight}]
alter table public.studio_assets add column if not exists orientation text;   -- portrait | landscape | square

-- ─── Posts: the publish side + the edge chain (feeds C6 + the graph) ─────────
create table if not exists public.studio_posts (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid references public.studio_runs (id) on delete set null,      -- which generation
  character_id uuid references public.characters (id) on delete set null,       -- whose identity
  brand        text,
  platform     text not null,                                                   -- instagram | tiktok | youtube | ...
  format       text,                                                            -- post | story | reel | carousel | longform
  caption      text,
  status       text not null default 'draft',                                   -- draft | queued | published | failed
  external_id  text,                                                            -- Buffer/YouTube id once queued
  metrics      jsonb not null default '{}'::jsonb,                              -- analytics snapshot (C7)
  scheduled_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists studio_posts_run_idx  on public.studio_posts (run_id);
create index if not exists studio_posts_char_idx on public.studio_posts (character_id);

alter table public.studio_posts enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'studio_posts' and policyname = 'studio_posts_all') then
    create policy studio_posts_all on public.studio_posts for all using (true) with check (true);
  end if;
end $$;

-- The character→generation→post graph is DERIVED from foreign keys at read time
-- (studio_runs.character_id, studio_posts.run_id/character_id) — no edge table
-- needed. The client graph adapter builds {nodes, edges} from these.
