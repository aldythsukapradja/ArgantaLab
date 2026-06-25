-- ============================================================
--  ARGANTALAB · NEXUS  (befriended kin + gentle care) — additive migration
--  Paste into Supabase → SQL Editor → Run. Idempotent (re-runnable).
--  Builds on schema.sql / migration_analytics_rewards.sql — reuses public.profiles.
--    1. person_creatures — one row per befriended kin (the Nexus roster)
--    2. RPCs: befriend_kin (the in-game capture writer),
--             nexus_roster (self or guardian read),
--             care_kin     (feed/pet → happiness, gentle cooldown)
--  Nothing existing is dropped. All WRITES go through security-definer RPCs so
--  the server is authoritative: the client may ASK to befriend, it can never
--  forge a kin's stats. Capture seals are play-earned — there is NO diamond
--  path into this table, so the town can never be bought (no pay-to-win).
-- ============================================================
begin;

-- ─────────────────────────────────────────────────────────────
--  1 · ROSTER — befriended kin instances
--  Content-as-data: kin_key points at the data catalog ('kin:countfox') with NO
--  FK, so befriending can never fail because a catalog row was renamed/removed.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.person_creatures (
  id            bigint generated always as identity primary key,
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  kin_key       text not null,                              -- 'kin:countfox'
  world_key     text,                                       -- 'num' | 'wrd' | ...
  nickname      text,
  happiness     int  not null default 60 check (happiness between 0 and 100),
  growth        text not null default 'baby' check (growth in ('baby','teen','adult')),
  last_cared    timestamptz,
  befriended_at timestamptz not null default now()
);
create index if not exists person_creatures_owner_idx on public.person_creatures(owner_id, befriended_at);

alter table public.person_creatures enable row level security;
-- a learner reads their own town; a guardian may READ their kid's town.
-- No write policy → every mutation flows through the RPCs below.
drop policy if exists person_creatures_select on public.person_creatures;
create policy person_creatures_select on public.person_creatures
  for select using (
    auth.uid() = owner_id
    or exists (select 1 from public.profiles k where k.id = person_creatures.owner_id and k.guardian_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
--  2 · BEFRIEND — the in-game capture writer
--  auth.uid() (the kid playing) befriends a kin. Server-authoritative: the row's
--  starting stats are set HERE, never trusted from the client. Called only on a
--  real in-game Friendship-Window success (capture seals are play-earned).
-- ─────────────────────────────────────────────────────────────
create or replace function public.befriend_kin(
  p_kin_key text, p_world text default null, p_nickname text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); new_id bigint;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_kin_key is null or length(p_kin_key) = 0 then raise exception 'kin required'; end if;
  insert into public.person_creatures(owner_id, kin_key, world_key, nickname)
    values (uid, p_kin_key, p_world, nullif(p_nickname, ''))
    returning id into new_id;
  return (select to_jsonb(c) from public.person_creatures c where c.id = new_id);
end; $$;
grant execute on function public.befriend_kin(text,text,text) to authenticated;

-- ─────────────────────────────────────────────────────────────
--  3 · ROSTER READ — caller's town, or a guardian reading their kid's
-- ─────────────────────────────────────────────────────────────
create or replace function public.nexus_roster(p_person uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); who uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  who := coalesce(p_person, uid);
  if not (who = uid or exists(select 1 from public.profiles k where k.id = who and k.guardian_id = uid)) then
    raise exception 'not authorized';
  end if;
  return coalesce((select jsonb_agg(to_jsonb(c) order by c.befriended_at)
                   from public.person_creatures c where c.owner_id = who), '[]'::jsonb);
end; $$;
grant execute on function public.nexus_roster(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
--  4 · CARE — feed/pet nudges happiness, on a gentle cooldown
--  Happiness comes from care + play, never an idle printer: caring more than
--  once every ~20 min is a no-op. Growth (baby→teen→adult) follows happiness, so
--  a thriving town still traces back to a child showing up. Future harvest (Phase
--  E) will read happiness, keeping diamonds tied to engagement.
-- ─────────────────────────────────────────────────────────────
create or replace function public.care_kin(p_id bigint, p_action text default 'pet')
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); rec public.person_creatures; bump int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into rec from public.person_creatures where id = p_id for update;
  if not found then raise exception 'no such kin'; end if;
  if rec.owner_id <> uid then raise exception 'not your kin'; end if;
  -- gentle cooldown: extra care inside the window changes nothing
  if rec.last_cared is not null and rec.last_cared > now() - interval '20 minutes' then
    return jsonb_build_object('ok', true, 'cooled', true, 'kin', to_jsonb(rec));
  end if;
  bump := case when p_action = 'feed' then 12 else 8 end;
  update public.person_creatures
     set happiness  = least(100, happiness + bump),
         last_cared = now(),
         growth     = case
           when happiness + bump >= 100 and growth = 'teen' then 'adult'
           when happiness + bump >= 80  and growth = 'baby' then 'teen'
           else growth end
   where id = p_id
   returning * into rec;
  return jsonb_build_object('ok', true, 'cooled', false, 'kin', to_jsonb(rec));
end; $$;
grant execute on function public.care_kin(bigint,text) to authenticated;

commit;
