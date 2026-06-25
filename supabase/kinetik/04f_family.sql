-- ============================================================
--  KINETIK · FAMILY ROSTER  — resolve every circle member's name
--  Co-leaders' profiles are blocked by per-row RLS, so the Me page
--  showed "Member". This security-definer RPC returns the full roster
--  (owner + co-leaders + kids) with names resolved, for any member.
--  Idempotent.
-- ============================================================
begin;

create or replace function public.kinetik_family(p_circle uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with ids as (
    select c.owner_id as id from public.circles c where c.id = p_circle and c.owner_id is not null
    union
    select m.member_id from public.circle_members m where m.circle_id = p_circle and m.member_id is not null
  ),
  o as (select owner_id oid from public.circles where id = p_circle),
  rows as (
    select
      i.id,
      coalesce(p.display_name, cp.display_name, 'Member') as name,
      p.photo_url as photo,
      coalesce(p.role, case when cp.id is not null then 'kid' end) as prole,
      coalesce(p.username, cp.username) as username,
      p.dob, cp.color, cp.emoji, cp.age,
      case when i.id = (select oid from o) then 'owner'
           else coalesce((select role from public.circle_members m
                          where m.circle_id = p_circle and m.member_id = i.id limit 1), 'member') end as crole,
      case when i.id = (select oid from o) then 0
           when coalesce(p.role, case when cp.id is not null then 'kid' end) = 'kid' then 2 else 1 end as ord
    from ids i
    left join public.profiles p on p.id = i.id
    left join public.child_profiles cp on cp.id = i.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'name', r.name, 'photo', r.photo, 'role', r.prole, 'crole', r.crole,
    'username', r.username, 'dob', r.dob, 'color', r.color, 'emoji', r.emoji, 'age', r.age
  ) order by r.ord, r.name), '[]'::jsonb)
  from rows r
  where public.kinetik_is_member(p_circle);
$$;
grant execute on function public.kinetik_family(uuid) to authenticated;

commit;
