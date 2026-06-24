-- ============================================================
--  ARGANTALAB · ANALYTICS + REWARDS  (additive migration)
--  Paste into Supabase → SQL Editor → Run. Idempotent (re-runnable).
--  Builds on schema.sql — reuses public.profiles / skill_mastery.
--    1. learn_event   — immutable per-answer event log (source of truth)
--    2. daily_summary — per-day rollup (streak / screen-time)
--    3. diamond_ledger — immutable reward ledger
--    4. RPCs: log_learn_event, grant_starter_pack, grant_diamonds, kid_dashboard
--  Nothing existing is dropped. Safe alongside Circle HQ.
-- ============================================================
begin;

-- ─────────────────────────────────────────────────────────────
--  1 · TELEMETRY — immutable learn-event log
--  Denormalised on purpose (no FK on item_id) so logging an answer
--  can NEVER fail because of a missing/renamed item row.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.learn_event (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  item_id     text,
  world_key   text,
  skill_key   text,
  stage_key   text,
  interaction text,
  bloom       text,        -- remember | understand | apply | analyze | create
  competency  text,        -- cambridge life competency
  difficulty  int,
  correct     boolean not null,
  time_ms     int,
  xp          int default 0,
  created_at  timestamptz default now()
);
create index if not exists learn_event_user_idx  on public.learn_event(user_id, created_at);
create index if not exists learn_event_skill_idx on public.learn_event(user_id, world_key, skill_key);

alter table public.learn_event enable row level security;
-- a learner inserts their own events; a guardian may READ their kids' events
drop policy if exists learn_event_insert_own on public.learn_event;
create policy learn_event_insert_own on public.learn_event
  for insert with check (auth.uid() = user_id);
drop policy if exists learn_event_select on public.learn_event;
create policy learn_event_select on public.learn_event
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles k where k.id = learn_event.user_id and k.guardian_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
--  2 · DAILY ROLLUP — one row per learner per day
--  Written ONLY via the security-definer RPC (no direct write policy).
-- ─────────────────────────────────────────────────────────────
create table if not exists public.daily_summary (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  day      date not null,
  items    int    default 0,
  correct  int    default 0,
  time_ms  bigint default 0,
  xp       int    default 0,
  primary key (user_id, day)
);
alter table public.daily_summary enable row level security;
drop policy if exists daily_summary_select on public.daily_summary;
create policy daily_summary_select on public.daily_summary
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles k where k.id = daily_summary.user_id and k.guardian_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
--  3 · LOG RPC — telemetry + mastery + daily, all in one atomic call
--  Reuses public.skill_mastery (mastery 0..1 + Leitner box for spacing).
--  This is now the SINGLE cloud writer of mastery (client mirror removed).
-- ─────────────────────────────────────────────────────────────
create or replace function public.log_learn_event(
  p_item_id text, p_world text, p_skill text, p_stage text,
  p_interaction text, p_bloom text, p_competency text,
  p_difficulty int, p_correct boolean, p_time_ms int, p_xp int default 0
) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
        cur_m numeric; cur_box int; new_m numeric; new_box int;
        lr numeric := 0.20;  -- learn rate
        sl numeric := 0.15;  -- slip penalty
begin
  if uid is null then return; end if;

  -- (a) immutable event
  insert into public.learn_event(
    user_id,item_id,world_key,skill_key,stage_key,interaction,bloom,competency,difficulty,correct,time_ms,xp)
  values (uid,p_item_id,p_world,p_skill,p_stage,p_interaction,p_bloom,p_competency,
          p_difficulty,p_correct,p_time_ms,coalesce(p_xp,0));

  -- (b) derived mastery (Elo-ish) + Leitner box (spaced-repetition half-life proxy)
  select mastery, box into cur_m, cur_box from public.skill_mastery
    where user_id=uid and world_key=p_world and skill_key=p_skill;
  cur_m := coalesce(cur_m, 0); cur_box := coalesce(cur_box, 1);
  if p_correct then
    new_m   := least(1, cur_m + lr*(1-cur_m));
    new_box := least(6, cur_box + 1);
  else
    new_m   := greatest(0, cur_m - sl);
    new_box := 1;
  end if;
  insert into public.skill_mastery(user_id,world_key,skill_key,mastery,box,last_seen)
    values (uid,p_world,p_skill,new_m,new_box,now())
    on conflict (user_id,world_key,skill_key)
    do update set mastery=excluded.mastery, box=excluded.box, last_seen=now();

  -- (c) daily rollup
  insert into public.daily_summary(user_id,day,items,correct,time_ms,xp)
    values (uid, current_date, 1, case when p_correct then 1 else 0 end,
            coalesce(p_time_ms,0), coalesce(p_xp,0))
    on conflict (user_id,day) do update set
      items   = public.daily_summary.items   + 1,
      correct = public.daily_summary.correct + case when p_correct then 1 else 0 end,
      time_ms = public.daily_summary.time_ms + coalesce(p_time_ms,0),
      xp      = public.daily_summary.xp      + coalesce(p_xp,0);
end; $$;
grant execute on function public.log_learn_event(text,text,text,text,text,text,text,int,boolean,int,int) to authenticated;

-- ─────────────────────────────────────────────────────────────
--  4 · REWARDS — immutable diamond ledger
--  profiles.diamonds stays the cached balance (the app already reads it);
--  the ledger gives history and powers grant guardrails.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.diamond_ledger (
  id         bigint generated always as identity primary key,
  from_user  uuid references public.profiles(id) on delete set null, -- null = system grant
  to_user    uuid not null references public.profiles(id) on delete cascade,
  amount     int  not null check (amount > 0),
  kind       text default 'reward',  -- starter | reward | gift | earn | spend
  reason     text,
  created_at timestamptz default now()
);
create index if not exists diamond_ledger_to_idx   on public.diamond_ledger(to_user, created_at);
create index if not exists diamond_ledger_from_idx on public.diamond_ledger(from_user, created_at);

alter table public.diamond_ledger enable row level security;
drop policy if exists diamond_ledger_select on public.diamond_ledger;
create policy diamond_ledger_select on public.diamond_ledger
  for select using (
    auth.uid() = to_user or auth.uid() = from_user
    or exists (select 1 from public.profiles k where k.id = diamond_ledger.to_user and k.guardian_id = auth.uid())
  );
-- no direct write policy → all writes go through the security-definer RPCs below

-- starter pack: idempotent +50,000 to a grown-up (never a kid)
create or replace function public.grant_starter_pack()
returns int language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); already boolean; bal int;
begin
  if uid is null then return 0; end if;
  if exists(select 1 from public.profiles where id=uid and role='kid') then
    return (select coalesce(diamonds,0) from public.profiles where id=uid);
  end if;
  select exists(select 1 from public.diamond_ledger where to_user=uid and kind='starter') into already;
  if not already then
    insert into public.diamond_ledger(from_user,to_user,amount,kind,reason)
      values (null, uid, 50000, 'starter', 'Welcome starter pack');
    update public.profiles set diamonds = coalesce(diamonds,0) + 50000 where id=uid;
  end if;
  select coalesce(diamonds,0) into bal from public.profiles where id=uid;
  return bal;
end; $$;
grant execute on function public.grant_starter_pack() to authenticated;

-- grant diamonds: parent → own kid. Atomic, guarded, cannot overspend.
create or replace function public.grant_diamonds(p_to uuid, p_amount int, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); from_bal int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;
  if not exists(select 1 from public.profiles where id=p_to and guardian_id=uid) then
    raise exception 'not your child';
  end if;
  select coalesce(diamonds,0) into from_bal from public.profiles where id=uid for update;
  if from_bal < p_amount then raise exception 'insufficient balance'; end if;
  update public.profiles set diamonds = diamonds - p_amount where id=uid;
  update public.profiles set diamonds = coalesce(diamonds,0) + p_amount where id=p_to;
  insert into public.diamond_ledger(from_user,to_user,amount,kind,reason)
    values (uid, p_to, p_amount, 'reward', p_reason);
  return jsonb_build_object(
    'ok', true,
    'fromBalance', (select diamonds from public.profiles where id=uid),
    'toBalance',   (select diamonds from public.profiles where id=p_to));
end; $$;
grant execute on function public.grant_diamonds(uuid,int,text) to authenticated;

-- ─────────────────────────────────────────────────────────────
--  5 · DASHBOARD RPC — one round-trip per kid (guardian- or self-gated)
-- ─────────────────────────────────────────────────────────────
create or replace function public.kid_dashboard(p_kid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); r jsonb;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  -- Authorize via the M:N guardianships graph (is_guardian_of), NOT just the
  -- single guardian_id mirror — so EVERY co-guardian sees the kid, not only the
  -- primary one. (is_guardian_of is defined in migration_spine.sql; resolved at
  -- call time.) Fixes a co-parent seeing empty stats for a kid that has data.
  if not (p_kid = uid or public.is_guardian_of(p_kid)) then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'kid', (select jsonb_build_object('id',id,'name',display_name,'photo',photo_url,
              'dob',dob,'lastSeen',last_seen,'diamonds',coalesce(diamonds,0),'xp',coalesce(xp,0),'level',coalesce(level,1))
            from public.profiles where id=p_kid),
    'mastery', coalesce((select jsonb_agg(jsonb_build_object(
              'world',world_key,'skill',skill_key,'mastery',mastery,'box',box,'lastSeen',last_seen))
            from public.skill_mastery where user_id=p_kid),'[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object(
              'day',day,'items',items,'correct',correct,'minutes',round(time_ms/60000.0,1),'xp',xp) order by day)
            from public.daily_summary where user_id=p_kid and day >= current_date - 120),'[]'::jsonb),
    'bloom', coalesce((select jsonb_object_agg(b, n) from (
              select coalesce(bloom,'understand') b, count(*) n
              from public.learn_event where user_id=p_kid group by 1) s),'{}'::jsonb),
    'competency', coalesce((select jsonb_object_agg(c, jsonb_build_object('total',n,'correct',cc)) from (
              select coalesce(competency,'critical-thinking') c, count(*) n, count(*) filter(where correct) cc
              from public.learn_event where user_id=p_kid group by 1) s),'{}'::jsonb),
    'interest', coalesce((select jsonb_object_agg(world_key, n) from (
              select world_key, count(*) n from public.learn_event
              where user_id=p_kid and created_at >= now()-interval '30 days' group by 1) s),'{}'::jsonb),
    'recentRewards', coalesce((select jsonb_agg(jsonb_build_object(
              'amount',amount,'reason',reason,'kind',kind,'at',created_at) order by created_at desc) from (
              select * from public.diamond_ledger where to_user=p_kid order by created_at desc limit 8) s),'[]'::jsonb),
    'generatedAt', now()
  ) into r;
  return r;
end; $$;
grant execute on function public.kid_dashboard(uuid) to authenticated;

commit;
