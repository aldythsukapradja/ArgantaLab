-- SFX live usage tracker — the wire between LashiraBloom (every player's
-- client) and Circle HQ's Music Builder (reader). Unlike combat tuning /
-- audio_library (operator-only writes), THIS table is written by every
-- player's client — 15 of 38 cues (every emote) are dispatched dynamically
-- and static code analysis can never attribute their real usage, only a
-- runtime counter can. Run in the ArgantaLab Supabase project
-- (bdagdxgpnlialkppjwor) to enable live usage numbers in Music Builder.
--
-- Security posture (deliberately different from the operator-gated tables):
--   • WRITE = ANY authed-or-anon client, but CLAMPED server-side per flush so
--     a malicious client can't inflate counts arbitrarily — the RPC ignores
--     whatever number it's sent past a sane per-flush ceiling.
--   • READ = public (just aggregate play counts, no PII, no secrets).

begin;

create table if not exists public.audio_usage (
  cue         text primary key,
  play_count  bigint not null default 0,
  last_played timestamptz
);

alter table public.audio_usage enable row level security;

drop policy if exists audio_usage_read on public.audio_usage;
create policy audio_usage_read on public.audio_usage
  for select using (true);

-- Batched increment: the game accumulates play counts client-side and calls
-- this ONCE per flush interval with { cueName: count, ... } — not once per
-- play. Each per-cue delta is clamped to 500 server-side regardless of what
-- the client claims, so a single flush can't blow up a counter.
create or replace function public.sfx_log_plays(deltas jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audio_usage (cue, play_count, last_played)
  select key, least(greatest(value::int, 0), 500), now()
  from jsonb_each_text(deltas)
  where key is not null and key <> ''
  on conflict (cue) do update
    set play_count = public.audio_usage.play_count + least(greatest(excluded.play_count, 0), 500),
        last_played = now();
end $$;

-- HQ's read: every cue's aggregate as one jsonb map, so Music Builder can look
-- up any cue by name without a per-row round trip.
create or replace function public.audio_usage_active()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(cue, jsonb_build_object('play_count', play_count, 'last_played', last_played)), '{}'::jsonb)
  from public.audio_usage
$$;

grant execute on function public.sfx_log_plays(jsonb) to authenticated, anon;
grant execute on function public.audio_usage_active() to authenticated, anon;

commit;

-- Rollback:
--   drop function if exists public.sfx_log_plays(jsonb);
--   drop function if exists public.audio_usage_active();
--   drop table if exists public.audio_usage;
