-- ============================================================
-- Kinetik Member Progress RPC
-- Enables circle owners to read children's progress for rings
-- ============================================================

-- Add link columns to kinetik_people to connect with world_progress
alter table kinetik_people add column if not exists link_id uuid;
alter table kinetik_people add column if not exists link_kind text; -- 'user' | 'child'

-- Auto-link by name (owner -> profiles, kids -> child_profiles)
with owner_profile as (
  select id, display_name from profiles
  where id = (select owner_id from circles limit 1)
),
owner_people as (
  select id, name, circle_id from kinetik_people
  where role = 'owner'
  and circle_id = (select id from circles limit 1)
)
update kinetik_people
set link_id = (select id from owner_profile limit 1),
    link_kind = 'user'
where id in (select id from owner_people);

-- Link other members to child_profiles by name match
update kinetik_people
set link_id = (select id from child_profiles where display_name = kinetik_people.name limit 1),
    link_kind = 'child'
where link_id is null
and role != 'owner'
and exists (select 1 from child_profiles where display_name = kinetik_people.name);

-- Create SECURITY DEFINER RPC for fetching member progress
create or replace function kinetik_member_progress(p_circle uuid)
returns table (
  member_id uuid,
  ring_pct numeric,
  xp numeric,
  skills numeric,
  streak numeric,
  diamonds numeric
)
language sql
security definer
set search_path = public
as $$
  -- Only circle owner can read progress
  select
    kp.id as member_id,
    coalesce(round(avg(p.completion_pct)::numeric, 1), 0) as ring_pct,
    coalesce(sum(p.xp)::numeric, 0) as xp,
    coalesce(count(case when p.completion_pct >= 100 then 1 end)::numeric, 0) as skills,
    coalesce(max(p.streak)::numeric, 0) as streak,
    coalesce(max(p.diamonds)::numeric, 0) as diamonds
  from kinetik_people kp
  left join world_progress p on kp.link_id = p.user_id
  where kp.circle_id = p_circle
    and exists (
      select 1 from circles c
      where c.id = p_circle
      and c.owner_id = auth.uid()
    )
  group by kp.id
  order by kp.id;
$$;

-- Grant execute permission to authenticated users
grant execute on function kinetik_member_progress(uuid) to authenticated;
