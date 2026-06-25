-- ============================================================
--  ARGANTALAB · DAILY ACTIVITY RINGS  (additive, idempotent)
--  The Home rings must answer "what did you learn TODAY" and reset every day.
--  This RPC sums today's XP PER WORLD from the immutable learn_event log, scoped
--  to the KID'S LOCAL day (the client passes its UTC offset in minutes, so the
--  window rolls at the child's local midnight — not UTC, which in Qatar/UTC+3
--  rolled at 3 AM and made yesterday's rings linger).
--
--  Read-only. Same self-or-guardian-or-admin gate as kid_world_rings. Nothing is
--  dropped; safe to re-run. Paste into Supabase → SQL Editor → Run.
-- ============================================================
begin;

create or replace function public.kid_today_rings(p_kid uuid, p_tz_offset int default 0)
returns table(world text, xp int)
language sql stable security definer set search_path = public as $$
  select world_key, coalesce(sum(xp), 0)::int
  from public.learn_event
  where user_id = p_kid
    and (p_kid = auth.uid() or public.is_guardian_of(p_kid) or public.is_admin())
    -- local-day window: local midnight, converted back to the real UTC instant
    and created_at >= date_trunc('day', now() + make_interval(mins => p_tz_offset))
                        - make_interval(mins => p_tz_offset)
  group by world_key;
$$;
grant execute on function public.kid_today_rings(uuid, int) to authenticated;

commit;
