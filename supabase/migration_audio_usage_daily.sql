-- Phase 4 of the audio-usage pipeline (docs/lashirabloom/music-builder-viz-buildplan.md §3/§4):
-- a DAILY rollup so Music Builder's Analytics "Plays over time" panel has real
-- history to show. `audio_usage` (migration_audio_usage.sql) only ever stores
-- a running total — it has no way to answer "how many plays yesterday vs.
-- today." This migration is additive: run migration_audio_usage.sql FIRST.
--
-- Same security posture as audio_usage: public-writable (every player's
-- client flushes counts), clamped server-side per cue per day, public read.

begin;

create table if not exists public.audio_usage_daily (
  cue   text not null,
  day   date not null default current_date,
  plays bigint not null default 0,
  primary key (cue, day)
);

alter table public.audio_usage_daily enable row level security;

drop policy if exists audio_usage_daily_read on public.audio_usage_daily;
create policy audio_usage_daily_read on public.audio_usage_daily
  for select using (true);

-- Re-defines sfx_log_plays (same signature) to ALSO upsert today's row per
-- cue, in the same batched call the game already makes every ~15s — no new
-- network traffic, just one more upsert per flush.
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

  insert into public.audio_usage_daily (cue, day, plays)
  select key, current_date, least(greatest(value::int, 0), 500)
  from jsonb_each_text(deltas)
  where key is not null and key <> ''
  on conflict (cue, day) do update
    set plays = public.audio_usage_daily.plays + least(greatest(excluded.plays, 0), 500);
end $$;

-- HQ's read: total plays per day across ALL cues for the last p_days days,
-- zero-filled for days with no plays (so the area chart doesn't have gaps).
create or replace function public.audio_usage_trend(p_days int default 30)
returns table(day date, plays bigint)
language sql stable security definer set search_path = public as $$
  select gs.day::date as day, coalesce(sum(d.plays), 0)::bigint as plays
  from generate_series(
    current_date - (greatest(1, least(p_days, 180)) - 1),
    current_date,
    interval '1 day'
  ) as gs(day)
  left join public.audio_usage_daily d on d.day = gs.day::date
  group by gs.day
  order by gs.day
$$;

grant execute on function public.sfx_log_plays(jsonb) to authenticated, anon;
grant execute on function public.audio_usage_trend(int) to authenticated, anon;

commit;

-- Rollback:
--   drop function if exists public.audio_usage_trend(int);
--   drop table if exists public.audio_usage_daily;
--   -- then re-run the sfx_log_plays definition from migration_audio_usage.sql
--   -- to drop the daily-rollup insert (or just leave it — harmless no-op if
--   -- audio_usage_daily doesn't exist would actually ERROR, so drop the
--   -- function too and recreate from migration_audio_usage.sql if rolling back).
