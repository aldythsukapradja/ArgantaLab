-- ============================================================
--  LashiraBloom · PvP circle rank
--  Additive, idempotent. Per docs/lashirabloom/pvp-concept.md §4:
--  "Simple PVP. People enter the area, can hit each other, and it's
--  recorded in the circle rank." No cross-circle, no seasons, no Gold/
--  Diamonds/XP minted here — rank is just W/L.
--
--  Trust model (per the concept doc, matches monster-hit precedent): the
--  DOWNED player (the victim/loser of the KO) reports it. For a trusted
--  family/friend circle this is fine — the same posture as monster hits
--  today. A tamper-proof version is a drop-in later (not needed now).
-- ============================================================
begin;

create table if not exists public.pvp_rank (
  circle_id  uuid not null references public.circles(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  wins       int not null default 0,
  losses     int not null default 0,
  streak     int not null default 0,   -- positive = win streak, negative = loss streak
  updated_at timestamptz not null default now(),
  primary key (circle_id, profile_id)
);

alter table public.pvp_rank enable row level security;

-- Any circle member can see the whole board (it's a leaderboard, not a DM).
drop policy if exists pvp_rank_read on public.pvp_rank;
create policy pvp_rank_read on public.pvp_rank
  for select using (public.is_member(circle_id));

-- No direct writes — every mutation goes through pvp_record_ko() below, which
-- validates membership and touches exactly two rows (winner + the caller).
drop policy if exists pvp_rank_no_direct_write on public.pvp_rank;
create policy pvp_rank_no_direct_write on public.pvp_rank
  for all using (false) with check (false);

-- Called by the DOWNED player when they're KO'd in the PvP zone: +1 win for
-- p_winner, +1 loss for the caller (auth.uid()), one call, one trip.
create or replace function public.pvp_record_ko(
  p_circle uuid,
  p_winner uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_loser uuid := auth.uid();
begin
  if v_loser is null then raise exception 'not authenticated'; end if;
  if v_loser = p_winner then raise exception 'cannot record a KO against yourself'; end if;
  if not public.is_member(p_circle) then raise exception 'not a member of this circle'; end if;
  if not exists (
    select 1 from public.circle_members m where m.circle_id = p_circle and m.member_id = p_winner
    union
    select 1 from public.circles c where c.id = p_circle and c.owner_id = p_winner
  ) then raise exception 'winner is not a member of this circle'; end if;

  insert into public.pvp_rank(circle_id, profile_id, wins, losses, streak, updated_at)
  values (p_circle, p_winner, 1, 0, 1, now())
  on conflict (circle_id, profile_id) do update
    set wins = pvp_rank.wins + 1,
        streak = case when pvp_rank.streak >= 0 then pvp_rank.streak + 1 else 1 end,
        updated_at = now();

  insert into public.pvp_rank(circle_id, profile_id, wins, losses, streak, updated_at)
  values (p_circle, v_loser, 0, 1, -1, now())
  on conflict (circle_id, profile_id) do update
    set losses = pvp_rank.losses + 1,
        streak = case when pvp_rank.streak <= 0 then pvp_rank.streak - 1 else -1 end,
        updated_at = now();

  return true;
end;
$$;

grant execute on function public.pvp_record_ko(uuid, uuid) to authenticated;

commit;
