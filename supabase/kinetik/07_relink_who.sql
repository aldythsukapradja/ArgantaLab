-- ============================================================
--  KINETIK · RELINK WHO  (run AFTER 06_sync_people.sql)
--
--  After the roster sync, some calendar entries may still reference a
--  now-INACTIVE person row (an old seed that got superseded by the live
--  member). Today/Month resolve those by name so they still show, but the
--  Board filters by the active member id, so they go missing from the
--  columns — making the three pages look out of sync.
--
--  This rewrites every kinetik_events.who / kinetik_routines.who so each id
--  points at the ACTIVE member for that person (matched by link_id, else by
--  name). One-time, idempotent. The old→new map is inlined as a CTE in each
--  statement (no temp table — the Supabase SQL editor doesn't keep one alive).
--  Paste into Supabase → SQL Editor → Run.
-- ============================================================

-- rewrite event who-arrays (preserving order; unmapped ids stay as-is)
with pmap as (
  select i.id as old_id, a.id as new_id
  from public.kinetik_people i
  join lateral (
    select a.id
    from public.kinetik_people a
    where a.active = true
      and a.circle_id = i.circle_id
      and a.id <> i.id
      and ( (i.link_id is not null and a.link_id = i.link_id)
            or lower(a.name) = lower(i.name) )
    order by (a.link_id is not distinct from i.link_id) desc
    limit 1
  ) a on true
  where i.active = false
)
update public.kinetik_events e
set who = sub.new_who
from (
  select e2.id,
         array_agg(coalesce(m.new_id, w) order by ord) as new_who
  from public.kinetik_events e2,
       unnest(e2.who) with ordinality as u(w, ord)
  left join pmap m on m.old_id = u.w
  group by e2.id
) sub
where e.id = sub.id and e.who is distinct from sub.new_who;

-- rewrite routine who-arrays
with pmap as (
  select i.id as old_id, a.id as new_id
  from public.kinetik_people i
  join lateral (
    select a.id
    from public.kinetik_people a
    where a.active = true
      and a.circle_id = i.circle_id
      and a.id <> i.id
      and ( (i.link_id is not null and a.link_id = i.link_id)
            or lower(a.name) = lower(i.name) )
    order by (a.link_id is not distinct from i.link_id) desc
    limit 1
  ) a on true
  where i.active = false
)
update public.kinetik_routines r
set who = sub.new_who
from (
  select r2.id,
         array_agg(coalesce(m.new_id, w) order by ord) as new_who
  from public.kinetik_routines r2,
       unnest(r2.who) with ordinality as u(w, ord)
  left join pmap m on m.old_id = u.w
  group by r2.id
) sub
where r.id = sub.id and r.who is distinct from sub.new_who;
