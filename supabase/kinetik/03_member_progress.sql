-- ============================================================
--  KINETIK · MEMBER PROGRESS  (run AFTER 01_schema.sql + 02_seed.sql)
--
--  Connects each circle member (kinetik_people) to their real
--  learning progress in the ArgantaLab `world_progress` table, and
--  exposes it through ONE security-definer function so the parent
--  can read the whole circle's progress without weakening the
--  per-user RLS on world_progress.
--
--  Idempotent. Safe to re-run.
-- ============================================================

-- ── 1. Link columns on kinetik_people ─────────────────────────
-- link_id points at either a profiles.id (parent/adult) or a
-- child_profiles.id (kid). link_kind records which.
alter table public.kinetik_people add column if not exists link_id   uuid;
alter table public.kinetik_people add column if not exists link_kind text;  -- 'profile' | 'child'

-- ── 2. Auto-link by email + name (no manual UUID needed) ───────
-- Owner / co-leader (adults) → their own profiles row, matched by name
-- against the parent's account. Adjust the email if needed.
update public.kinetik_people kp
set link_id = p.id, link_kind = 'profile'
from public.profiles p
where p.email = 'aldhyt.sukapradja@gmail.com'
  and lower(p.display_name) like '%' || lower(kp.name) || '%'
  and kp.link_id is null;

-- Always link the circle OWNER to the signed-in parent account.
update public.kinetik_people kp
set link_id = p.id, link_kind = 'profile'
from public.profiles p, public.circles c
where p.email = 'aldhyt.sukapradja@gmail.com'
  and c.owner_id = p.id
  and kp.circle_id = c.id
  and kp.role = 'owner';

-- Kids → child_profiles, matched by display name within this parent.
update public.kinetik_people kp
set link_id = cp.id, link_kind = 'child'
from public.child_profiles cp
join public.profiles p on p.id = cp.parent_id
where p.email = 'aldhyt.sukapradja@gmail.com'
  and lower(cp.display_name) = lower(kp.name)
  and kp.link_id is null;

-- ── 3. Progress function (SECURITY DEFINER) ───────────────────
-- Returns one row per member of the circle, aggregating their
-- world_progress. Only the circle OWNER can read it, so kid
-- progress stays private to the family.
create or replace function public.kinetik_member_progress(p_circle uuid)
returns table (
  member_id text,
  ring_pct  numeric,
  xp        int,
  skills    int,
  streak    int,
  diamonds  int
)
language sql
security definer
set search_path = public
stable
as $$
  select
    kp.id                                   as member_id,
    coalesce(round(avg(wp.ring_pct)), 0)    as ring_pct,
    coalesce(sum(wp.xp), 0)::int            as xp,
    coalesce(sum(wp.skills_mastered), 0)::int as skills,
    coalesce(max(wp.streak), 0)::int        as streak,
    coalesce(max(pr.diamonds), 0)::int      as diamonds
  from public.kinetik_people kp
  left join public.world_progress wp on wp.user_id = kp.link_id
  left join public.profiles      pr on pr.id       = kp.link_id
  where kp.circle_id = p_circle
    and exists (
      select 1 from public.circles c
      where c.id = p_circle and c.owner_id = auth.uid()
    )
  group by kp.id;
$$;

grant execute on function public.kinetik_member_progress(uuid) to anon, authenticated;
