-- ============================================================
--  ARGANTALAB · FRIENDS + SOCIAL STATS  (additive, run after spine)
--  A friendship graph on top of the spine. Friending is code-gated for
--  everyone (you can only add someone whose 6-char friend_code you have —
--  there is no open search/browse). Circle co-members are implicitly
--  friends; explicit friendships add people outside any shared circle.
--  Guardians can SEE and REMOVE a kid's friends (visibility safeguard).
--
--  PREREQUISITES: schema.sql, migration_spine.sql (is_guardian_of, circles).
--  Idempotent.
-- ============================================================
begin;

create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester    uuid not null references public.profiles(id) on delete cascade,
  addressee    uuid not null references public.profiles(id) on delete cascade,
  status       text default 'pending',     -- pending | accepted | blocked
  created_at   timestamptz default now(),
  responded_at timestamptz,
  check (requester <> addressee)
);
-- one row per pair regardless of direction
create unique index if not exists friendships_pair_uq on public.friendships
  (least(requester, addressee), greatest(requester, addressee));

alter table public.friendships enable row level security;
drop policy if exists friendships_select on public.friendships;
create policy friendships_select on public.friendships
  for select using (
    requester = auth.uid() or addressee = auth.uid()
    or exists(select 1 from public.guardianships g
              where g.guardian_id = auth.uid() and g.child_id in (requester, addressee))
  );
-- writes via the security-definer RPCs only

-- ── Send / respond ──────────────────────────────────────────
create or replace function public.send_friend_request(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare target uuid; ex record;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id into target from public.profiles where friend_code = upper(p_code);
  if target is null then raise exception 'no user with that code'; end if;
  if target = auth.uid() then raise exception 'that is your own code'; end if;
  select * into ex from public.friendships
    where least(requester,addressee) = least(auth.uid(),target)
      and greatest(requester,addressee) = greatest(auth.uid(),target);
  if ex.id is not null then return jsonb_build_object('ok', true, 'status', ex.status); end if;
  insert into public.friendships(requester, addressee, status) values (auth.uid(), target, 'pending');
  return jsonb_build_object('ok', true, 'status', 'pending');
end; $$;
grant execute on function public.send_friend_request(text) to authenticated;

create or replace function public.respond_friend_request(p_id uuid, p_accept boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from public.friendships where id = p_id and status = 'pending';
  if r is null then return false; end if;
  if r.addressee <> auth.uid() then raise exception 'not your request'; end if;
  if p_accept then
    update public.friendships set status = 'accepted', responded_at = now() where id = p_id;
  else
    delete from public.friendships where id = p_id;
  end if;
  return true;
end; $$;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

create or replace function public.remove_friend(p_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  delete from public.friendships
    where least(requester,addressee) = least(auth.uid(),p_user)
      and greatest(requester,addressee) = greatest(auth.uid(),p_user);
  return true;
end; $$;
grant execute on function public.remove_friend(uuid) to authenticated;

-- ── Read: my friends (explicit accepted ∪ circle co-members) ──
create or replace function public.my_friends()
returns table(id uuid, display_name text, photo_url text, role text, last_seen timestamptz, source text)
language sql stable security definer set search_path = public as $$
  with my_circ as (
    select c.id from public.circles c
    where c.owner_id = auth.uid()
       or exists(select 1 from public.circle_members m where m.circle_id = c.id and m.member_id = auth.uid())
  ),
  conns as (
    select distinct m.member_id as uid from public.circle_members m
      where m.circle_id in (select id from my_circ) and m.member_id <> auth.uid()
    union
    select distinct c.owner_id from public.circles c
      where c.id in (select id from my_circ) and c.owner_id <> auth.uid()
  ),
  fr as (
    select case when requester = auth.uid() then addressee else requester end as uid
    from public.friendships
    where status = 'accepted' and (requester = auth.uid() or addressee = auth.uid())
  ),
  allu as (select uid, 'circle'::text src from conns union select uid, 'friend'::text src from fr)
  select p.id, p.display_name, p.photo_url, p.role, p.last_seen, min(a.src)
  from allu a join public.profiles p on p.id = a.uid
  group by p.id, p.display_name, p.photo_url, p.role, p.last_seen
  order by p.display_name;
$$;
grant execute on function public.my_friends() to authenticated;

create or replace function public.my_friend_requests()
returns table(id uuid, from_id uuid, from_name text, from_photo text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.id, p.id, p.display_name, p.photo_url, f.created_at
  from public.friendships f join public.profiles p on p.id = f.requester
  where f.addressee = auth.uid() and f.status = 'pending'
  order by f.created_at desc;
$$;
grant execute on function public.my_friend_requests() to authenticated;

-- ── Guardian visibility of a kid's friends ──────────────────
create or replace function public.kid_friends(p_kid uuid)
returns table(id uuid, display_name text, photo_url text, status text)
language sql stable security definer set search_path = public as $$
  select case when f.requester = p_kid then a.id          else r.id          end,
         case when f.requester = p_kid then a.display_name else r.display_name end,
         case when f.requester = p_kid then a.photo_url    else r.photo_url    end,
         f.status
  from public.friendships f
  join public.profiles r on r.id = f.requester
  join public.profiles a on a.id = f.addressee
  where (f.requester = p_kid or f.addressee = p_kid)
    and (public.is_guardian_of(p_kid) or auth.uid() = p_kid)
    and f.status in ('pending','accepted');
$$;
grant execute on function public.kid_friends(uuid) to authenticated;

create or replace function public.remove_kid_friend(p_kid uuid, p_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_guardian_of(p_kid) then raise exception 'not your child'; end if;
  delete from public.friendships
    where least(requester,addressee) = least(p_kid,p_user)
      and greatest(requester,addressee) = greatest(p_kid,p_user);
  return true;
end; $$;
grant execute on function public.remove_kid_friend(uuid, uuid) to authenticated;

-- ── Social stats: circles · connections · friends ───────────
create or replace function public.social_stats(p_user uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare u uuid := coalesce(p_user, auth.uid()); r jsonb;
begin
  if u is null then return jsonb_build_object('circles',0,'connections',0,'friends',0); end if;
  if not (u = auth.uid() or public.is_guardian_of(u) or public.is_admin()) then raise exception 'not authorized'; end if;
  with my_circ as (
    select c.id from public.circles c
    where c.owner_id = u or exists(select 1 from public.circle_members m where m.circle_id = c.id and m.member_id = u)
  ),
  conns as (
    select distinct m.member_id as uid from public.circle_members m
      where m.circle_id in (select id from my_circ) and m.member_id <> u
    union
    select distinct c.owner_id from public.circles c
      where c.id in (select id from my_circ) and c.owner_id <> u
  ),
  fr as (
    select case when requester = u then addressee else requester end as uid
    from public.friendships where status = 'accepted' and (requester = u or addressee = u)
  )
  select jsonb_build_object(
    'circles',     (select count(*) from my_circ),
    'connections', (select count(*) from conns),
    'friends',     (select count(*) from (select uid from conns union select uid from fr) s)
  ) into r;
  return r;
end; $$;
grant execute on function public.social_stats(uuid) to authenticated;

-- ── Per-world ring %s for a kid (command-center cards) ──────
create or replace function public.kid_world_rings(p_kid uuid)
returns table(world text, pct int)
language sql stable security definer set search_path = public as $$
  select world_key, round(avg(mastery) * 100)::int
  from public.skill_mastery
  where user_id = p_kid
    and (p_kid = auth.uid() or public.is_guardian_of(p_kid) or public.is_admin())
  group by world_key;
$$;
grant execute on function public.kid_world_rings(uuid) to authenticated;

-- ── User directory search (for the Add-friend popup) ────────
-- Paginated, privacy-conscious: EXCLUDES the caller and ALL kid accounts
-- (minors are never browsable — they can only be added by exact friend code).
-- `rel` tells the UI whether you're already friends / have a pending request.
create or replace function public.search_users(p_q text default '', p_limit int default 8, p_offset int default 0)
returns table(id uuid, display_name text, photo_url text, friend_code text, role text, rel text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.photo_url, p.friend_code, p.role,
    case
      when exists(select 1 from public.friendships f where f.status='accepted'
                  and ((f.requester=auth.uid() and f.addressee=p.id) or (f.addressee=auth.uid() and f.requester=p.id))) then 'friend'
      when exists(select 1 from public.friendships f where f.status='pending'
                  and ((f.requester=auth.uid() and f.addressee=p.id) or (f.addressee=auth.uid() and f.requester=p.id))) then 'pending'
      else 'none'
    end as rel
  from public.profiles p
  where p.id <> auth.uid()
    and p.role <> 'kid'
    and (coalesce(p_q,'') = '' or p.display_name ilike '%'||p_q||'%' or p.friend_code ilike p_q||'%')
  order by p.display_name
  limit least(greatest(p_limit,1),25) offset greatest(p_offset,0);
$$;
grant execute on function public.search_users(text, int, int) to authenticated;

commit;
-- ============================================================
