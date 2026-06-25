-- ============================================================
--  KINETIK · MOMENTS · album read (rich)  — run AFTER 04_moments.sql
--  Returns FULL post objects for an album (author, reactions, media…)
--  so the album opens like a story viewer. Replaces any earlier/partial
--  kinetik_album_posts. Also re-asserts kinetik_comments. Idempotent.
-- ============================================================
begin;

create or replace function public.kinetik_album_posts(p_album uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(r order by (r->>'created_at') desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', p.id, 'kind', p.kind, 'body', p.body, 'audience', p.audience,
      'created_at', p.created_at, 'reward_total', p.reward_total,
      'reaction_count', p.reaction_count, 'comment_count', p.comment_count,
      'author', jsonb_build_object('id', a.id, 'name', a.display_name, 'photo', a.photo_url, 'role', a.role),
      'media', (select coalesce(jsonb_agg(jsonb_build_object('kind',md.kind,'path',md.path,'w',md.width,'h',md.height,'duration',md.duration_ms) order by md.idx),'[]')
                from public.kinetik_post_media md where md.post_id = p.id),
      'tags', (select coalesce(jsonb_agg(t.member_id),'[]') from public.kinetik_post_tag t where t.post_id = p.id),
      'reactions', (select coalesce(jsonb_object_agg(e.emoji, e.n),'{}') from
                     (select emoji, count(*) n from public.kinetik_reaction rr where rr.post_id = p.id group by emoji) e),
      'my_reaction', (select emoji from public.kinetik_reaction rr where rr.post_id = p.id and rr.user_id = auth.uid()),
      'reactors', '[]'::jsonb
    ) r
    from public.kinetik_album_item ai
    join public.kinetik_post p on p.id = ai.post_id
    join public.profiles a on a.id = p.author_id
    where ai.album_id = p_album
      and exists(select 1 from public.kinetik_album al where al.id = p_album and public.kinetik_is_member(al.circle_id))
  ) q;
$$;
grant execute on function public.kinetik_album_posts(uuid) to authenticated;

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

commit;
