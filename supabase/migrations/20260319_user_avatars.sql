-- User avatars: column + storage bucket + permissive policies
-- Run in Supabase SQL editor, or via supabase migrations.
--
-- NOTE: This app currently doesn't use Supabase Auth (no JWT), so any RLS-based restriction
-- by role/user isn't possible. Policies below are intentionally permissive so the mobile app
-- (anon key) can upload and read avatars.

alter table public.users
add column if not exists avatar_url text null;

-- Storage bucket (public read)
insert into storage.buckets (id, name, public)
values ('user-avatars', 'user-avatars', true)
on conflict (id) do update
set public = excluded.public;

-- Allow anon uploads/updates/deletes within this bucket only
drop policy if exists "user_avatars_insert_any" on storage.objects;
create policy "user_avatars_insert_any" on storage.objects
  for insert
  with check (bucket_id = 'user-avatars');

drop policy if exists "user_avatars_update_any" on storage.objects;
create policy "user_avatars_update_any" on storage.objects
  for update
  using (bucket_id = 'user-avatars')
  with check (bucket_id = 'user-avatars');

drop policy if exists "user_avatars_delete_any" on storage.objects;
create policy "user_avatars_delete_any" on storage.objects
  for delete
  using (bucket_id = 'user-avatars');

