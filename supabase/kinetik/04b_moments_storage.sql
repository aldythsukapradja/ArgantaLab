-- ============================================================
--  KINETIK · MOMENTS STORAGE RLS  — run AFTER creating the bucket
--
--  1) In the Supabase dashboard → Storage → New bucket:
--       name = moments   ·   Public = OFF (private)
--       (optional) file size limit ~50 MB; allowed mime image/*, video/*
--  2) Then run this file. Media is addressed as:  <circle_id>/<post_id>/<file>
--     so the first path folder is the circle, and access = circle membership.
--  Idempotent.
-- ============================================================
begin;

drop policy if exists moments_read  on storage.objects;
create policy moments_read on storage.objects for select to authenticated using (
  bucket_id = 'moments' and public.kinetik_is_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists moments_write on storage.objects;
create policy moments_write on storage.objects for insert to authenticated with check (
  bucket_id = 'moments' and public.kinetik_can_post(((storage.foldername(name))[1])::uuid)
);

drop policy if exists moments_del on storage.objects;
create policy moments_del on storage.objects for delete to authenticated using (
  bucket_id = 'moments' and public.kinetik_can_post(((storage.foldername(name))[1])::uuid)
);

commit;
