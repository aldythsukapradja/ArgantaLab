-- ============================================================
--  ARGANTALAB · CO-OP — invites auto-expire after 2 minutes
--  A hosted battle that nobody joins should not linger. coop_open now only lists
--  OPEN sessions created in the last 2 minutes, so a stale invite drops off every
--  circle member's Home banner + lobby within one poll. (Once a friend has joined
--  they're already in the battle screen, unaffected by the listing.)
--  Additive create-or-replace. Run after migration_coop.sql. Safe to re-run.
-- ============================================================
begin;

create or replace function public.coop_open(p_circle uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'kin_key', s.kin_key, 'world_key', s.world_key,
    'host', (select display_name from public.profiles where id = s.host_id),
    'members', (select count(*) from public.coop_member m where m.session_id = s.id)
  ) order by s.created_at desc), '[]'::jsonb)
  from public.coop_session s
  where s.circle_id = p_circle and s.status = 'open'
    and s.created_at > now() - interval '2 minutes'   -- ← invite TTL
    and public.is_circle_member(p_circle);
$$;
grant execute on function public.coop_open(uuid) to authenticated;

commit;
