-- ============================================================
--  ARGANTALAB · CANONICAL SPINE  (Phase 1 schema + Phase 2 backfill)
--  The single source of truth for IDENTITY · CIRCLES · FAMILY · WALLET
--  shared by ArgantaLab, KinetikCircle, Circle HQ and any future app.
--
--  Model (proven multi-tenant + Family-Link + server-wallet pattern):
--    profiles      = one row per human (1:1 auth.users)            ← the spine
--    circles       = a group (family|class|friends|…) owned by a profile
--    circle_members= (circle × profile × role)  owner|admin|member|viewer
--    guardianships = adult ↔ child link, M:N (a child may have 2 parents)
--    diamond_ledger= immutable double-entry wallet; profiles.diamonds cached
--
--  PRINCIPLE: the database is the only source of truth. Balances and
--  memberships NEVER live in the client; every mutation is an RPC with
--  RLS guardrails.
--
--  PREREQUISITES (run first, in this order):
--    1) schema.sql   2) migration_analytics_rewards.sql   3) migration_auth_fix.sql
--  This file is idempotent — safe to re-run.
-- ============================================================
begin;

-- ─────────────────────────────────────────────────────────────
--  1 · GUARDIANSHIPS — the canonical parent ↔ child link (M:N)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.guardianships (
  guardian_id uuid not null references public.profiles(id) on delete cascade,
  child_id    uuid not null references public.profiles(id) on delete cascade,
  relation    text default 'parent',          -- parent | carer | teacher
  created_at  timestamptz default now(),
  primary key (guardian_id, child_id)
);
create index if not exists guardianships_child_idx on public.guardianships(child_id);

alter table public.guardianships enable row level security;
-- guardian or the child may SEE the link; all WRITES go through definer RPCs
drop policy if exists guardianships_select on public.guardianships;
create policy guardianships_select on public.guardianships
  for select using (auth.uid() = guardian_id or auth.uid() = child_id);

-- ─────────────────────────────────────────────────────────────
--  2 · RLS HELPER FUNCTIONS (membership / guardianship gates)
--  (public.is_admin() already exists from schema.sql)
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_guardian_of(p_child uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.guardianships g
                where g.child_id = p_child and g.guardian_id = auth.uid())
      or exists(select 1 from public.profiles p
                where p.id = p_child and p.guardian_id = auth.uid());
$$;
grant execute on function public.is_guardian_of(uuid) to authenticated;

create or replace function public.is_member(p_circle uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.circles c where c.id = p_circle and c.owner_id = auth.uid())
      or exists(select 1 from public.circle_members m where m.circle_id = p_circle and m.member_id = auth.uid());
$$;
grant execute on function public.is_member(uuid) to authenticated;

-- a second guardian (M:N) can read their child's profile row directly
drop policy if exists profiles_select_guardianship on public.profiles;
create policy profiles_select_guardianship on public.profiles
  for select using (
    exists(select 1 from public.guardianships g where g.child_id = profiles.id and g.guardian_id = auth.uid())
  );

-- members may read their own membership rows / a member can read a circle's roster
drop policy if exists circle_members_read on public.circle_members;
create policy circle_members_read on public.circle_members
  for select using (
    member_id = auth.uid()
    or exists(select 1 from public.circles c where c.id = circle_id and c.owner_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
--  3 · FAMILY GRAPH HELPERS (find/create circle, link a child)
--  Definer functions so the new-user trigger & link RPCs can build
--  the graph regardless of who is calling.
-- ─────────────────────────────────────────────────────────────
-- Ensure columns this migration reads exist even if the KinetikCircle
-- schema (which adds circles.accent) hasn't been applied. Self-contained.
alter table public.circles        add column if not exists accent text default '#6366f1';
alter table public.circle_members add column if not exists member_kind text default 'profile';
alter table public.circle_members add column if not exists role        text default 'member';

create or replace function public.ensure_family_circle(p_parent uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select id into cid from public.circles
    where owner_id = p_parent and kind = 'family' order by created_at limit 1;
  if cid is null then
    insert into public.circles (owner_id, name, kind, emoji, invite_code)
      values (p_parent, 'My Family', 'family', '👨‍👩‍👧‍👦',
              upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)))
      returning id into cid;
    insert into public.circle_members (circle_id, member_id, member_kind, role)
      values (cid, p_parent, 'profile', 'owner')
      on conflict (circle_id, member_id) do update set role = 'owner', member_kind = 'profile';
  end if;
  return cid;
end; $$;

create or replace function public.link_child(p_parent uuid, p_child uuid)
returns void language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if p_parent is null or p_child is null or p_parent = p_child then return; end if;
  insert into public.guardianships (guardian_id, child_id)
    values (p_parent, p_child) on conflict do nothing;
  -- keep profiles.guardian_id as a denormalised "primary guardian" mirror
  update public.profiles set guardian_id = p_parent where id = p_child and guardian_id is null;
  cid := public.ensure_family_circle(p_parent);
  insert into public.circle_members (circle_id, member_id, member_kind, role)
    values (cid, p_child, 'profile', 'member')
    on conflict (circle_id, member_id) do nothing;
end; $$;

-- ─────────────────────────────────────────────────────────────
--  4 · IDENTITY WRITERS — new-user trigger + link/adopt/unlink
--  Redefined to maintain the WHOLE graph (guardianship + circle),
--  superseding the versions in schema.sql / migration_auth_fix.sql.
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  insert into public.profiles (id, email, display_name, photo_url, username, role, dob, gender, friend_code, guardian_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'username',
    coalesce(new.raw_user_meta_data->>'role', 'user'),
    nullif(new.raw_user_meta_data->>'dob', '')::date,
    new.raw_user_meta_data->>'gender',
    public.gen_friend_code(),
    nullif(new.raw_user_meta_data->>'guardian_id', '')::uuid
  )
  on conflict (id) do nothing;

  -- if the kid was created with a guardian, build the family graph now
  g := nullif(new.raw_user_meta_data->>'guardian_id', '')::uuid;
  if g is not null then
    perform public.link_child(g, new.id);
  end if;
  return new;
end; $$;

-- a guardian links a kid by friend code → full graph
create or replace function public.link_kid(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare kid_id uuid;
begin
  if auth.uid() is null then return false; end if;
  select id into kid_id from public.profiles where friend_code = upper(p_code) and role = 'kid';
  if kid_id is null then return false; end if;
  perform public.link_child(auth.uid(), kid_id);
  return true;
end; $$;
grant execute on function public.link_kid(text) to authenticated;

-- adopt/re-link an existing kid by username + PIN → full graph
create or replace function public.adopt_kid(p_username text, p_pin text)
returns boolean
language plpgsql security definer set search_path = public, auth, extensions as $$
declare v_kid uuid; v_match boolean;
begin
  if auth.uid() is null then return false; end if;
  select u.id, (u.encrypted_password = crypt(p_pin || '#aLab', u.encrypted_password))
    into v_kid, v_match
  from auth.users u
  where lower(u.email) = lower(p_username) || '@kids.argantalab.app'
  limit 1;
  if v_kid is null or not coalesce(v_match, false) then return false; end if;
  if not exists (select 1 from public.profiles where id = v_kid and role = 'kid') then return false; end if;
  perform public.link_child(auth.uid(), v_kid);
  return true;
end; $$;
grant execute on function public.adopt_kid(text, text) to authenticated;

-- unlink a child from THIS guardian (kid account survives)
create or replace function public.unlink_kid(p_kid uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then return false; end if;
  delete from public.guardianships where guardian_id = auth.uid() and child_id = p_kid;
  select id into cid from public.circles where owner_id = auth.uid() and kind = 'family' order by created_at limit 1;
  if cid is not null then
    delete from public.circle_members where circle_id = cid and member_id = p_kid;
  end if;
  -- drop the primary-guardian mirror only if no guardianship remains
  update public.profiles set guardian_id = null
    where id = p_kid and guardian_id = auth.uid()
      and not exists (select 1 from public.guardianships g where g.child_id = p_kid);
  return true;
end; $$;
grant execute on function public.unlink_kid(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
--  5 · ROSTER RPCs — the app reads families/circles through these
--  (fixes "Grown-ups shows only one kid": my_children returns ALL)
-- ─────────────────────────────────────────────────────────────
create or replace function public.my_children()
returns table(id uuid, display_name text, username text, photo_url text, dob date, gender text,
              diamonds int, xp int, level int, last_seen timestamptz, friend_code text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.username, p.photo_url, p.dob, p.gender,
         coalesce(p.diamonds,0), coalesce(p.xp,0), coalesce(p.level,1), p.last_seen, p.friend_code
  from public.profiles p
  where p.role = 'kid'
    and (p.guardian_id = auth.uid()
         or exists(select 1 from public.guardianships g where g.child_id = p.id and g.guardian_id = auth.uid()))
  order by p.display_name;
$$;
grant execute on function public.my_children() to authenticated;

create or replace function public.my_circles()
returns table(id uuid, name text, kind text, emoji text, accent text, role text, owner_id uuid, member_count bigint)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.kind, c.emoji, c.accent,
         case when c.owner_id = auth.uid() then 'owner' else coalesce(m.role,'member') end as role,
         c.owner_id,
         (select count(*) from public.circle_members cm where cm.circle_id = c.id) as member_count
  from public.circles c
  left join public.circle_members m on m.circle_id = c.id and m.member_id = auth.uid()
  where c.owner_id = auth.uid() or m.member_id = auth.uid();
$$;
grant execute on function public.my_circles() to authenticated;

create or replace function public.circle_roster(p_circle uuid)
returns table(id uuid, display_name text, role text, photo_url text, is_kid boolean, last_seen timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, coalesce(m.role,'member'), p.photo_url, (p.role = 'kid'), p.last_seen
  from public.circle_members m
  join public.profiles p on p.id = m.member_id
  where m.circle_id = p_circle and public.is_member(p_circle)
  order by (p.role = 'kid') desc, p.display_name;
$$;
grant execute on function public.circle_roster(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
--  6 · WALLET — one shared, server-authoritative balance per person
--  diamond_ledger is the immutable truth; profiles.diamonds is a cache.
--  Sign convention:  balance(U) = Σ(amount where to=U) − Σ(amount where from=U)
--    mint  / earn  : from=NULL, to=U
--    burn  / spend : from=U,    to=NULL
--    transfer/grant: from=A,    to=B
-- ─────────────────────────────────────────────────────────────
-- allow burns (to_user NULL); keep mints (from_user NULL)
alter table public.diamond_ledger alter column to_user drop not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'diamond_ledger_party_ck') then
    alter table public.diamond_ledger
      add constraint diamond_ledger_party_ck check (from_user is not null or to_user is not null);
  end if;
end $$;

-- the canonical balance, recomputed from the immutable ledger
create or replace function public.wallet_ledger_balance(p_user uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select sum(amount) from public.diamond_ledger where to_user   = p_user), 0)
       - coalesce((select sum(amount) from public.diamond_ledger where from_user = p_user), 0);
$$;
grant execute on function public.wallet_ledger_balance(uuid) to authenticated;

-- read a cached balance (self or your child)
create or replace function public.wallet_balance(p_user uuid default null)
returns int language plpgsql stable security definer set search_path = public as $$
declare u uuid := coalesce(p_user, auth.uid());
begin
  if u is null then return 0; end if;
  if not (u = auth.uid() or public.is_guardian_of(u) or public.is_admin()) then
    raise exception 'not authorized';
  end if;
  return (select coalesce(diamonds,0) from public.profiles where id = u);
end; $$;
grant execute on function public.wallet_balance(uuid) to authenticated;

-- SPEND (burn) from self — cosmetics & purchases. Atomic, cannot overspend.
create or replace function public.wallet_spend(p_amount int, p_reason text default null, p_app text default 'argantalab')
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); bal int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;
  select coalesce(diamonds,0) into bal from public.profiles where id = uid for update;
  if bal < p_amount then raise exception 'insufficient balance'; end if;
  update public.profiles set diamonds = diamonds - p_amount where id = uid;
  insert into public.diamond_ledger (from_user, to_user, amount, kind, reason)
    values (uid, null, p_amount, 'spend', coalesce(p_reason, p_app));
  return jsonb_build_object('ok', true, 'balance', (select diamonds from public.profiles where id = uid));
end; $$;
grant execute on function public.wallet_spend(int, text, text) to authenticated;

-- EARN (mint) to self from a host action (lesson/game). Per-call + daily caps
-- curb a tampering client from minting unlimited currency.
create or replace function public.wallet_earn(p_amount int, p_kind text default 'earn', p_reason text default null, p_app text default 'argantalab')
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v int; today int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  v := least(greatest(coalesce(p_amount,0), 0), 200);                 -- max 200 per call
  select coalesce(sum(amount),0) into today from public.diamond_ledger
    where to_user = uid and from_user is null
      and kind in ('earn','reward','lesson','game') and created_at::date = current_date;
  if today + v > 2000 then v := greatest(0, 2000 - today); end if;     -- max 2000/day minted
  if v > 0 then
    update public.profiles set diamonds = coalesce(diamonds,0) + v where id = uid;
    insert into public.diamond_ledger (from_user, to_user, amount, kind, reason)
      values (null, uid, v, coalesce(p_kind,'earn'), coalesce(p_reason, p_app));
  end if;
  return jsonb_build_object('ok', true, 'granted', v, 'balance', (select diamonds from public.profiles where id = uid));
end; $$;
grant execute on function public.wallet_earn(int, text, text, text) to authenticated;

-- GRANT: a guardian gives diamonds to their own child (M:N aware). Atomic.
create or replace function public.grant_diamonds(p_to uuid, p_amount int, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); from_bal int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;
  if not public.is_guardian_of(p_to) then raise exception 'not your child'; end if;
  select coalesce(diamonds,0) into from_bal from public.profiles where id = uid for update;
  if from_bal < p_amount then raise exception 'insufficient balance'; end if;
  update public.profiles set diamonds = diamonds - p_amount where id = uid;
  update public.profiles set diamonds = coalesce(diamonds,0) + p_amount where id = p_to;
  insert into public.diamond_ledger (from_user, to_user, amount, kind, reason)
    values (uid, p_to, p_amount, 'reward', p_reason);
  return jsonb_build_object('ok', true,
    'fromBalance', (select diamonds from public.profiles where id = uid),
    'toBalance',   (select diamonds from public.profiles where id = p_to));
end; $$;
grant execute on function public.grant_diamonds(uuid, int, text) to authenticated;

-- reconcile a cached balance from the immutable ledger (self or admin).
-- NOTE: not auto-run in backfill — legacy client-side diamond math was never
-- ledgered, so reconciling would reset those balances. Run deliberately.
create or replace function public.wallet_reconcile(p_user uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare u uuid := coalesce(p_user, auth.uid()); b int;
begin
  if u is null then return 0; end if;
  if not (u = auth.uid() or public.is_admin()) then raise exception 'not authorized'; end if;
  b := public.wallet_ledger_balance(u);
  update public.profiles set diamonds = b where id = u;
  return b;
end; $$;
grant execute on function public.wallet_reconcile(uuid) to authenticated;

-- ═════════════════════════════════════════════════════════════
--  PHASE 2 · BACKFILL — build the family graph from existing data
--  Idempotent: re-running only fills gaps.
-- ═════════════════════════════════════════════════════════════
do $$
declare r record;
begin
  for r in (select id as child, guardian_id as parent
            from public.profiles where role = 'kid' and guardian_id is not null) loop
    perform public.link_child(r.parent, r.child);
  end loop;
end $$;

commit;

-- ═════════════════════════════════════════════════════════════
--  VERIFICATION GATE — run these SELECTs after the migration.
--  Expected: every existing kid appears under a guardian AND in a
--  family circle, and cached balances are explainable by the ledger.
-- ═════════════════════════════════════════════════════════════
-- (A) every kid with a guardian now has a guardianship row:
--   select count(*) as kids_with_guardian_id from public.profiles where role='kid' and guardian_id is not null;
--   select count(*) as guardianship_rows      from public.guardianships;   -- should be >= the above
--
-- (B) every parent has a family circle with their kids as members:
--   select c.owner_id, c.name, count(m.member_id) as members
--   from public.circles c left join public.circle_members m on m.circle_id=c.id
--   where c.kind='family' group by 1,2 order by members desc;
--
-- (C) a guardian's full roster (run as that guardian, or via the app):
--   select * from public.my_children();
--
-- (D) wallet truth vs cache (drift = legacy un-ledgered client math; expected
--     for now, reconcile later per user with wallet_reconcile):
--   select id, display_name, diamonds as cached, public.wallet_ledger_balance(id) as ledger
--   from public.profiles where diamonds <> public.wallet_ledger_balance(id);
-- ============================================================
