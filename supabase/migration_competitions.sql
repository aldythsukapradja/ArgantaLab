-- ============================================================
--  ARGANTALAB · ARGANTACUP  (custom circle competitions)
--  Paste into Supabase → SQL Editor → Run. Idempotent (re-runnable).
--  A guardian runs a time-boxed cup inside one of their circles with a real
--  prize (diamonds / a mount / a shop item). Standings are SERVER-computed
--  from the same truth the rings use (profiles.xp, learn_event) — never the
--  client. Diamond prizes are ESCROWED from the guardian's budget at start,
--  so a winner is always paid and it refunds if nobody plays.
--
--  Builds on: profiles, circles, circle_members, circle_roster, is_member,
--  is_circle_admin, learn_event, diamond_ledger, person_mounts, avatar_state.
-- ============================================================
begin;

-- ─────────────────────────────────────────────────────────────
--  1 · TABLES
-- ─────────────────────────────────────────────────────────────
create table if not exists public.competitions (
  id             uuid primary key default gen_random_uuid(),
  circle_id      uuid not null references public.circles(id) on delete cascade,
  creator_id     uuid not null references public.profiles(id) on delete cascade,
  title          text not null,
  metric         text not null default 'xp',   -- xp | items
  target         int,                           -- optional "first to N" framing
  starts_at      timestamptz not null default now(),
  ends_at        timestamptz not null,
  prize_kind     text not null,                 -- diamonds | mount | item
  prize_diamonds int default 0,
  prize_item     text,                          -- mount_key or cosmetic id
  handicap       boolean default false,         -- reserved (V2 age-fair scoring)
  escrow         int not null default 0,        -- diamonds held from the creator
  status         text not null default 'live',  -- live | paid | cancelled
  winner_id      uuid references public.profiles(id) on delete set null,
  created_at     timestamptz default now()
);
create index if not exists competitions_circle_idx on public.competitions(circle_id, status);

create table if not exists public.competition_entrants (
  competition_id uuid not null references public.competitions(id) on delete cascade,
  kid_id         uuid not null references public.profiles(id) on delete cascade,
  baseline       int not null default 0,   -- metric value snapshot at start
  score          int not null default 0,   -- recomputed on read/settle
  primary key (competition_id, kid_id)
);

-- ─────────────────────────────────────────────────────────────
--  2 · RLS — circle members read; ALL writes go through RPCs below
-- ─────────────────────────────────────────────────────────────
alter table public.competitions enable row level security;
drop policy if exists competitions_read on public.competitions;
create policy competitions_read on public.competitions
  for select using (public.is_member(circle_id));

alter table public.competition_entrants enable row level security;
drop policy if exists entrants_read on public.competition_entrants;
create policy entrants_read on public.competition_entrants
  for select using (exists (
    select 1 from public.competitions c
    where c.id = competition_entrants.competition_id and public.is_member(c.circle_id)
  ));

-- ─────────────────────────────────────────────────────────────
--  3 · SCORE — one place that maps (metric, entrant) → live score.
--  xp    : current profiles.xp minus the baseline snapshot at start
--  items : questions answered inside the window (baseline is 0)
-- ─────────────────────────────────────────────────────────────
create or replace function public._cup_score(p_metric text, p_kid uuid, p_start timestamptz, p_end timestamptz, p_baseline int)
returns int language sql stable security definer set search_path = public as $$
  select greatest(0, case coalesce(p_metric,'xp')
    when 'xp' then coalesce((select xp from public.profiles where id = p_kid), 0) - p_baseline
    when 'items' then coalesce((select count(*)::int from public.learn_event le
                                where le.user_id = p_kid
                                  and le.created_at >= p_start
                                  and le.created_at < least(now(), p_end)), 0) - p_baseline
    else 0 end);
$$;

-- ─────────────────────────────────────────────────────────────
--  4 · CREATE — guardian starts a cup; diamond prizes are escrowed.
--  p_kids null/empty → default to EVERY kid in the circle.
-- ─────────────────────────────────────────────────────────────
create or replace function public.create_competition(
  p_circle uuid, p_title text, p_metric text, p_target int, p_days int,
  p_prize_kind text, p_prize_diamonds int, p_prize_item text,
  p_handicap boolean, p_kids uuid[]
) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; hold int := 0; bal int; k uuid; base int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not public.is_circle_admin(p_circle) then raise exception 'only a circle owner can start a cup'; end if;
  if coalesce(p_days,0) < 1 then raise exception 'duration must be at least a day'; end if;
  if coalesce(trim(p_title),'') = '' then raise exception 'name required'; end if;
  if p_prize_kind not in ('diamonds','mount','item') then raise exception 'bad prize'; end if;

  if p_prize_kind = 'diamonds' then
    hold := coalesce(p_prize_diamonds, 0);
    if hold <= 0 then raise exception 'prize must be positive'; end if;
    select coalesce(diamonds,0) into bal from public.profiles where id = uid for update;
    if bal < hold then raise exception 'insufficient balance'; end if;
    update public.profiles set diamonds = diamonds - hold where id = uid;  -- held out of budget
  elsif p_prize_kind in ('mount','item') then
    if coalesce(trim(p_prize_item),'') = '' then raise exception 'pick a prize item'; end if;
  end if;

  insert into public.competitions(circle_id, creator_id, title, metric, target, starts_at, ends_at,
      prize_kind, prize_diamonds, prize_item, handicap, escrow, status)
    values (p_circle, uid, trim(p_title), coalesce(p_metric,'xp'), p_target, now(),
      now() + make_interval(days => p_days), p_prize_kind, coalesce(p_prize_diamonds,0),
      nullif(trim(coalesce(p_prize_item,'')),''), coalesce(p_handicap,false), hold, 'live')
    returning id into cid;

  -- entrants: the given kids, else every kid in the circle
  if p_kids is null or array_length(p_kids,1) is null then
    for k in select id from public.circle_roster(p_circle) where is_kid loop
      base := case coalesce(p_metric,'xp') when 'xp' then coalesce((select xp from public.profiles where id=k),0) else 0 end;
      insert into public.competition_entrants(competition_id, kid_id, baseline) values (cid, k, base) on conflict do nothing;
    end loop;
  else
    foreach k in array p_kids loop
      base := case coalesce(p_metric,'xp') when 'xp' then coalesce((select xp from public.profiles where id=k),0) else 0 end;
      insert into public.competition_entrants(competition_id, kid_id, baseline) values (cid, k, base) on conflict do nothing;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'id', cid,
    'balance', (select coalesce(diamonds,0) from public.profiles where id = uid));
end; $$;
grant execute on function public.create_competition(uuid,text,text,int,int,text,int,text,boolean,uuid[]) to authenticated;

-- ─────────────────────────────────────────────────────────────
--  5 · SETTLE — pick the winner, pay the prize, refund any remainder.
--  Runs at/after ends_at (settle-on-read), or early via a circle owner
--  ("End now"). Idempotent: a paid/cancelled cup is a no-op.
-- ─────────────────────────────────────────────────────────────
create or replace function public.settle_competition(p_cup uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c record; win uuid; top int;
begin
  select * into c from public.competitions where id = p_cup for update;
  if c is null then raise exception 'no such cup'; end if;
  if c.status <> 'live' then return jsonb_build_object('ok', true, 'status', c.status); end if;
  if now() < c.ends_at and not public.is_circle_admin(c.circle_id) then
    raise exception 'cup still running';
  end if;

  update public.competition_entrants e
    set score = public._cup_score(c.metric, e.kid_id, c.starts_at, c.ends_at, e.baseline)
    where e.competition_id = p_cup;

  select kid_id, score into win, top from public.competition_entrants
    where competition_id = p_cup order by score desc, kid_id limit 1;

  if win is null or coalesce(top,0) <= 0 then
    if c.escrow > 0 then update public.profiles set diamonds = coalesce(diamonds,0) + c.escrow where id = c.creator_id; end if;
    update public.competitions set status='paid', winner_id=null where id = p_cup;
    return jsonb_build_object('ok', true, 'winner', null);
  end if;

  if c.prize_kind = 'diamonds' then
    update public.profiles set diamonds = coalesce(diamonds,0) + c.prize_diamonds where id = win;
    insert into public.diamond_ledger(from_user, to_user, amount, kind, reason)
      values (c.creator_id, win, c.prize_diamonds, 'cup_prize', c.title);
    if c.escrow > c.prize_diamonds then
      update public.profiles set diamonds = coalesce(diamonds,0) + (c.escrow - c.prize_diamonds) where id = c.creator_id;
    end if;
  elsif c.prize_kind = 'mount' then
    insert into public.person_mounts(owner_id, mount_key) values (win, c.prize_item) on conflict do nothing;
  elsif c.prize_kind = 'item' then
    insert into public.avatar_state(user_id, owned) values (win, jsonb_build_array(c.prize_item))
      on conflict (user_id) do update set
        owned = case when public.avatar_state.owned ? c.prize_item then public.avatar_state.owned
                     else public.avatar_state.owned || to_jsonb(c.prize_item) end,
        updated_at = now();
  end if;

  update public.competitions set status='paid', winner_id=win where id = p_cup;
  return jsonb_build_object('ok', true, 'winner', win);
end; $$;
grant execute on function public.settle_competition(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
--  6 · STANDINGS — live ranked scores for one cup (settles on read).
-- ─────────────────────────────────────────────────────────────
create or replace function public.competition_standings(p_cup uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select * into c from public.competitions where id = p_cup;
  if c is null then raise exception 'no such cup'; end if;
  if not public.is_member(c.circle_id) then raise exception 'not authorized'; end if;

  if c.status = 'live' and now() >= c.ends_at then
    perform public.settle_competition(p_cup);
    select * into c from public.competitions where id = p_cup;
  end if;

  if c.status = 'live' then
    update public.competition_entrants e
      set score = public._cup_score(c.metric, e.kid_id, c.starts_at, c.ends_at, e.baseline)
      where e.competition_id = p_cup;
  end if;

  return jsonb_build_object(
    'id', c.id, 'circle_id', c.circle_id, 'title', c.title, 'metric', c.metric,
    'target', c.target, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
    'prize_kind', c.prize_kind, 'prize_diamonds', c.prize_diamonds, 'prize_item', c.prize_item,
    'status', c.status, 'winner_id', c.winner_id, 'creator_id', c.creator_id,
    'standings', coalesce((select jsonb_agg(jsonb_build_object(
        'kid_id', e.kid_id, 'name', p.display_name, 'score', e.score, 'is_kid', (p.role = 'kid'))
        order by e.score desc, p.display_name)
      from public.competition_entrants e join public.profiles p on p.id = e.kid_id
      where e.competition_id = p_cup), '[]'::jsonb)
  );
end; $$;
grant execute on function public.competition_standings(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
--  7 · MY CUPS — every LIVE cup across circles I belong to, with
--  standings embedded. One round-trip for the Fame "Cup" tab.
-- ─────────────────────────────────────────────────────────────
create or replace function public.my_cups()
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); out jsonb := '[]'::jsonb; cup record;
begin
  if uid is null then return out; end if;
  for cup in
    select c.id from public.competitions c
    where public.is_member(c.circle_id) and c.status = 'live'
    order by c.created_at desc
  loop
    out := out || jsonb_build_array(public.competition_standings(cup.id));
  end loop;
  return out;
end; $$;
grant execute on function public.my_cups() to authenticated;

-- ─────────────────────────────────────────────────────────────
--  8 · CANCEL — circle owner scraps a live cup; escrow refunds.
-- ─────────────────────────────────────────────────────────────
create or replace function public.cancel_competition(p_cup uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select * into c from public.competitions where id = p_cup for update;
  if c is null then raise exception 'no such cup'; end if;
  if not public.is_circle_admin(c.circle_id) then raise exception 'not allowed'; end if;
  if c.status <> 'live' then return jsonb_build_object('ok', true); end if;
  if c.escrow > 0 then update public.profiles set diamonds = coalesce(diamonds,0) + c.escrow where id = c.creator_id; end if;
  update public.competitions set status='cancelled' where id = p_cup;
  return jsonb_build_object('ok', true);
end; $$;
grant execute on function public.cancel_competition(uuid) to authenticated;

commit;
