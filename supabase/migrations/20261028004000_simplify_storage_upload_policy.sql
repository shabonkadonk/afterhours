-- Keep file uploads inside each authenticated user's private folder.
-- public.photos RLS and its frame-count trigger still enforce roll membership,
-- roll status, ownership, and frame limits before a photo can be attached.
drop policy if exists "Members and owners upload to active rolls" on storage.objects;
create policy "Users upload to their own private folder" on storage.objects
for insert to authenticated with check (
  bucket_id = 'roll-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
