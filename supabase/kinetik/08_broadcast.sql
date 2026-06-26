-- ============================================================
--  KINETIK · BROADCAST  ("Discover" feed engine)  — run AFTER the other kinetik files
--
--  Platform-authored content that fills every circle's feed so it is never
--  empty: fun facts, top-10s, parenting tips, did-you-knows, quotes — posted
--  by "KinetikCircle" itself. Authored & scheduled from Circle HQ (Broadcast
--  surface), no LLM required — operators paste content + media URLs.
--
--  SCALABILITY: a broadcast is ONE global row that reaches EVERY circle. It is
--  not fanned-out / copied per circle. Reactions & views are tracked centrally
--  on the broadcast row, so 1 post → 1M circles costs one row, not a million.
--
--  Media (images / short videos) are external URLs — the operator generates
--  them elsewhere (CDN, storage, wherever) and pastes the URL. No bucket needed.
--
--  Idempotent. Safe to re-run.
-- ============================================================
begin;

-- ── 0. Operator allow-list ────────────────────────────────────
-- Who may author/schedule broadcasts from HQ. Bootstrap rule: while the table
-- is EMPTY, any authenticated user is treated as an operator (so a fresh
-- project is usable). Add your uid to lock it down:
--   insert into public.hq_operator(uid) values ('<your-auth-uid>');
create table if not exists public.hq_operator (
  uid        uuid primary key references auth.users(id) on delete cascade,
  added_at   timestamptz not null default now()
);
alter table public.hq_operator enable row level security;
drop policy if exists hq_operator_read on public.hq_operator;
create policy hq_operator_read on public.hq_operator for select using (true);

create or replace function public.hq_is_operator()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    exists(select 1 from public.hq_operator o where o.uid = auth.uid())
    or not exists(select 1 from public.hq_operator),   -- bootstrap: empty list = open
  false);
$$;
grant execute on function public.hq_is_operator() to authenticated;

-- ── 1. Tables ─────────────────────────────────────────────────
create table if not exists public.kinetik_broadcast (
  id             uuid primary key default gen_random_uuid(),
  format         text not null default 'fact',     -- fact | top10 | did_you_know | tip | quote | story | poll-less formats
  theme          text not null default 'funfacts', -- family | kids | parenting | friends | funfacts | wellbeing | ...
  title          text not null,                    -- headline / tagline
  body           text,                             -- main content
  media_kind     text not null default 'none' check (media_kind in ('none','image','video')),
  media_url      text,                             -- external URL (CDN / storage / youtube-like)
  source         text,                             -- optional attribution / footer ("via NASA")
  emoji          text,                             -- leading emoji
  accent         text,                             -- card accent hex (e.g. '#8B5CF6')
  audience       text not null default 'circle' check (audience in ('circle','grownups')),
  status         text not null default 'draft' check (status in ('draft','scheduled','published','archived')),
  publish_at     timestamptz,                      -- when a scheduled post should go live
  published_at   timestamptz,                      -- when it actually went live
  view_count     int  not null default 0,
  reaction_count int  not null default 0,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists kinetik_broadcast_live_idx
  on public.kinetik_broadcast(status, published_at desc);
create index if not exists kinetik_broadcast_sched_idx
  on public.kinetik_broadcast(status, publish_at);

create table if not exists public.kinetik_broadcast_reaction (
  broadcast_id uuid not null references public.kinetik_broadcast(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  emoji        text not null,
  created_at   timestamptz not null default now(),
  primary key (broadcast_id, user_id)              -- one (replaceable) reaction per user
);

create table if not exists public.kinetik_broadcast_view (
  broadcast_id uuid not null references public.kinetik_broadcast(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  viewed_at    timestamptz not null default now(),
  primary key (broadcast_id, user_id)
);

-- ── 2. Count-maintenance triggers ─────────────────────────────
create or replace function public.kinetik_bump_bcast_reaction() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then update public.kinetik_broadcast set reaction_count = reaction_count + 1 where id = new.broadcast_id;
  elsif tg_op = 'DELETE' then update public.kinetik_broadcast set reaction_count = greatest(reaction_count - 1,0) where id = old.broadcast_id;
  end if; return null;
end; $$;
drop trigger if exists kinetik_bcast_reaction_count on public.kinetik_broadcast_reaction;
create trigger kinetik_bcast_reaction_count after insert or delete on public.kinetik_broadcast_reaction
  for each row execute function public.kinetik_bump_bcast_reaction();

-- ── 3. RLS ────────────────────────────────────────────────────
alter table public.kinetik_broadcast          enable row level security;
alter table public.kinetik_broadcast_reaction enable row level security;
alter table public.kinetik_broadcast_view     enable row level security;

-- Any authenticated user may READ published broadcasts (they are global).
-- Operators may read everything (drafts/scheduled) for the HQ catalogue.
drop policy if exists kbcast_read on public.kinetik_broadcast;
create policy kbcast_read on public.kinetik_broadcast for select
  using (status = 'published' or public.hq_is_operator());
-- Only operators write.
drop policy if exists kbcast_write on public.kinetik_broadcast;
create policy kbcast_write on public.kinetik_broadcast for all
  using (public.hq_is_operator()) with check (public.hq_is_operator());

-- Reactions / views: a user manages their own row.
drop policy if exists kbcast_react_read on public.kinetik_broadcast_reaction;
create policy kbcast_react_read on public.kinetik_broadcast_reaction for select using (true);
drop policy if exists kbcast_react_write on public.kinetik_broadcast_reaction;
create policy kbcast_react_write on public.kinetik_broadcast_reaction for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists kbcast_view_rw on public.kinetik_broadcast_view;
create policy kbcast_view_rw on public.kinetik_broadcast_view for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── 4. Reader RPCs (KinetikCircle feed) ───────────────────────
-- Live "Discover" feed: published, due, audience-filtered, newest first, with
-- this user's reaction + aggregate reactions. Global — same content for every
-- circle, so no circle arg is needed; audience just gates kids out of grown-up
-- posts (role is read from the caller's profile).
create or replace function public.kinetik_broadcast_feed(p_limit int default 12, p_before timestamptz default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(r order by (r->>'published_at') desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', b.id, 'format', b.format, 'theme', b.theme, 'title', b.title, 'body', b.body,
      'media_kind', b.media_kind, 'media_url', b.media_url, 'source', b.source,
      'emoji', b.emoji, 'accent', b.accent, 'published_at', b.published_at,
      'reaction_count', b.reaction_count, 'view_count', b.view_count,
      'reactions', (select coalesce(jsonb_object_agg(e.emoji, e.n),'{}') from
                     (select emoji, count(*) n from public.kinetik_broadcast_reaction rr where rr.broadcast_id = b.id group by emoji) e),
      'my_reaction', (select emoji from public.kinetik_broadcast_reaction rr where rr.broadcast_id = b.id and rr.user_id = auth.uid())
    ) r
    from public.kinetik_broadcast b
    where b.status = 'published'
      and (b.published_at is null or b.published_at <= now())
      and (p_before is null or b.published_at < p_before)
      and (b.audience = 'circle'
           or (b.audience = 'grownups' and coalesce((select role from public.profiles where id = auth.uid()),'') <> 'kid'))
    order by b.published_at desc
    limit greatest(1, least(coalesce(p_limit,12), 50))
  ) q;
$$;
grant execute on function public.kinetik_broadcast_feed(int,timestamptz) to authenticated;

create or replace function public.kinetik_broadcast_react(p_broadcast uuid, p_emoji text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_emoji is null then
    delete from public.kinetik_broadcast_reaction where broadcast_id = p_broadcast and user_id = auth.uid();
  else
    insert into public.kinetik_broadcast_reaction(broadcast_id, user_id, emoji)
      values (p_broadcast, auth.uid(), p_emoji)
      on conflict (broadcast_id, user_id) do update set emoji = excluded.emoji, created_at = now();
  end if;
end; $$;
grant execute on function public.kinetik_broadcast_react(uuid,text) to authenticated;

-- Mark a broadcast seen (counts once per user → drives view_count / reach).
create or replace function public.kinetik_broadcast_seen(p_broadcast uuid)
returns void language plpgsql security definer set search_path = public as $$
declare fresh boolean;
begin
  insert into public.kinetik_broadcast_view(broadcast_id, user_id)
    values (p_broadcast, auth.uid()) on conflict do nothing;
  get diagnostics fresh = row_count;
  if fresh then update public.kinetik_broadcast set view_count = view_count + 1 where id = p_broadcast; end if;
end; $$;
grant execute on function public.kinetik_broadcast_seen(uuid) to authenticated;

-- ── 5. Operator RPCs (Circle HQ) ──────────────────────────────
-- Full catalogue with live counts. Operator-only.
create or replace function public.hq_broadcast_list()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.hq_is_operator() then '[]'::jsonb else
    coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'format', b.format, 'theme', b.theme, 'title', b.title, 'body', b.body,
      'media_kind', b.media_kind, 'media_url', b.media_url, 'source', b.source,
      'emoji', b.emoji, 'accent', b.accent, 'audience', b.audience, 'status', b.status,
      'publish_at', b.publish_at, 'published_at', b.published_at,
      'view_count', b.view_count, 'reaction_count', b.reaction_count, 'created_at', b.created_at
    ) order by b.created_at desc), '[]'::jsonb)
  end
  from public.kinetik_broadcast b;
$$;
grant execute on function public.hq_broadcast_list() to authenticated;

-- Upsert (create or edit). p_id null → create. Returns the row id.
-- p_status: 'draft' | 'scheduled' | 'published' | 'archived'. When it resolves
-- to 'published' (now or a due schedule) published_at is stamped.
create or replace function public.hq_broadcast_save(
  p_id uuid, p_format text, p_theme text, p_title text, p_body text,
  p_media_kind text, p_media_url text, p_source text, p_emoji text, p_accent text,
  p_audience text, p_status text, p_publish_at timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare bid uuid; final_pub timestamptz;
begin
  if not public.hq_is_operator() then raise exception 'operator only'; end if;
  if coalesce(trim(p_title),'') = '' then raise exception 'title required'; end if;
  -- published_at: set when going live now, or when a scheduled time has arrived.
  if p_status = 'published' then
    final_pub := coalesce(p_publish_at, now());
  else
    final_pub := null;
  end if;

  if p_id is null then
    insert into public.kinetik_broadcast(
      format, theme, title, body, media_kind, media_url, source, emoji, accent,
      audience, status, publish_at, published_at, created_by)
    values (
      coalesce(p_format,'fact'), coalesce(p_theme,'funfacts'), p_title, p_body,
      coalesce(p_media_kind,'none'), p_media_url, p_source, p_emoji, p_accent,
      coalesce(p_audience,'circle'), coalesce(p_status,'draft'), p_publish_at, final_pub, auth.uid())
    returning id into bid;
  else
    update public.kinetik_broadcast set
      format = coalesce(p_format, format), theme = coalesce(p_theme, theme),
      title = p_title, body = p_body, media_kind = coalesce(p_media_kind, media_kind),
      media_url = p_media_url, source = p_source, emoji = p_emoji, accent = p_accent,
      audience = coalesce(p_audience, audience), status = coalesce(p_status, status),
      publish_at = p_publish_at,
      published_at = case when p_status = 'published' then coalesce(published_at, final_pub) else published_at end,
      updated_at = now()
    where id = p_id returning id into bid;
  end if;
  return bid;
end; $$;
grant execute on function public.hq_broadcast_save(uuid,text,text,text,text,text,text,text,text,text,text,text,timestamptz) to authenticated;

create or replace function public.hq_broadcast_set_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.hq_is_operator() then raise exception 'operator only'; end if;
  update public.kinetik_broadcast set
    status = p_status,
    published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end,
    updated_at = now()
  where id = p_id;
end; $$;
grant execute on function public.hq_broadcast_set_status(uuid,text) to authenticated;

create or replace function public.hq_broadcast_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.hq_is_operator() then raise exception 'operator only'; end if;
  delete from public.kinetik_broadcast where id = p_id;
end; $$;
grant execute on function public.hq_broadcast_delete(uuid) to authenticated;

-- Scheduler: flip due 'scheduled' rows → 'published'. Returns count promoted.
-- Schedule it with pg_cron (every minute):
--   select cron.schedule('kinetik-broadcast-due','* * * * *',$$select public.hq_broadcast_publish_due()$$);
create or replace function public.hq_broadcast_publish_due()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.kinetik_broadcast
    set status = 'published', published_at = coalesce(published_at, publish_at, now()), updated_at = now()
    where status = 'scheduled' and publish_at is not null and publish_at <= now();
  get diagnostics n = row_count;
  return n;
end; $$;
grant execute on function public.hq_broadcast_publish_due() to authenticated;

commit;
-- ============================================================
--  After deploying:
--   1) (optional) lock down operators:
--        insert into public.hq_operator(uid) values ('<your-auth-uid>');
--   2) (optional) enable the scheduler with pg_cron (see hq_broadcast_publish_due).
--      Without pg_cron, HQ can call hq_broadcast_publish_due() on load instead.
-- ============================================================
