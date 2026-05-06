-- Work images: ensure bucket + anon read/upload (app uses custom auth, anon key for Supabase)
insert into storage.buckets (id, name, public)
values ('job-images', 'job-images', true)
on conflict (id) do update
set public = true;

drop policy if exists "job_images_insert_any" on storage.objects;
create policy "job_images_insert_any" on storage.objects
  for insert
  to public
  with check (bucket_id = 'job-images');

drop policy if exists "job_images_update_any" on storage.objects;
create policy "job_images_update_any" on storage.objects
  for update
  to public
  using (bucket_id = 'job-images')
  with check (bucket_id = 'job-images');

drop policy if exists "job_images_delete_any" on storage.objects;
create policy "job_images_delete_any" on storage.objects
  for delete
  to public
  using (bucket_id = 'job-images');

drop policy if exists "job_images_select_any" on storage.objects;
create policy "job_images_select_any" on storage.objects
  for select
  to public
  using (bucket_id = 'job-images');
