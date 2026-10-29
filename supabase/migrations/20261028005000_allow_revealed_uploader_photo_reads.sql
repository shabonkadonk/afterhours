-- In the policy subquery, `name` would resolve to public.rolls.name instead of
-- storage.objects.name. Qualify the object path so foldername() sees the file
-- key and the matching roll UUID.
drop policy if exists "Members view files after reveal" on storage.objects;
create policy "Members view files after reveal" on storage.objects
for select to authenticated using (
  bucket_id = 'roll-photos'
  and (storage.foldername(storage.objects.name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and exists (
    select 1 from public.rolls r
    where r.id = ((storage.foldername(storage.objects.name))[2])::uuid
      and r.status = 'revealed'
      and (r.owner_id = (select auth.uid()) or public.is_roll_member(r.id))
  )
);
