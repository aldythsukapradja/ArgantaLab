-- ============================================================
--  LashiraBloom · Multi-Farm (My Farm / Circle Farm / Visit)
--  Additive, idempotent. Adds READ-ONLY cross-member access to a
--  circle-mate's personal farm (lashira_farm_saves) + a roster RPC for
--  the in-game Travel picker. No new storage: the circle farm
--  (circle_game_saves) and personal farm (lashira_farm_saves, already
--  keyed only by user_id — circle-independent) are unchanged.
--
--  WRITE SAFETY: save_lashira_farm_state() can only ever write
--  auth.uid()'s OWN row (see migration_lashira_farm_cloud.sql) — a
--  visitor's client is structurally incapable of writing to someone
--  else's farm even if it tried. This migration only adds READS.
--
--  Depends on: public.profiles, public.circles, public.circle_members,
--  public.is_member (migration_spine.sql), public.lashira_farm_saves
--  (migration_lashira_farm_cloud.sql).
-- ============================================================
begin;

-- True if auth.uid() and p_other are both owner-or-member of at least one
-- common circle. Used to gate read-only visits to someone's personal farm.
create or replace function public.shares_circle_with(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.circle_members me
    join public.circle_members them on them.circle_id = me.circle_id
    where me.member_id = auth.uid() and them.member_id = p_other
  )
  or exists (
    -- I own a circle p_other belongs to
    select 1 from public.circles c
    join public.circle_members them on them.circle_id = c.id
    where c.owner_id = auth.uid() and them.member_id = p_other
  )
  or exists (
    -- p_other owns a circle I belong to
    select 1 from public.circles c
    join public.circle_members me on me.circle_id = c.id
    where c.owner_id = p_other and me.member_id = auth.uid()
  );
$$;

grant execute on function public.shares_circle_with(uuid) to authenticated;

-- Roster for the in-game "Travel" picker: every member of a circle you
-- belong to (definer function so it isn't limited by circle_members' own
-- RLS, which today only lets a plain member read their OWN row).
create or replace function public.list_circle_members(p_circle uuid)
returns table (member_id uuid, display_name text, role text, member_kind text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_member(p_circle) then raise exception 'not a member of this circle'; end if;

  return query
  select cm.member_id, p.display_name, cm.role, cm.member_kind
  from public.circle_members cm
  join public.profiles p on p.id = cm.member_id
  where cm.circle_id = p_circle
  union
  select c.owner_id, p.display_name, 'owner', 'profile'
  from public.circles c
  join public.profiles p on p.id = c.owner_id
  where c.id = p_circle;
end;
$$;

grant execute on function public.list_circle_members(uuid) to authenticated;

-- Read-only load of a circle-mate's PERSONAL farm (for visiting). Returns
-- your own farm freely; anyone else's only if you share a circle with them.
-- No slot/game param beyond the defaults LashiraBloom already uses.
create or replace function public.load_member_farm_state(
  p_owner uuid,
  p_game  text default 'builtin:kinfarm',
  p_slot  text default 'default'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_data jsonb;
begin
  if auth.uid() is null then return null; end if;
  if auth.uid() <> p_owner and not public.shares_circle_with(p_owner) then
    raise exception 'not a shared-circle member';
  end if;

  select data into v_data
  from public.lashira_farm_saves
  where user_id = p_owner
    and game_id = coalesce(nullif(p_game, ''), 'builtin:kinfarm')
    and slot = coalesce(nullif(p_slot, ''), 'default');

  return v_data;
end;
$$;

grant execute on function public.load_member_farm_state(uuid, text, text) to authenticated;

commit;
