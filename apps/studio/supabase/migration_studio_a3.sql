-- ArgantaStudio — Batch A3 persistence layer
-- Run this once in the ArgantaLab Supabase SQL editor.
--
-- Design rules (master-plan): bytes NEVER live in Postgres. studio_assets holds
-- only metadata + a public URL (Supabase Storage / R2). studio_runs is the job
-- ledger (params, provider, cost, status). characters are Soul identities (B4).
--
-- Quota note: these three tables store rows only (a few KB each); the 100GB
-- shared quota is untouched. Media bytes go to the 'studio-assets' Storage
-- bucket (or R2), referenced by public URL.

-- ─── Runs: the job ledger ────────────────────────────────────────────────────
create table if not exists public.studio_runs (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null default 'image',      -- image | video | audio | ...
  surface      text,                                -- which studio produced it
  prompt       text,
  model        text,                                -- catalog model id
  provider     text,                                -- arganta | muapi | fal | ...
  cost_class   int  not null default 0,             -- four-tier router costClass
  cost         numeric not null default 0,
  status       text not null default 'pending',     -- pending | complete | failed
  seed         bigint,
  engine       text,                                -- comfyui | deterministic | ...
  error        text,
  params       jsonb not null default '{}'::jsonb,
  brand        text,                                -- which of the 5 brands
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists studio_runs_created_idx on public.studio_runs (created_at desc);
create index if not exists studio_runs_kind_idx    on public.studio_runs (kind);

-- ─── Assets: metadata + public URL (never bytes) ─────────────────────────────
create table if not exists public.studio_assets (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid references public.studio_runs (id) on delete cascade,
  kind        text not null default 'image',
  url         text not null,                        -- public URL in Storage / R2
  mime        text,
  width       int,
  height      int,
  bytes       bigint,                               -- size, for accounting only
  created_at  timestamptz not null default now()
);
create index if not exists studio_assets_run_idx on public.studio_assets (run_id);

-- ─── Characters: Soul identities (populated in B4) ───────────────────────────
create table if not exists public.characters (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  brand         text,
  trigger_token text,                               -- prompt token for the identity
  lora_ref      text,                               -- LoRA / IP-Adapter reference
  seed_refs     jsonb not null default '[]'::jsonb, -- seed image URLs
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- ArgantaStudio is an HQ-internal single-operator tool right now, so these
-- policies are permissive (anon full access). Tighten to authenticated /
-- per-brand ownership at Batch C9 when multi-user lands. Until then, treat the
-- anon key as a shared secret and do not expose this instance publicly.
alter table public.studio_runs   enable row level security;
alter table public.studio_assets enable row level security;
alter table public.characters    enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'studio_runs' and policyname = 'studio_runs_all') then
    create policy studio_runs_all on public.studio_runs for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'studio_assets' and policyname = 'studio_assets_all') then
    create policy studio_assets_all on public.studio_assets for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'characters' and policyname = 'characters_all') then
    create policy characters_all on public.characters for all using (true) with check (true);
  end if;
end $$;

-- ─── Storage bucket for asset bytes ──────────────────────────────────────────
-- Public bucket so generated media has a public URL that Buffer can pull (C6).
insert into storage.buckets (id, name, public)
values ('studio-assets', 'studio-assets', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'studio_assets_bucket_all') then
    create policy studio_assets_bucket_all on storage.objects for all
      using (bucket_id = 'studio-assets') with check (bucket_id = 'studio-assets');
  end if;
end $$;
