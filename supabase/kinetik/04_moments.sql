-- ============================================================
--  KINETIK · MOMENTS  ("Remember" pillar)  — run AFTER 01_schema.sql
--
--  The private family social layer: posts (photo/video/story), media,
--  reactions, comments, tags, albums, milestones — all circle-scoped,
--  real-identity (profiles), with viewers (grandparents) read+react only.
--
--  Authors / tags / reactors are REAL `profiles` (not kinetik_people).
--  Idempotent. Safe to re-run.
-- ============================================================
begin;

-- ── 0. Membership helpers ─────────────────────────────────────
-- Any role (owner/coleader/member/kid/viewer) = can READ.
create or replace function public.kinetik_is_member(p_circle uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.circles c where c.id = p_circle and c.owner_id = auth.uid())
      or exists(select 1 from public.circle_members m where m.circle_id = p_circle and m.member_id = auth.uid());
$$;
grant execute on function public.kinetik_is_member(uuid) to authenticated;

-- Everyone EXCEPT viewers can POST.
create or replace function public.kinetik_can_post(p_circle uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.circles c where c.id = p_circle and c.owner_id = auth.uid())
      or exists(select 1 from public.circle_members m
                where m.circle_id = p_circle and m.member_id = auth.uid()
                  and coalesce(m.role,'member') <> 'viewer');
$$;
grant execute on function public.kinetik_can_post(uuid) to authenticated;

-- ── 1. Tables ─────────────────────────────────────────────────
create table if not exists public.kinetik_post (
  id            uuid primary key default gen_random_uuid(),
  circle_id     uuid not null references public.circles(id) on delete cascade,
  author_id     uuid not null references public.profiles(id) on delete cascade,
  kind          text not null default 'photo' check (kind in ('photo','video','story','text')),
  body          text,
  audience      text not null default 'circle' check (audience in ('circle','grownups','custom')),
  audience_ids  uuid[] not null default '{}',          -- for 'custom'
  reward_total  int  not null default 0,
  reaction_count int not null default 0,
  comment_count int  not null default 0,
  expires_at    timestamptz,                           -- set for stories (now()+24h)
  created_at    timestamptz not null default now()
);
create index if not exists kinetik_post_circle_idx on public.kinetik_post(circle_id, created_at desc);
create index if not exists kinetik_post_kind_idx   on public.kinetik_post(circle_id, kind, created_at desc);

create table if not exists public.kinetik_post_media (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.kinetik_post(id) on delete cascade,
  idx         int  not null default 0,
  kind        text not null default 'photo' check (kind in ('photo','video')),
  path        text not null,                           -- storage path in the 'moments' bucket
  width       int, height int, duration_ms int
);
create index if not exists kinetik_post_media_idx on public.kinetik_post_media(post_id, idx);

create table if not exists public.kinetik_post_tag (
  post_id   uuid not null references public.kinetik_post(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  primary key (post_id, member_id)
);

create table if not exists public.kinetik_reaction (
  post_id    uuid not null references public.kinetik_post(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)                       -- one (replaceable) reaction per user
);

create table if not exists public.kinetik_comment (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.kinetik_post(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  parent_id  uuid references public.kinetik_comment(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists kinetik_comment_post_idx on public.kinetik_comment(post_id, created_at);

create table if not exists public.kinetik_post_view (
  post_id   uuid not null references public.kinetik_post(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.kinetik_album (
  id         uuid primary key default gen_random_uuid(),
  circle_id  uuid not null references public.circles(id) on delete cascade,
  title      text not null,
  cover_path text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.kinetik_album_item (
  album_id uuid not null references public.kinetik_album(id) on delete cascade,
  post_id  uuid not null references public.kinetik_post(id) on delete cascade,
  primary key (album_id, post_id)
);

create table if not exists public.kinetik_milestone (
  id         uuid primary key default gen_random_uuid(),
  circle_id  uuid not null references public.circles(id) on delete cascade,
  kid_id     uuid references public.profiles(id) on delete set null,
  author_id  uuid references public.profiles(id) on delete set null,
  title      text not null,
  body       text,
  kind       text not null default 'manual' check (kind in ('manual','learn')),
  ref        text,                                      -- e.g. 'tier:builder' or 'world:NUM'
  diamonds   int  not null default 0,
  media_path text,
  created_at timestamptz not null default now()
);
create index if not exists kinetik_milestone_circle_idx on public.kinetik_milestone(circle_id, created_at desc);

-- ── 2. Count-maintenance triggers ─────────────────────────────
create or replace function public.kinetik_bump_reaction() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then update public.kinetik_post set reaction_count = reaction_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then update public.kinetik_post set reaction_count = greatest(reaction_count - 1,0) where id = old.post_id;
  end if; return null;
end; $$;
drop trigger if exists kinetik_reaction_count on public.kinetik_reaction;
create trigger kinetik_reaction_count after insert or delete on public.kinetik_reaction
  for each row execute function public.kinetik_bump_reaction();

create or replace function public.kinetik_bump_comment() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then update public.kinetik_post set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then update public.kinetik_post set comment_count = greatest(comment_count - 1,0) where id = old.post_id;
  end if; return null;
end; $$;
drop trigger if exists kinetik_comment_count on public.kinetik_comment;
create trigger kinetik_comment_count after insert or delete on public.kinetik_comment
  for each row execute function public.kinetik_bump_comment();

-- ── 3. RLS ────────────────────────────────────────────────────
do $$ declare t text; begin
  foreach t in array array['kinetik_post','kinetik_post_media','kinetik_post_tag','kinetik_reaction',
                           'kinetik_comment','kinetik_post_view','kinetik_album','kinetik_album_item','kinetik_milestone']
  loop execute format('alter table public.%I enable row level security;', t); end loop;
end $$;

-- posts: members read; non-viewers insert their own; author/owner delete
drop policy if exists kpost_read on public.kinetik_post;
create policy kpost_read on public.kinetik_post for select using (public.kinetik_is_member(circle_id));
drop policy if exists kpost_write on public.kinetik_post;
create policy kpost_write on public.kinetik_post for insert with check (author_id = auth.uid() and public.kinetik_can_post(circle_id));
drop policy if exists kpost_del on public.kinetik_post;
create policy kpost_del on public.kinetik_post for delete using (
  author_id = auth.uid() or exists(select 1 from public.circles c where c.id = circle_id and c.owner_id = auth.uid()));

-- helper: membership via a post's circle (for child tables)
create or replace function public.kinetik_post_member(p_post uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.kinetik_post p where p.id = p_post and public.kinetik_is_member(p.circle_id));
$$;
grant execute on function public.kinetik_post_member(uuid) to authenticated;
create or replace function public.kinetik_post_poster(p_post uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.kinetik_post p where p.id = p_post and public.kinetik_can_post(p.circle_id));
$$;
grant execute on function public.kinetik_post_poster(uuid) to authenticated;

-- media / tags: read = member; write = can-post
drop policy if exists kmedia_read on public.kinetik_post_media;
create policy kmedia_read on public.kinetik_post_media for select using (public.kinetik_post_member(post_id));
drop policy if exists kmedia_write on public.kinetik_post_media;
create policy kmedia_write on public.kinetik_post_media for all using (public.kinetik_post_poster(post_id)) with check (public.kinetik_post_poster(post_id));
drop policy if exists ktag_read on public.kinetik_post_tag;
create policy ktag_read on public.kinetik_post_tag for select using (public.kinetik_post_member(post_id));
drop policy if exists ktag_write on public.kinetik_post_tag;
create policy ktag_write on public.kinetik_post_tag for all using (public.kinetik_post_poster(post_id)) with check (public.kinetik_post_poster(post_id));

-- reactions / comments / views: ANY member (incl viewers) may add their own
drop policy if exists kreact_read on public.kinetik_reaction;
create policy kreact_read on public.kinetik_reaction for select using (public.kinetik_post_member(post_id));
drop policy if exists kreact_write on public.kinetik_reaction;
create policy kreact_write on public.kinetik_reaction for all using (user_id = auth.uid() and public.kinetik_post_member(post_id)) with check (user_id = auth.uid() and public.kinetik_post_member(post_id));
drop policy if exists kcom_read on public.kinetik_comment;
create policy kcom_read on public.kinetik_comment for select using (public.kinetik_post_member(post_id));
drop policy if exists kcom_write on public.kinetik_comment;
create policy kcom_write on public.kinetik_comment for insert with check (author_id = auth.uid() and public.kinetik_post_member(post_id));
drop policy if exists kcom_del on public.kinetik_comment;
create policy kcom_del on public.kinetik_comment for delete using (author_id = auth.uid());
drop policy if exists kview_rw on public.kinetik_post_view;
create policy kview_rw on public.kinetik_post_view for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- albums / milestones: members read; can-post write; owner delete
drop policy if exists kalb_read on public.kinetik_album;
create policy kalb_read on public.kinetik_album for select using (public.kinetik_is_member(circle_id));
drop policy if exists kalb_write on public.kinetik_album;
create policy kalb_write on public.kinetik_album for all using (public.kinetik_can_post(circle_id)) with check (public.kinetik_can_post(circle_id));
drop policy if exists kalbi_rw on public.kinetik_album_item;
create policy kalbi_rw on public.kinetik_album_item for all using (public.kinetik_post_poster(post_id)) with check (public.kinetik_post_poster(post_id));
drop policy if exists kms_read on public.kinetik_milestone;
create policy kms_read on public.kinetik_milestone for select using (public.kinetik_is_member(circle_id));
drop policy if exists kms_write on public.kinetik_milestone;
create policy kms_write on public.kinetik_milestone for all using (public.kinetik_can_post(circle_id)) with check (public.kinetik_can_post(circle_id));

-- ── 4. Write RPCs ─────────────────────────────────────────────
-- Create a post (+media +tags) atomically. media = [{kind,path,width,height,duration_ms}].
create or replace function public.kinetik_post_moment(
  p_circle uuid, p_kind text, p_body text, p_audience text default 'circle',
  p_audience_ids uuid[] default '{}', p_media jsonb default '[]', p_tags uuid[] default '{}',
  p_is_story boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; m jsonb; i int := 0;
begin
  if not public.kinetik_can_post(p_circle) then raise exception 'not allowed to post here'; end if;
  insert into public.kinetik_post(circle_id, author_id, kind, body, audience, audience_ids, expires_at)
    values (p_circle, auth.uid(), coalesce(p_kind,'photo'), p_body, coalesce(p_audience,'circle'),
            coalesce(p_audience_ids,'{}'), case when p_is_story then now() + interval '24 hours' else null end)
    returning id into pid;
  for m in select * from jsonb_array_elements(coalesce(p_media,'[]'::jsonb)) loop
    insert into public.kinetik_post_media(post_id, idx, kind, path, width, height, duration_ms)
      values (pid, i, coalesce(m->>'kind','photo'), m->>'path',
              nullif(m->>'width','')::int, nullif(m->>'height','')::int, nullif(m->>'duration_ms','')::int);
    i := i + 1;
  end loop;
  if array_length(p_tags,1) is not null then
    insert into public.kinetik_post_tag(post_id, member_id)
      select pid, t from unnest(p_tags) t on conflict do nothing;
  end if;
  return pid;
end; $$;
grant execute on function public.kinetik_post_moment(uuid,text,text,text,uuid[],jsonb,uuid[],boolean) to authenticated;

-- Toggle / set a reaction (pass null emoji to remove).
create or replace function public.kinetik_toggle_reaction(p_post uuid, p_emoji text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.kinetik_post_member(p_post) then raise exception 'not a member'; end if;
  if p_emoji is null then
    delete from public.kinetik_reaction where post_id = p_post and user_id = auth.uid();
  else
    insert into public.kinetik_reaction(post_id, user_id, emoji) values (p_post, auth.uid(), p_emoji)
      on conflict (post_id, user_id) do update set emoji = excluded.emoji, created_at = now();
  end if;
end; $$;
grant execute on function public.kinetik_toggle_reaction(uuid,text) to authenticated;

create or replace function public.kinetik_add_comment(p_post uuid, p_body text, p_parent uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if not public.kinetik_post_member(p_post) then raise exception 'not a member'; end if;
  if coalesce(trim(p_body),'') = '' then raise exception 'empty comment'; end if;
  insert into public.kinetik_comment(post_id, author_id, parent_id, body)
    values (p_post, auth.uid(), p_parent, trim(p_body)) returning id into cid;
  return cid;
end; $$;
grant execute on function public.kinetik_add_comment(uuid,text,uuid) to authenticated;

-- Reward a moment: give p_amount diamonds to EACH tagged member, debited from the caller.
-- NOTE: adjusts profiles.diamonds directly. If you keep a diamond ledger
-- (adjust_kid_diamonds), tell me its signature and I'll route through it.
create or replace function public.kinetik_reward_moment(p_post uuid, p_amount int)
returns int language plpgsql security definer set search_path = public as $$
declare recips uuid[]; total int; bal int;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;
  if not public.kinetik_post_member((select circle_id from public.kinetik_post where id = p_post)) then
    raise exception 'not a member'; end if;
  select array_agg(member_id) into recips from public.kinetik_post_tag where post_id = p_post;
  if recips is null or array_length(recips,1) is null then raise exception 'tag someone to reward'; end if;
  total := p_amount * array_length(recips,1);
  select diamonds into bal from public.profiles where id = auth.uid();
  if coalesce(bal,0) < total then raise exception 'not enough diamonds'; end if;
  update public.profiles set diamonds = diamonds - total where id = auth.uid();
  update public.profiles set diamonds = coalesce(diamonds,0) + p_amount where id = any(recips);
  update public.kinetik_post set reward_total = reward_total + total where id = p_post;
  return total;
end; $$;
grant execute on function public.kinetik_reward_moment(uuid,int) to authenticated;

create or replace function public.kinetik_mark_story_viewed(p_post uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.kinetik_post_member(p_post) then return; end if;
  insert into public.kinetik_post_view(post_id, user_id) values (p_post, auth.uid()) on conflict do nothing;
end; $$;
grant execute on function public.kinetik_mark_story_viewed(uuid) to authenticated;

create or replace function public.kinetik_create_album(p_circle uuid, p_title text, p_post_ids uuid[] default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare aid uuid;
begin
  if not public.kinetik_can_post(p_circle) then raise exception 'not allowed'; end if;
  insert into public.kinetik_album(circle_id, title, created_by) values (p_circle, p_title, auth.uid()) returning id into aid;
  if array_length(p_post_ids,1) is not null then
    insert into public.kinetik_album_item(album_id, post_id) select aid, p from unnest(p_post_ids) p on conflict do nothing;
  end if;
  return aid;
end; $$;
grant execute on function public.kinetik_create_album(uuid,text,uuid[]) to authenticated;

create or replace function public.kinetik_add_milestone(
  p_circle uuid, p_title text, p_body text default null, p_kid uuid default null, p_media_path text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare mid uuid;
begin
  if not public.kinetik_can_post(p_circle) then raise exception 'not allowed'; end if;
  insert into public.kinetik_milestone(circle_id, kid_id, author_id, title, body, kind, media_path)
    values (p_circle, p_kid, auth.uid(), p_title, p_body, 'manual', p_media_path) returning id into mid;
  return mid;
end; $$;
grant execute on function public.kinetik_add_milestone(uuid,text,text,uuid,text) to authenticated;

-- ── 5. Read RPCs (security-definer → can join author profiles past per-row RLS) ──
-- Feed / Videos: p_kind null = feed (photo+video+text, no stories); 'video' = reels.
create or replace function public.kinetik_feed(p_circle uuid, p_kind text default null, p_limit int default 20, p_before timestamptz default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(r), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', p.id, 'kind', p.kind, 'body', p.body, 'audience', p.audience,
      'created_at', p.created_at, 'reward_total', p.reward_total,
      'reaction_count', p.reaction_count, 'comment_count', p.comment_count,
      'author', jsonb_build_object('id', a.id, 'name', a.display_name, 'photo', a.photo_url, 'role', a.role),
      'media', (select coalesce(jsonb_agg(jsonb_build_object('kind',md.kind,'path',md.path,'w',md.width,'h',md.height,'duration',md.duration_ms) order by md.idx),'[]')
                from public.kinetik_post_media md where md.post_id = p.id),
      'tags',  (select coalesce(jsonb_agg(t.member_id),'[]') from public.kinetik_post_tag t where t.post_id = p.id),
      'reactions', (select coalesce(jsonb_object_agg(e.emoji, e.n),'{}') from
                     (select emoji, count(*) n from public.kinetik_reaction rr where rr.post_id = p.id group by emoji) e),
      'my_reaction', (select emoji from public.kinetik_reaction rr where rr.post_id = p.id and rr.user_id = auth.uid()),
      'reactors', (select coalesce(jsonb_agg(jsonb_build_object('name',pr.display_name,'photo',pr.photo_url)),'[]')
                   from (select user_id from public.kinetik_reaction rr where rr.post_id = p.id order by created_at desc limit 3) top
                   join public.profiles pr on pr.id = top.user_id)
    ) r
    from public.kinetik_post p join public.profiles a on a.id = p.author_id
    where p.circle_id = p_circle and public.kinetik_is_member(p_circle) and p.kind <> 'story'
      and (p.expires_at is null or p.expires_at > now())
      and (p_kind is null or p.kind = p_kind)
      and (p_before is null or p.created_at < p_before)
      and (p.audience = 'circle'
           or (p.audience = 'grownups' and coalesce((select role from public.profiles where id = auth.uid()),'') <> 'kid')
           or (p.audience = 'custom' and (auth.uid() = p.author_id or auth.uid() = any(p.audience_ids))))
    order by p.created_at desc
    limit greatest(1, least(coalesce(p_limit,20), 50))
  ) q;
$$;
grant execute on function public.kinetik_feed(uuid,text,int,timestamptz) to authenticated;

-- Active stories grouped by author (last 24h, unexpired).
create or replace function public.kinetik_stories(p_circle uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(r order by (r->>'last') desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'author', jsonb_build_object('id', a.id, 'name', a.display_name, 'photo', a.photo_url, 'role', a.role),
      'last', max(p.created_at),
      'seen', bool_and(exists(select 1 from public.kinetik_post_view v where v.post_id = p.id and v.user_id = auth.uid())),
      'items', jsonb_agg(jsonb_build_object('id', p.id, 'body', p.body, 'created_at', p.created_at,
                 'media',(select coalesce(jsonb_agg(jsonb_build_object('kind',md.kind,'path',md.path) order by md.idx),'[]')
                          from public.kinetik_post_media md where md.post_id = p.id)) order by p.created_at)
    ) r
    from public.kinetik_post p join public.profiles a on a.id = p.author_id
    where p.circle_id = p_circle and public.kinetik_is_member(p_circle)
      and p.kind = 'story' and (p.expires_at is null or p.expires_at > now())
    group by a.id, a.display_name, a.photo_url, a.role
  ) q;
$$;
grant execute on function public.kinetik_stories(uuid) to authenticated;

-- Albums: manual albums with cover + count.
create or replace function public.kinetik_albums(p_circle uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', al.id, 'title', al.title, 'cover_path', al.cover_path, 'created_at', al.created_at,
    'count', (select count(*) from public.kinetik_album_item ai where ai.album_id = al.id)
  ) order by al.created_at desc), '[]'::jsonb)
  from public.kinetik_album al where al.circle_id = p_circle and public.kinetik_is_member(p_circle);
$$;
grant execute on function public.kinetik_albums(uuid) to authenticated;

create or replace function public.kinetik_milestones(p_circle uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ms.id, 'title', ms.title, 'body', ms.body, 'kind', ms.kind, 'ref', ms.ref,
    'diamonds', ms.diamonds, 'media_path', ms.media_path, 'created_at', ms.created_at,
    'kid', (select jsonb_build_object('id', k.id, 'name', k.display_name, 'photo', k.photo_url) from public.profiles k where k.id = ms.kid_id),
    'author', (select jsonb_build_object('id', au.id, 'name', au.display_name) from public.profiles au where au.id = ms.author_id)
  ) order by ms.created_at desc), '[]'::jsonb)
  from public.kinetik_milestone ms where ms.circle_id = p_circle and public.kinetik_is_member(p_circle);
$$;
grant execute on function public.kinetik_milestones(uuid) to authenticated;

-- Comments for a post (with author identity past per-row profile RLS).
create or replace function public.kinetik_comments(p_post uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'body', c.body, 'parent_id', c.parent_id, 'created_at', c.created_at,
    'author', jsonb_build_object('id', a.id, 'name', a.display_name, 'photo', a.photo_url)
  ) order by c.created_at), '[]'::jsonb)
  from public.kinetik_comment c join public.profiles a on a.id = c.author_id
  where c.post_id = p_post and public.kinetik_post_member(p_post);
$$;
grant execute on function public.kinetik_comments(uuid) to authenticated;

-- Posts inside a manual album (thumbnails).
create or replace function public.kinetik_album_posts(p_album uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'kind', p.kind, 'created_at', p.created_at,
    'media', (select coalesce(jsonb_agg(jsonb_build_object('kind',md.kind,'path',md.path) order by md.idx),'[]')
              from public.kinetik_post_media md where md.post_id = p.id)
  ) order by p.created_at desc), '[]'::jsonb)
  from public.kinetik_album_item ai join public.kinetik_post p on p.id = ai.post_id
  where ai.album_id = p_album
    and exists(select 1 from public.kinetik_album al where al.id = p_album and public.kinetik_is_member(al.circle_id));
$$;
grant execute on function public.kinetik_album_posts(uuid) to authenticated;

commit;
-- ============================================================
--  AFTER deploying this, create a Storage bucket named `moments`
--  (private), then run 04b_moments_storage.sql for its RLS.
-- ============================================================
