-- migration_media_assets.sql — persistence-first milestone (docs/media-center/
-- Persistence-and-Provider-Strategy.md). The missing link between the truthful
-- ledger (agent_runs, migration_agent_runs.sql) and REAL stored bytes: every
-- accepted generation gets a media_asset row pointing at a bucket object AND
-- back at the agent_runs row that produced it (run_id → prompt/provider/model/
-- cost lineage). Never persist only a provider's temporary URL — the bytes are
-- copied into our own bucket by the caller before this RPC is invoked.
--
-- Run in the ArgantaLab Supabase project (bdagdxgpnlialkppjwor).
--
-- Security posture (mirrors migration_agent_runs.sql / migration_video_assets.sql):
--   • Bucket is PUBLIC-READ (generated media, no secrets) so getPublicUrl works
--     without signing — same posture as video-assets/audio-library.
--   • WRITE (upload to storage, insert/update the metadata row) = operator only.
--   • media_asset has NO direct select/insert policy — everything goes through
--     the SECURITY DEFINER RPCs below, same discipline as agent_runs.

begin;

-- ── bucket ───────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('media-artifacts', 'media-artifacts', true, 26214400) -- 25MB/object (images/short audio; video later gets its own limit if needed)
on conflict (id) do nothing;

drop policy if exists media_artifacts_read on storage.objects;
create policy media_artifacts_read on storage.objects
  for select using (bucket_id = 'media-artifacts');

drop policy if exists media_artifacts_write on storage.objects;
create policy media_artifacts_write on storage.objects
  for insert with check (bucket_id = 'media-artifacts' and hq_is_operator());

drop policy if exists media_artifacts_update on storage.objects;
create policy media_artifacts_update on storage.objects
  for update using (bucket_id = 'media-artifacts' and hq_is_operator());

drop policy if exists media_artifacts_delete on storage.objects;
create policy media_artifacts_delete on storage.objects
  for delete using (bucket_id = 'media-artifacts' and hq_is_operator());

-- ── metadata table — the run_id↔asset lineage link ─────────────────────────
create table if not exists public.media_asset (
  id             uuid primary key default gen_random_uuid(),
  run_id         text references public.agent_runs(run_id), -- lineage: prompt/provider/model/cost live on agent_runs
  kind           text not null check (kind in ('image', 'tts', 'audio', 'music', 'video')),
  bucket         text not null default 'media-artifacts',
  path           text not null,
  mime           text,
  bytes          bigint,
  width          int,
  height         int,
  duration       real,
  prompt         text,
  provider       text,
  model          text,
  cost_usd       numeric(12, 6) not null default 0,
  accepted       boolean, -- null = undecided; drives cost-per-accepted-asset (Model Rack)
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

create index if not exists media_asset_run_id_idx on public.media_asset (run_id);
create index if not exists media_asset_kind_idx on public.media_asset (kind, created_at desc);
create index if not exists media_asset_created_at_idx on public.media_asset (created_at desc);
create unique index if not exists media_asset_path_idx on public.media_asset (bucket, path);

alter table public.media_asset enable row level security;
-- No direct select/insert policies — forces access through the RPCs below,
-- same discipline as agent_runs.

-- ── write: called once per SAVED artifact (after the bytes are already
-- uploaded to storage by the caller) ────────────────────────────────────────
create or replace function public.media_asset_save(asset jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  insert into public.media_asset (
    run_id, kind, bucket, path, mime, bytes, width, height, duration,
    prompt, provider, model, cost_usd, created_by
  ) values (
    asset->>'runId', asset->>'kind',
    coalesce(asset->>'bucket', 'media-artifacts'), asset->>'path',
    asset->>'mime', (asset->>'bytes')::bigint,
    (asset->>'width')::int, (asset->>'height')::int, (asset->>'duration')::real,
    asset->>'prompt', asset->>'provider', asset->>'model',
    greatest(coalesce((asset->>'costUsd')::numeric, 0), 0),
    auth.uid()
  )
  returning id into new_id;
  return new_id;
end $$;

-- ── write: accept/reject an asset (cost-per-accepted-asset metric) ─────────
create or replace function public.media_asset_set_accepted(p_id uuid, p_accepted boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  update public.media_asset set accepted = p_accepted where id = p_id;
end $$;

-- ── read: recent assets, operator-only, paged, optionally filtered by kind ──
create or replace function public.media_assets_recent(p_limit int default 50, p_kind text default null)
returns setof public.media_asset
language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  return query
  select * from public.media_asset
  where p_kind is null or kind = p_kind
  order by created_at desc
  limit least(greatest(p_limit, 1), 200);
end $$;

-- ── read: one asset by its originating run_id (Model Rack run-detail popup) ─
create or replace function public.media_asset_by_run(p_run_id text)
returns public.media_asset
language plpgsql security definer set search_path = public as $$
declare
  result public.media_asset;
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  select * into result from public.media_asset where run_id = p_run_id limit 1;
  return result;
end $$;

-- ── read: cost-per-accepted-asset, mirrors agent_runs_capo's rolling window ─
create or replace function public.media_assets_acceptance(p_days int default 30)
returns table(
  total_assets bigint, accepted_count bigint, rejected_count bigint, undecided_count bigint,
  total_cost_usd numeric, cost_per_accepted numeric
) language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  return query
  with w as (
    select * from public.media_asset
    where created_at > now() - make_interval(days => greatest(p_days, 1))
  )
  select
    count(*)::bigint,
    count(*) filter (where accepted = true)::bigint,
    count(*) filter (where accepted = false)::bigint,
    count(*) filter (where accepted is null)::bigint,
    coalesce(sum(cost_usd), 0),
    case when count(*) filter (where accepted = true) > 0
      then coalesce(sum(cost_usd), 0) / count(*) filter (where accepted = true)
      else 0 end
  from w;
end $$;

grant execute on function public.media_asset_save(jsonb) to authenticated;
grant execute on function public.media_asset_set_accepted(uuid, boolean) to authenticated;
grant execute on function public.media_assets_recent(int, text) to authenticated;
grant execute on function public.media_asset_by_run(text) to authenticated;
grant execute on function public.media_assets_acceptance(int) to authenticated;

commit;

-- Rollback:
--   drop function if exists public.media_asset_save(jsonb);
--   drop function if exists public.media_asset_set_accepted(uuid, boolean);
--   drop function if exists public.media_assets_recent(int, text);
--   drop function if exists public.media_asset_by_run(text);
--   drop function if exists public.media_assets_acceptance(int);
--   drop table if exists public.media_asset;
--   drop policy if exists media_artifacts_read on storage.objects;
--   drop policy if exists media_artifacts_write on storage.objects;
--   drop policy if exists media_artifacts_update on storage.objects;
--   drop policy if exists media_artifacts_delete on storage.objects;
--   delete from storage.buckets where id = 'media-artifacts';
