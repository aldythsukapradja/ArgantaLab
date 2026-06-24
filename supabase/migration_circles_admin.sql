-- ============================================================
--  ARGANTALAB · CIRCLE ADMIN  (roles, create/delete, add-kid, edit-kid)
--  Standardises the role ladder and adds the management RPCs the polished
--  Members popup needs. Run LAST. Idempotent.
--
--  Role ladder:  owner > coleader > member > viewer
--    owner    — full control; the ONLY role that can delete the circle
--    coleader — same powers as owner EXCEPT delete
--    member   — participates
--    viewer   — read-only
--
--  PREREQUISITES: migration_spine.sql, migration_circle_invites.sql,
--                 migration_friends.sql.
-- ============================================================
begin;

-- migrate any legacy 'admin' rows to the new 'coleader' name
update public.circle_members set role = 'coleader' where role = 'admin';

-- ── Permission helpers (supersede earlier definitions) ──────
create or replace function public.is_circle_owner(p_circle uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.circles c where c.id = p_circle and c.owner_id = auth.uid())
      or exists(select 1 from public.circle_members m where m.circle_id = p_circle and m.member_id = auth.uid() and m.role = 'owner');
$$;
grant execute on function public.is_circle_owner(uuid) to authenticated;

create or replace function public.is_circle_admin(p_circle uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.circles c where c.id = p_circle and c.owner_id = auth.uid())
      or exists(select 1 from public.circle_members m where m.circle_id = p_circle and m.member_id = auth.uid() and m.role in ('owner','coleader'));
$$;
grant execute on function public.is_circle_admin(uuid) to authenticated;

-- ── Create a circle (caller becomes owner) ──────────────────
create or replace function public.create_circle(p_name text, p_kind text default 'friends')
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'name required'; end if;
  insert into public.circles (owner_id, name, kind, emoji, invite_code)
    values (auth.uid(), trim(p_name), coalesce(nullif(p_kind,''),'friends'),
            case coalesce(p_kind,'') when 'family' then '👨‍👩‍👧‍👦' when 'class' then '🏫' else '👥' end,
            upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)))
    returning id into cid;
  insert into public.circle_members (circle_id, member_id, member_kind, role)
    values (cid, auth.uid(), 'profile', 'owner') on conflict (circle_id, member_id) do nothing;
  return cid;
end; $$;
grant execute on function public.create_circle(text, text) to authenticated;

-- ── Delete a circle (OWNER ONLY) ────────────────────────────
create or replace function public.delete_circle(p_circle uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_circle_owner(p_circle) then raise exception 'only the owner can delete this circle'; end if;
  delete from public.circles where id = p_circle;
  return true;
end; $$;
grant execute on function public.delete_circle(uuid) to authenticated;

-- ── Assign a member's role (owner/co-leader; owner is protected) ──
create or replace function public.set_member_role(p_circle uuid, p_member uuid, p_role text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_circle_admin(p_circle) then raise exception 'only owner or co-leader can change roles'; end if;
  if p_role not in ('coleader','member','viewer') then raise exception 'invalid role'; end if;
  if exists(select 1 from public.circles c where c.id = p_circle and c.owner_id = p_member) then
    raise exception 'cannot change the owner''s role';
  end if;
  update public.circle_members set role = p_role where circle_id = p_circle and member_id = p_member;
  return found;
end; $$;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;

-- ── Add YOUR OWN child to a circle you lead (no PIN, no consent) ──
create or replace function public.add_kid_to_circle(p_circle uuid, p_kid uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_circle_admin(p_circle) then raise exception 'only owner or co-leader can add members'; end if;
  if not public.is_guardian_of(p_kid) then raise exception 'you can only add your own child'; end if;
  insert into public.circle_members (circle_id, member_id, member_kind, role)
    values (p_circle, p_kid, 'profile', 'member') on conflict (circle_id, member_id) do nothing;
  return true;
end; $$;
grant execute on function public.add_kid_to_circle(uuid, uuid) to authenticated;

-- ── Guardian edits a child's profile (name / DOB / gender) ──
create or replace function public.update_kid(p_kid uuid, p_display_name text, p_dob date, p_gender text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_guardian_of(p_kid) then raise exception 'not your child'; end if;
  if exists(select 1 from public.profiles where id = p_kid and role <> 'kid') then raise exception 'not a kid account'; end if;
  update public.profiles set
    display_name = coalesce(nullif(trim(p_display_name),''), display_name),
    dob          = coalesce(p_dob, dob),
    gender       = coalesce(nullif(p_gender,''), gender)
  where id = p_kid;
  return found;
end; $$;
grant execute on function public.update_kid(uuid, text, date, text) to authenticated;

-- ── Re-issue invite_to_circle with the new role names ───────
create or replace function public.invite_to_circle(
  p_circle uuid, p_code text, p_role text default 'member', p_as_guardian boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare invitee uuid; inv uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_circle_admin(p_circle) then raise exception 'only an owner or co-leader can invite'; end if;
  if coalesce(p_role,'member') not in ('coleader','member','viewer') then raise exception 'invalid role'; end if;
  select id into invitee from public.profiles where friend_code = upper(p_code);
  if invitee is null then raise exception 'no user with that code'; end if;
  if invitee = auth.uid() then raise exception 'cannot invite yourself'; end if;
  if exists(select 1 from public.profiles where id = invitee and role = 'kid') then
    raise exception 'that code belongs to a kid — add them from your children instead';
  end if;
  if exists(select 1 from public.circle_members where circle_id = p_circle and member_id = invitee) then
    raise exception 'already a member of this circle';
  end if;
  insert into public.circle_invites (circle_id, invited_user, invited_by, role, as_guardian)
    values (p_circle, invitee, auth.uid(), coalesce(p_role,'member'), coalesce(p_as_guardian,false))
    on conflict (circle_id, invited_user) where status = 'pending'
    do update set role = excluded.role, as_guardian = excluded.as_guardian, invited_by = excluded.invited_by
    returning id into inv;
  return inv;
end; $$;
grant execute on function public.invite_to_circle(uuid, text, text, boolean) to authenticated;

commit;
-- ============================================================
