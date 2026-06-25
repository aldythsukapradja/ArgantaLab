-- ============================================================
--  ARGANTALAB · OPENWORLD · REAL CO-OP  (additive, idempotent)
--  Two kids on two devices fight ONE shared kin. The enemy lives in a
--  coop_session row (SERVER-authoritative) and every hit goes through a
--  security-definer RPC that computes the damage — the client never sends a
--  number it could forge (canon: damage decided server-side). Supabase Realtime
--  streams coop_session + coop_member changes to both devices, so a teammate's
--  hit shows up live. Scoped to a CIRCLE (only circle members can host/join).
--  Run after the circles migrations. Safe to re-run.
-- ============================================================
begin;

-- membership helper (mirrors the inline checks in migration_circles_admin)
create or replace function public.is_circle_member(p_circle uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.circle_members m
    where m.circle_id = p_circle and m.member_id = auth.uid());
$$;
grant execute on function public.is_circle_member(uuid) to authenticated;

-- 1 · the shared battle (the enemy is here, not on any client)
create table if not exists public.coop_session (
  id            uuid primary key default gen_random_uuid(),
  circle_id     uuid not null references public.circles(id) on delete cascade,
  host_id       uuid not null references public.profiles(id) on delete cascade,
  kin_key       text not null,
  world_key     text not null,
  enemy_hp      numeric not null,
  enemy_max_hp  numeric not null,
  enemy_shield  numeric not null default 0,
  status        text not null default 'open',  -- open | won | lost
  created_at    timestamptz default now()
);
alter table public.coop_session enable row level security;
drop policy if exists coop_session_select on public.coop_session;
create policy coop_session_select on public.coop_session for select
  using (public.is_circle_member(circle_id) or host_id = auth.uid() or public.is_admin());

-- 2 · who's in the fight + their hearts
create table if not exists public.coop_member (
  session_id   uuid not null references public.coop_session(id) on delete cascade,
  person_id    uuid not null references public.profiles(id) on delete cascade,
  display_name text,
  hearts       int not null default 5,
  joined_at    timestamptz default now(),
  primary key (session_id, person_id)
);
alter table public.coop_member enable row level security;
drop policy if exists coop_member_select on public.coop_member;
create policy coop_member_select on public.coop_member for select
  using (exists (select 1 from public.coop_session s
    where s.id = coop_member.session_id
      and (public.is_circle_member(s.circle_id) or public.is_admin())));

create index if not exists coop_session_circle_idx on public.coop_session(circle_id, status);

-- helper: full session state as jsonb (session + members)
create or replace function public.coop_state(p_session uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when s.id is null then null else jsonb_build_object(
    'id', s.id, 'circle_id', s.circle_id, 'host_id', s.host_id,
    'kin_key', s.kin_key, 'world_key', s.world_key,
    'enemy_hp', s.enemy_hp, 'enemy_max_hp', s.enemy_max_hp, 'enemy_shield', s.enemy_shield,
    'status', s.status,
    'members', coalesce((select jsonb_agg(jsonb_build_object(
        'person_id', m.person_id, 'display_name', m.display_name, 'hearts', m.hearts) order by m.joined_at)
      from public.coop_member m where m.session_id = s.id), '[]'::jsonb)
  ) end
  from public.coop_session s
  where s.id = p_session
    and (public.is_circle_member(s.circle_id) or s.host_id = auth.uid() or public.is_admin());
$$;
grant execute on function public.coop_state(uuid) to authenticated;

-- 3 · HOST a battle in one of my circles
create or replace function public.coop_create(p_circle uuid, p_kin text, p_world text, p_max_hp numeric, p_shield numeric default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); sid uuid; nm text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not public.is_circle_member(p_circle) then raise exception 'not a member of this circle'; end if;
  select display_name into nm from public.profiles where id = uid;
  insert into public.coop_session (circle_id, host_id, kin_key, world_key, enemy_hp, enemy_max_hp, enemy_shield)
    values (p_circle, uid, p_kin, p_world, p_max_hp, p_max_hp, coalesce(p_shield,0))
    returning id into sid;
  insert into public.coop_member (session_id, person_id, display_name) values (sid, uid, nm);
  return public.coop_state(sid);
end; $$;
grant execute on function public.coop_create(uuid, text, text, numeric, numeric) to authenticated;

-- 4 · JOIN an open battle in my circle
create or replace function public.coop_join(p_session uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; st text; nm text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select circle_id, status into cid, st from public.coop_session where id = p_session;
  if cid is null then raise exception 'no such battle'; end if;
  if not public.is_circle_member(cid) then raise exception 'not a member of this circle'; end if;
  if st <> 'open' then raise exception 'battle already finished'; end if;
  select display_name into nm from public.profiles where id = uid;
  insert into public.coop_member (session_id, person_id, display_name) values (p_session, uid, nm)
    on conflict (session_id, person_id) do nothing;
  return public.coop_state(p_session);
end; $$;
grant execute on function public.coop_join(uuid) to authenticated;

-- 5 · ACT — server computes the result (never trusts a client-sent number)
--   p_move 'strike' (16 dmg, shield absorbs) | 'break' (drops shield)
--   p_correct false → the caller takes a hit (−1 heart); all hearts gone = lost
create or replace function public.coop_act(p_session uuid, p_move text, p_correct boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
        STRIKE int := 16; cid uuid; st text;
        hp numeric; mx numeric; sh numeric; dmg int; absorbed int; alive int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select circle_id, status, enemy_hp, enemy_max_hp, enemy_shield
    into cid, st, hp, mx, sh from public.coop_session where id = p_session for update;
  if cid is null then raise exception 'no such battle'; end if;
  if not exists (select 1 from public.coop_member where session_id = p_session and person_id = uid) then
    raise exception 'not in this battle';
  end if;
  if st <> 'open' then return public.coop_state(p_session); end if;

  if p_correct then
    if p_move = 'break' then
      sh := 0;
    else
      dmg := STRIKE;
      if sh > 0 then absorbed := least(sh, dmg); sh := sh - absorbed; dmg := dmg - absorbed; end if;
      hp := greatest(0, hp - dmg);
    end if;
    update public.coop_session set enemy_hp = hp, enemy_shield = sh,
      status = case when hp <= mx * 0.25 then 'won' else status end
      where id = p_session;
  else
    update public.coop_member set hearts = greatest(0, hearts - 1)
      where session_id = p_session and person_id = uid;
    select count(*) into alive from public.coop_member where session_id = p_session and hearts > 0;
    if alive = 0 then update public.coop_session set status = 'lost' where id = p_session; end if;
  end if;

  return public.coop_state(p_session);
end; $$;
grant execute on function public.coop_act(uuid, text, boolean) to authenticated;

-- 6 · list OPEN battles to join in a circle
create or replace function public.coop_open(p_circle uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'kin_key', s.kin_key, 'world_key', s.world_key,
    'host', (select display_name from public.profiles where id = s.host_id),
    'members', (select count(*) from public.coop_member m where m.session_id = s.id)
  ) order by s.created_at desc), '[]'::jsonb)
  from public.coop_session s
  where s.circle_id = p_circle and s.status = 'open'
    and s.created_at > now() - interval '2 minutes'   -- invites auto-expire after 2 min
    and public.is_circle_member(p_circle);
$$;
grant execute on function public.coop_open(uuid) to authenticated;

-- 7 · stream changes to both devices (Realtime). Guarded so re-runs don't error.
do $$ begin
  begin alter publication supabase_realtime add table public.coop_session; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.coop_member;  exception when duplicate_object then null; end;
end $$;

commit;
