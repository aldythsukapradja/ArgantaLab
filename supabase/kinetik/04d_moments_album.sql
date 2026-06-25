-- ============================================================
--  KINETIK · MOMENTS · add-to-album RPC  — run AFTER 04_moments.sql
--  Direct INSERT into kinetik_album_item was being rejected by RLS;
--  this security-definer RPC checks membership itself and inserts,
--  so adding a moment to an album works reliably. Idempotent.
-- ============================================================
begin;

create or replace function public.kinetik_add_to_album(p_album uuid, p_post uuid)
returns void language plpgsql security definer set search_path = public as $$
declare acid uuid; pcid uuid;
begin
  select circle_id into acid from public.kinetik_album where id = p_album;
  select circle_id into pcid from public.kinetik_post  where id = p_post;
  if acid is null then raise exception 'album not found'; end if;
  if pcid is null then raise exception 'moment not found'; end if;
  if not public.kinetik_is_member(acid) then raise exception 'not a member of this circle'; end if;
  if acid <> pcid then raise exception 'that moment belongs to another circle'; end if;
  insert into public.kinetik_album_item(album_id, post_id) values (p_album, p_post)
    on conflict (album_id, post_id) do nothing;
end; $$;
grant execute on function public.kinetik_add_to_album(uuid, uuid) to authenticated;

commit;
