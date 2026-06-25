-- ============================================================
--  KINETIK · MOMENTS · edit support  — run AFTER 04_moments.sql
--  Lets the author (or circle owner) edit a moment's caption and/or
--  its date, so moments can be backdated into albums & the timeline.
--  Idempotent.
-- ============================================================
begin;

create or replace function public.kinetik_update_post(
  p_post uuid, p_body text default null, p_created_at timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
declare cid uuid; aid uuid;
begin
  select circle_id, author_id into cid, aid from public.kinetik_post where id = p_post;
  if cid is null then raise exception 'moment not found'; end if;
  if not (aid = auth.uid() or exists(select 1 from public.circles c where c.id = cid and c.owner_id = auth.uid())) then
    raise exception 'not allowed';
  end if;
  update public.kinetik_post set
    body       = coalesce(p_body, body),
    created_at = coalesce(p_created_at, created_at)
  where id = p_post;
end; $$;
grant execute on function public.kinetik_update_post(uuid, text, timestamptz) to authenticated;

-- Edit a milestone (title / note / kid / date). Author or circle owner only.
create or replace function public.kinetik_update_milestone(
  p_id uuid, p_title text default null, p_body text default null,
  p_kid uuid default null, p_created_at timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
declare cid uuid; aid uuid;
begin
  select circle_id, author_id into cid, aid from public.kinetik_milestone where id = p_id;
  if cid is null then raise exception 'milestone not found'; end if;
  if not (aid = auth.uid() or exists(select 1 from public.circles c where c.id = cid and c.owner_id = auth.uid())) then
    raise exception 'not allowed';
  end if;
  update public.kinetik_milestone set
    title      = coalesce(p_title, title),
    body       = coalesce(p_body, body),
    kid_id     = coalesce(p_kid, kid_id),
    created_at = coalesce(p_created_at, created_at)
  where id = p_id;
end; $$;
grant execute on function public.kinetik_update_milestone(uuid, text, text, uuid, timestamptz) to authenticated;

commit;
