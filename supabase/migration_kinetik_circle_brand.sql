-- ============================================================================
-- Kinetik Circle — brand sender for HQ-automated moments
-- ----------------------------------------------------------------------------
-- Moments posted from HQ's Content Builder are currently attributed to the
-- signed-in operator (kinetik_post_moment inserts author_id = auth.uid()). We
-- want every automated moment to read as "Kinetik Circle" instead of a personal
-- account. This migration:
--   1. Creates a dedicated "Kinetik Circle" identity (auth.users → profiles).
--   2. Adds kinetik_post_moment_as_brand(): same body as kinetik_post_moment,
--      but attributes the post to that brand profile. It STILL checks that the
--      operator is allowed to post in the circle (kinetik_can_post), so this
--      isn't a way to post somewhere you couldn't already.
-- The Kinetik feed resolves the author from a profiles join, so it will show
-- "Kinetik Circle" automatically — no change needed in the Kinetik app.
--
-- Run this in the Supabase SQL editor (this project has no exec_sql RPC).
-- Idempotent: safe to run more than once.
-- ============================================================================

-- Fixed, well-known id so both the profile and the RPC can reference it without
-- a round-trip. (Any stable uuid works; this one is memorable/branded.)
--   brand id = c1c1e000-0000-4000-8000-0000000000c1

-- 1a. System auth user. profiles.id references auth.users(id), so the identity
--     must exist there first. This is a non-login account (no password); the
--     handle_new_user trigger will seed a profiles row from the metadata below.
insert into auth.users (
  instance_id, id, aud, role, email,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  'c1c1e000-0000-4000-8000-0000000000c1',
  'authenticated', 'authenticated', 'kinetikcircle@brand.local',
  '{"provider":"system","providers":["system"]}',
  '{"display_name":"Kinetik Circle"}',
  now(), now()
) on conflict (id) do nothing;

-- 1b. Make sure the profile row exists and carries the brand name/avatar,
--     whether or not the trigger fired (belt and braces). Only touches the two
--     display fields so we don't collide with any role/username constraints.
insert into public.profiles (id, email, display_name)
values ('c1c1e000-0000-4000-8000-0000000000c1', 'kinetikcircle@brand.local', 'Kinetik Circle')
on conflict (id) do update set display_name = 'Kinetik Circle';

-- Optional: give the brand an avatar. Point this at a public image URL if you
-- have one (e.g. the KinetikCircle icon in a public bucket), then re-run.
-- update public.profiles
--   set photo_url = 'https://…/kinetik-circle-avatar.png'
--   where id = 'c1c1e000-0000-4000-8000-0000000000c1';

-- 2. Brand-authored post RPC. Byte-for-byte the same as kinetik_post_moment
--    (see supabase/kinetik/04_moments.sql) except author_id is the brand id.
create or replace function public.kinetik_post_moment_as_brand(
  p_circle uuid, p_kind text, p_body text, p_audience text default 'circle',
  p_audience_ids uuid[] default '{}', p_media jsonb default '[]', p_tags uuid[] default '{}',
  p_is_story boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; m jsonb; i int := 0;
  brand constant uuid := 'c1c1e000-0000-4000-8000-0000000000c1';
begin
  -- The OPERATOR must still be allowed to post here — the brand identity does
  -- not widen where you can publish, it only changes the displayed author.
  if not public.kinetik_can_post(p_circle) then raise exception 'not allowed to post here'; end if;
  insert into public.kinetik_post(circle_id, author_id, kind, body, audience, audience_ids, expires_at)
    values (p_circle, brand, coalesce(p_kind,'photo'), p_body, coalesce(p_audience,'circle'),
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

grant execute on function public.kinetik_post_moment_as_brand(uuid,text,text,text,uuid[],jsonb,uuid[],boolean) to authenticated;
