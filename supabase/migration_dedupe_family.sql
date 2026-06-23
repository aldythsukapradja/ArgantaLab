-- ============================================================
--  ARGANTALAB · DEDUPE FAMILY CIRCLES  (one-time cleanup)
--  The spine backfill auto-created a "My Family" circle for each parent,
--  which can collide with a family circle you already had (e.g. "Sukapradja
--  Family"). This merges all family-kind circles owned by the same person
--  into ONE (keeping the fullest/oldest), moving members across first.
--
--  PREREQUISITE: migration_spine.sql. Idempotent — after running, each
--  owner has exactly one family circle.
-- ============================================================
begin;

do $$
declare o record; keep uuid;
begin
  for o in (select owner_id from public.circles where kind = 'family'
            group by owner_id having count(*) > 1) loop
    -- keep the family circle with the most members (tie → oldest)
    select c.id into keep from public.circles c
      where c.owner_id = o.owner_id and c.kind = 'family'
      order by (select count(*) from public.circle_members m where m.circle_id = c.id) desc, c.created_at asc
      limit 1;
    -- move members from the duplicates into the kept circle
    insert into public.circle_members (circle_id, member_id, member_kind, role)
      select keep, m.member_id, m.member_kind, m.role
      from public.circle_members m
      join public.circles c on c.id = m.circle_id
      where c.owner_id = o.owner_id and c.kind = 'family' and c.id <> keep
      on conflict (circle_id, member_id) do nothing;
    -- delete the duplicate family circles (cascades their memberships)
    delete from public.circles
      where owner_id = o.owner_id and kind = 'family' and id <> keep;
  end loop;
end $$;

commit;
-- VERIFY:  select owner_id, count(*) from public.circles where kind='family' group by 1;  -- all = 1
-- ============================================================
