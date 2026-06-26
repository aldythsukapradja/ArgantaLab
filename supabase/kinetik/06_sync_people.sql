-- ============================================================
--  KINETIK · SYNC PEOPLE  (run AFTER 03_member_progress.sql)
--
--  Makes the lightweight `kinetik_people` roster MIRROR the real
--  circle membership (circles.owner_id + circle_members → profiles /
--  child_profiles) instead of being a static seed. Calendar entries
--  keep referencing kinetik_people ids, so nothing about existing
--  events/routines changes — the table just stays current.
--
--  For each real member it links/refreshes a kinetik_people row
--  (adopting a matching seed row by name when possible, else inserting),
--  and marks anyone who is no longer a member as inactive (kept, so old
--  entries still resolve their name; just hidden from the live roster).
--
--  Idempotent · security definer (needs to read profiles past RLS).
--  Paste into Supabase → SQL Editor → Run.
-- ============================================================
begin;

-- A row is shown on the live roster only while active.
alter table public.kinetik_people
  add column if not exists active boolean not null default true;

create or replace function public.kinetik_sync_people(p_circle uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  m       record;
  v_name  text;
  v_kind  text;   -- 'profile' | 'child'
  v_role  text;
  v_owner uuid;
begin
  select owner_id into v_owner from public.circles where id = p_circle;

  -- caller must belong to this circle
  if not (v_owner = auth.uid()
          or exists (select 1 from public.circle_members cm
                     where cm.circle_id = p_circle and cm.member_id = auth.uid())) then
    raise exception 'not a member of this circle';
  end if;

  for m in
    select uid, crole from (
      select v_owner as uid, 'owner'::text as crole
      union
      select cm.member_id as uid, cm.role as crole
        from public.circle_members cm where cm.circle_id = p_circle
    ) s where uid is not null
  loop
    -- resolve identity from the real account (kid vs adult)
    if exists (select 1 from public.child_profiles cp where cp.id = m.uid) then
      select cp.display_name into v_name from public.child_profiles cp where cp.id = m.uid;
      v_kind := 'child';
      v_role := 'member';
    else
      select p.display_name into v_name from public.profiles p where p.id = m.uid;
      v_kind := 'profile';
      v_role := case
                  when m.uid = v_owner then 'owner'
                  when m.crole in ('coleader','member','viewer') then m.crole
                  else 'coleader'
                end;
    end if;
    v_name := coalesce(nullif(trim(v_name), ''), 'Member');

    -- 1) already linked → refresh in place
    update public.kinetik_people
       set name = v_name, role = v_role, link_kind = v_kind, active = true
       where circle_id = p_circle and link_id = m.uid;
    if found then continue; end if;

    -- 2) adopt an existing unlinked seed row with the same name
    update public.kinetik_people
       set link_id = m.uid, link_kind = v_kind, role = v_role, active = true
       where ctid = (
         select ctid from public.kinetik_people
          where circle_id = p_circle and link_id is null and lower(name) = lower(v_name)
          limit 1);
    if found then continue; end if;

    -- 3) brand-new member → insert a linked row
    insert into public.kinetik_people(id, circle_id, name, color, role, link_id, link_kind, active)
      values ('person_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 9),
              p_circle, v_name, '#94A3B8', v_role, m.uid, v_kind, true);
  end loop;

  -- hide anyone who isn't a current member (row kept so history still resolves)
  update public.kinetik_people kp
     set active = false
     where kp.circle_id = p_circle
       and (kp.link_id is null
            or (kp.link_id <> v_owner
                and not exists (select 1 from public.circle_members cm
                                where cm.circle_id = p_circle and cm.member_id = kp.link_id)));
end; $$;

grant execute on function public.kinetik_sync_people(uuid) to anon, authenticated;

commit;
