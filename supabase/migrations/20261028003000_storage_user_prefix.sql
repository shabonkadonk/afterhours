-- Store each uploaded object under the authenticated user's ID. The roll ID is
-- the second folder, and metadata RLS continues to enforce roll membership.
drop policy if exists "Members and owners upload to active rolls" on storage.objects;
drop policy if exists "Members view files after reveal" on storage.objects;
drop policy if exists "Uploader or owner deletes files" on storage.objects;

create policy "Members and owners upload to active rolls" on storage.objects
for insert to authenticated with check (
  bucket_id = 'roll-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and exists (
    select 1 from public.rolls r
    where r.id = ((storage.foldername(storage.objects.name))[2])::uuid
      and r.status = 'active' and r.photo_count < r.photo_limit
      and (
        r.owner_id = (select auth.uid())
        or public.is_roll_member(r.id)
      )
  )
);

create policy "Members view files after reveal" on storage.objects
for select to authenticated using (
  bucket_id = 'roll-photos'
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and exists (
    select 1 from public.rolls r
    where r.id = ((storage.foldername(storage.objects.name))[2])::uuid and r.status = 'revealed'
      and (r.owner_id = (select auth.uid()) or public.is_roll_member(r.id))
  )
);

create policy "Uploader or owner deletes files" on storage.objects
for delete to authenticated using (
  bucket_id = 'roll-photos'
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (
    owner_id = (select auth.uid())::text
    or exists (
      select 1 from public.rolls r
      where r.id = ((storage.foldername(storage.objects.name))[2])::uuid and r.owner_id = (select auth.uid())
    )
  )
);
