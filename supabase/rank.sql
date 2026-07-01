-- ============================================================
--  SEASONAL RANK  (within-circle ladder, resets every quarter)
--  100% additive. Run this whole file in the Supabase SQL editor.
--  Points are earned only from learning (client calls add_rank_points on XP);
--  standings are read per-circle via season_points(member ids).
-- ============================================================

create table if not exists public.rank_points (
  kid_id     uuid        not null references auth.users(id) on delete cascade,
  season     text        not null,
  points     int         not null default 0,
  updated_at timestamptz not null default now(),
  primary key (kid_id, season)
);

alter table public.rank_points enable row level security;

-- Standings are world-readable (a within-circle ladder shows peers' points);
-- writes only ever happen through the security-definer RPC below.
drop policy if exists rank_points_read on public.rank_points;
create policy rank_points_read on public.rank_points for select using (true);

-- current season = "YYYY-Qn" (matches seasonId() on the client)
create or replace function public.season_of(ts timestamptz default now())
returns text language sql immutable as $$
  select extract(year from ts)::int::text || '-Q' ||
         (floor((extract(month from ts)::int - 1) / 3) + 1)::int::text;
$$;

-- add points to the CALLER's current-season row (learning only)
create or replace function public.add_rank_points(p_points int)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_points is null or p_points <= 0 or auth.uid() is null then return; end if;
  insert into public.rank_points as rp (kid_id, season, points, updated_at)
  values (auth.uid(), public.season_of(), p_points, now())
  on conflict (kid_id, season)
  do update set points = rp.points + excluded.points, updated_at = now();
end;
$$;

-- points for a set of members in the current season (circle standings)
create or replace function public.season_points(p_ids uuid[])
returns table (kid_id uuid, points int)
language sql security definer set search_path = public as $$
  select u as kid_id, coalesce(rp.points, 0) as points
  from unnest(p_ids) as u
  left join public.rank_points rp on rp.kid_id = u and rp.season = public.season_of();
$$;

grant execute on function public.add_rank_points(int) to authenticated;
grant execute on function public.season_points(uuid[]) to authenticated;
grant execute on function public.season_of(timestamptz) to authenticated;
