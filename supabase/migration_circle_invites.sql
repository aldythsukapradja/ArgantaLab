-- ============================================================
--  ARGANTALAB · CIRCLE INVITES  (adults joining a circle)
--  Consent-based invite flow (Slack / Family-Link pattern):
--    owner/admin invites a REGISTERED ADULT by friend code →
--    invitee sees it in my_invites() → accepts → becomes a member
--    (optionally a co-guardian of the circle's kids).
--
--  Two+ adults per circle is fully supported: circle_members has no
--  single-adult constraint, and guardianships is M:N.
--
--  PREREQUISITE: migration_spine.sql (guardianships, circles, helpers).
--  Idempotent — safe to re-run.
-- ============================================================
begin;

-- ─────────────────────────────────────────────────────────────
--  Invite table — one pending invite per (circle, invitee)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.circle_invites (
  id           uuid primary key default gen_random_uuid(),
  circle_id    uuid not null references public.circles(id)  on delete cascade,
  invited_user uuid not null references public.profiles(id) on delete cascade,
  invited_by   uuid not null references public.profiles(id) on delete cascade,
  role         text default 'member',     -- admin | member | viewer
  as_guardian  boolean default false,      -- also co-guardian the circle's kids
  status       text default 'pending',     -- pending | accepted | declined | revoked
  created_at   timestamptz default now(),
  responded_at timestamptz
);
create unique index if not exists circle_invites_pending_uq
  on public.circle_invites(circle_id, invited_user) where status = 'pending';
create index if not exists circle_invites_invitee_idx on public.circle_invites(invited_user) where status = 'pending';

alter table public.circle_invites enable row level security;
drop policy if exists circle_invites_select on public.circle_invites;
create policy circle_invites_select on public.circle_invites
  for select using (
    invited_user = auth.uid()
    or invited_by = auth.uid()
    or exists (select 1 from public.circles c where c.id = circle_id and c.owner_id = auth.uid())
  );
-- all writes go through the security-definer RPCs below

-- ─────────────────────────────────────────────────────────────
--  Helper: is the caller an owner/admin of this circle?
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_circle_admin(p_circle uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.circles c where c.id = p_circle and c.owner_id = auth.uid())
      or exists(select 1 from public.circle_members m
                where m.circle_id = p_circle and m.member_id = auth.uid() and m.role in ('owner','admin'));
$$;
grant execute on function public.is_circle_admin(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
--  Invite a REGISTERED ADULT (by friend code) to a circle
-- ─────────────────────────────────────────────────────────────
create or replace function public.invite_to_circle(
  p_circle uuid, p_code text, p_role text default 'member', p_as_guardian boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare invitee uuid; inv uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_circle_admin(p_circle) then raise exception 'only an owner or admin can invite'; end if;
  if coalesce(p_role,'member') not in ('admin','member','viewer') then raise exception 'invalid role'; end if;

  select id into invitee from public.profiles where friend_code = upper(p_code);
  if invitee is null then raise exception 'no user with that code'; end if;
  if invitee = auth.uid() then raise exception 'cannot invite yourself'; end if;
  if exists(select 1 from public.profiles where id = invitee and role = 'kid') then
    raise exception 'that code belongs to a kid — use Link kid instead';
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

-- ─────────────────────────────────────────────────────────────
--  Invitee responds — accept (join + optional co-guardian) or decline
-- ─────────────────────────────────────────────────────────────
create or replace function public.respond_to_invite(p_invite uuid, p_accept boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare r record; kid uuid; is_family boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into r from public.circle_invites where id = p_invite and status = 'pending';
  if r is null then return false; end if;
  if r.invited_user <> auth.uid() then raise exception 'not your invite'; end if;

  if p_accept then
    insert into public.circle_members (circle_id, member_id, member_kind, role)
      values (r.circle_id, r.invited_user, 'profile', r.role)
      on conflict (circle_id, member_id) do update set role = excluded.role;

    if r.as_guardian then
      select (kind = 'family') into is_family from public.circles where id = r.circle_id;
      if coalesce(is_family, false) then
        -- become a co-guardian of every kid currently in this circle
        for kid in (select p.id from public.circle_members m
                    join public.profiles p on p.id = m.member_id
                    where m.circle_id = r.circle_id and p.role = 'kid') loop
          insert into public.guardianships (guardian_id, child_id)
            values (r.invited_user, kid) on conflict do nothing;
        end loop;
      end if;
    end if;
    update public.circle_invites set status = 'accepted', responded_at = now() where id = p_invite;
  else
    update public.circle_invites set status = 'declined', responded_at = now() where id = p_invite;
  end if;
  return true;
end; $$;
grant execute on function public.respond_to_invite(uuid, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────
--  Pending invites for the caller (to render an inbox)
-- ─────────────────────────────────────────────────────────────
create or replace function public.my_invites()
returns table(id uuid, circle_id uuid, circle_name text, circle_kind text,
              role text, as_guardian boolean, invited_by_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, i.circle_id, c.name, c.kind, i.role, i.as_guardian, p.display_name, i.created_at
  from public.circle_invites i
  join public.circles c  on c.id = i.circle_id
  join public.profiles p on p.id = i.invited_by
  where i.invited_user = auth.uid() and i.status = 'pending'
  order by i.created_at desc;
$$;
grant execute on function public.my_invites() to authenticated;

-- inviter or circle owner/admin revokes a pending invite
create or replace function public.revoke_invite(p_invite uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from public.circle_invites where id = p_invite and status = 'pending';
  if r is null then return false; end if;
  if not (r.invited_by = auth.uid() or public.is_circle_admin(r.circle_id)) then
    raise exception 'not allowed';
  end if;
  update public.circle_invites set status = 'revoked', responded_at = now() where id = p_invite;
  return true;
end; $$;
grant execute on function public.revoke_invite(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
--  Membership management — leave / remove (owner cannot be removed)
-- ─────────────────────────────────────────────────────────────
create or replace function public.leave_circle(p_circle uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if exists(select 1 from public.circles where id = p_circle and owner_id = auth.uid()) then
    raise exception 'the owner cannot leave their own circle';
  end if;
  delete from public.circle_members where circle_id = p_circle and member_id = auth.uid();
  return true;
end; $$;
grant execute on function public.leave_circle(uuid) to authenticated;

create or replace function public.remove_circle_member(p_circle uuid, p_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_circle_admin(p_circle) then raise exception 'only an owner or admin can remove members'; end if;
  if exists(select 1 from public.circles where id = p_circle and owner_id = p_user) then
    raise exception 'cannot remove the circle owner';
  end if;
  delete from public.circle_members where circle_id = p_circle and member_id = p_user;
  return true;
end; $$;
grant execute on function public.remove_circle_member(uuid, uuid) to authenticated;

commit;

-- ═════════════════════════════════════════════════════════════
--  VERIFICATION (run as the relevant user, or via the app):
--   select public.invite_to_circle('<circle>','<ADULTCODE>','admin',true);
--   select * from public.my_invites();                      -- as invitee
--   select public.respond_to_invite('<invite>', true);      -- as invitee
--   select * from public.circle_roster('<circle>');         -- now includes the adult
--   select * from public.my_children();                     -- co-guardian now sees kids
-- ============================================================
