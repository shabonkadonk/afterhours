-- Repair owner membership for rolls created before the owner trigger completed,
-- and explicitly allow both the owner and members to upload while a roll is open.
insert into public.roll_members (roll_id, user_id, display_name, role)
select r.id, r.owner_id, coalesce(p.display_name, ''), 'owner'
from public.rolls r
left join public.profiles p on p.id = r.owner_id
on conflict (roll_id, user_id) do nothing;

drop policy if exists "Members upload to active rolls" on storage.objects;
create policy "Members and owners upload to active rolls" on storage.objects
for insert to authenticated with check (
  bucket_id = 'roll-photos'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (
    public.is_roll_member(((storage.foldername(name))[1])::uuid)
    or public.is_roll_owner(((storage.foldername(name))[1])::uuid)
  )
  and exists (
    select 1 from public.rolls r
    where r.id = ((storage.foldername(storage.objects.name))[1])::uuid
      and r.status = 'active' and r.photo_count < r.photo_limit
  )
);

drop policy if exists "Members add photos to active rolls" on public.photos;
create policy "Members and owners add photos to active rolls" on public.photos
for insert to authenticated with check (
  uploaded_by = (select auth.uid())
  and (public.is_roll_member(roll_id) or public.is_roll_owner(roll_id))
  and exists (
    select 1 from public.rolls r
    where r.id = photos.roll_id and r.status = 'active'
  )
);
