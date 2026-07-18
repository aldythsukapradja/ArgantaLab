-- Public bucket for Arganta Chat's composed story images. Buffer needs a public
-- image URL to attach to a queued post; the browser renders a branded card,
-- uploads it here, and hands the public URL to the arganta-publish edge function.
insert into storage.buckets (id, name, public)
values ('arganta-posts', 'arganta-posts', true)
on conflict (id) do nothing;

-- Any signed-in parent may upload their own post images; anyone may read (public).
drop policy if exists arganta_posts_read on storage.objects;
create policy arganta_posts_read on storage.objects
  for select using (bucket_id = 'arganta-posts');

drop policy if exists arganta_posts_write on storage.objects;
create policy arganta_posts_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'arganta-posts'
    and coalesce(auth.email() not like '%@kids.argantalab.app', false)
  );
