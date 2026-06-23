-- ============================================================
--  CIRCLE HQ · FAMILY GRAPH STATS  (operator-only, read-only)
--  Gives the operator dashboard one round-trip of family-spine health
--  across ALL apps: circles by kind, membership, guardianships, and —
--  importantly — how many kids are ORPHANED (no guardian), the exact
--  condition that hides a child from the family roster/dashboard.
--
--  PREREQUISITES: schema.sql (hq_is_operator), migration_spine.sql
--    (guardianships, circle_members). Idempotent.
-- ============================================================
begin;

create or replace function public.hq_family_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.hq_is_operator() then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'circles',          (select count(*) from public.circles),
    'circlesByKind',    coalesce((select jsonb_object_agg(kind, n)
                          from (select coalesce(kind,'?') kind, count(*) n from public.circles group by 1) s), '{}'::jsonb),
    'members',          (select count(*) from public.circle_members),
    'guardianships',    (select count(*) from public.guardianships),
    'kids',             (select count(*) from public.profiles where role = 'kid'),
    'kidsLinked',       (select count(distinct child_id) from public.guardianships),
    -- a kid with NO guardianship row AND no guardian_id mirror = invisible to any family
    'kidsOrphaned',     (select count(*) from public.profiles p where p.role = 'kid'
                          and p.guardian_id is null
                          and not exists(select 1 from public.guardianships g where g.child_id = p.id)),
    'guardians',        (select count(distinct guardian_id) from public.guardianships),
    'multiGuardianKids',(select count(*) from (select child_id from public.guardianships group by child_id having count(*) > 1) s),
    'avgKidsPerGuardian',(select coalesce(round(avg(c)::numeric, 2), 0)
                          from (select count(*) c from public.guardianships group by guardian_id) s),
    'generatedAt', now()
  ) into r;
  return r;
end; $$;
grant execute on function public.hq_family_stats() to authenticated;

commit;

-- VERIFY (as an operator):  select public.hq_family_stats();
-- ============================================================
