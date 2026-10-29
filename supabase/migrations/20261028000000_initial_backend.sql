-- Afterhours shared rolls backend. Run with the Supabase SQL editor or CLI.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table public.rolls (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 48),
  theme text not null default 'After dark',
  status text not null default 'active' check (status in ('active', 'revealed')),
  created_at timestamptz not null default now(),
  ends_at timestamptz not null,
  photo_limit integer not null default 24 check (photo_limit in (12, 24, 36)),
  photo_count integer not null default 0 check (photo_count >= 0 and photo_count <= photo_limit),
  invite_code text not null unique default upper(encode(extensions.gen_random_bytes(5), 'hex'))
);

create table public.roll_members (
  roll_id uuid not null references public.rolls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (roll_id, user_id)
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  roll_id uuid not null references public.rolls(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  object_path text not null unique,
  original_object_path text,
  caption text not null default '' check (char_length(caption) <= 120),
  filter text,
  filter_version integer,
  date_stamp_year text check (date_stamp_year in ('current', '2006')),
  created_at timestamptz not null default now()
);

create index rolls_owner_created_idx on public.rolls(owner_id, created_at desc);
create index roll_members_user_idx on public.roll_members(user_id, joined_at desc);
create index photos_roll_created_idx on public.photos(roll_id, created_at);

create function public.is_roll_member(target_roll_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.roll_members rm
    where rm.roll_id = target_roll_id and rm.user_id = (select auth.uid())
  );
$$;

create function public.is_roll_owner(target_roll_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.rolls r
    where r.id = target_roll_id and r.owner_id = (select auth.uid())
  );
$$;

create function public.create_profile_for_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger auth_user_created_profile after insert on auth.users
for each row execute function public.create_profile_for_user();
insert into public.profiles(id, display_name)
select id, coalesce(raw_user_meta_data ->> 'display_name', '') from auth.users
on conflict (id) do nothing;

create function public.add_roll_owner_member()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.roll_members(roll_id, user_id, display_name, role)
  select new.id, new.owner_id, p.display_name, 'owner'
  from public.profiles p where p.id = new.owner_id;
  return new;
end;
$$;
create trigger rolls_add_owner_member after insert on public.rolls
for each row execute function public.add_roll_owner_member();

create function public.join_roll_by_invite_code(code text, member_name text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare target_roll_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to join a roll.' using errcode = '28000';
  end if;
  select r.id into target_roll_id from public.rolls r
  where r.invite_code = upper(trim(code));
  if target_roll_id is null then
    raise exception 'That invite code is not valid.' using errcode = 'P0002';
  end if;
  insert into public.roll_members(roll_id, user_id, display_name)
  values (target_roll_id, (select auth.uid()), left(trim(coalesce(member_name, '')), 48))
  on conflict (roll_id, user_id) do nothing;
  return target_roll_id;
end;
$$;

create function public.close_roll(target_roll_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_roll_member(target_roll_id) then
    raise exception 'That roll is not available.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.rolls r where r.id = target_roll_id and r.status = 'revealed') then
    return;
  end if;
  update public.rolls r set status = 'revealed'
  where r.id = target_roll_id and r.status = 'active'
    and (r.owner_id = (select auth.uid()) or r.ends_at <= now());
  if not found then
    raise exception 'You cannot close this roll yet.' using errcode = '42501';
  end if;
end;
$$;

create function public.track_roll_photo_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.rolls r set photo_count = r.photo_count + 1
    where r.id = new.roll_id and r.status = 'active' and r.photo_count < r.photo_limit;
    if not found then
      raise exception 'This roll is closed or has no frames left.' using errcode = '23514';
    end if;
    return new;
  end if;
  update public.rolls r set photo_count = greatest(0, r.photo_count - 1)
  where r.id = old.roll_id;
  return old;
end;
$$;
create trigger photos_track_roll_count_insert before insert on public.photos
for each row execute function public.track_roll_photo_count();
create trigger photos_track_roll_count_delete after delete on public.photos
for each row execute function public.track_roll_photo_count();

alter table public.profiles enable row level security;
alter table public.rolls enable row level security;
alter table public.roll_members enable row level security;
alter table public.photos enable row level security;

create policy "Profiles visible to self and roll members" on public.profiles
for select to authenticated using (
  id = (select auth.uid()) or exists (
    select 1 from public.roll_members mine
    join public.roll_members theirs on theirs.roll_id = mine.roll_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
  )
);
create policy "Users create their profile" on public.profiles
for insert to authenticated with check (id = (select auth.uid()));
create policy "Users update their profile" on public.profiles
for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "Owners and members view rolls" on public.rolls
for select to authenticated using (owner_id = (select auth.uid()) or public.is_roll_member(id));
create policy "Users create rolls" on public.rolls
for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners update rolls" on public.rolls
for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Owners delete rolls" on public.rolls
for delete to authenticated using (owner_id = (select auth.uid()));

create policy "Members view membership" on public.roll_members
for select to authenticated using (public.is_roll_member(roll_id));

create policy "Members view photos after reveal" on public.photos
for select to authenticated using (public.is_roll_member(roll_id));
create policy "Members add photos to active rolls" on public.photos
for insert to authenticated with check (
  uploaded_by = (select auth.uid()) and public.is_roll_member(roll_id)
  and exists (select 1 from public.rolls r where r.id = photos.roll_id and r.status = 'active')
);
create policy "Uploader or owner removes photos" on public.photos
for delete to authenticated using (
  uploaded_by = (select auth.uid()) or public.is_roll_owner(roll_id)
);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('roll-photos', 'roll-photos', false, 15728640, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 15728640,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create policy "Members upload to active rolls" on storage.objects
for insert to authenticated with check (
  bucket_id = 'roll-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "Members view files after reveal" on storage.objects
for select to authenticated using (
  bucket_id = 'roll-photos'
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and exists (
    select 1 from public.rolls r where r.id = ((storage.foldername(storage.objects.name))[2])::uuid
      and r.status = 'revealed'
      and (
        r.owner_id = (select auth.uid())
        or public.is_roll_member(r.id)
      )
  )
);
create policy "Uploader or owner deletes files" on storage.objects
for delete to authenticated using (
  bucket_id = 'roll-photos'
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (
    owner_id = (select auth.uid())::text
    or exists (select 1 from public.rolls r where r.id = ((storage.foldername(storage.objects.name))[2])::uuid and r.owner_id = (select auth.uid()))
  )
);

revoke all on function public.join_roll_by_invite_code(text, text) from public, anon;
grant execute on function public.join_roll_by_invite_code(text, text) to authenticated;
revoke all on function public.close_roll(uuid) from public, anon;
grant execute on function public.close_roll(uuid) to authenticated;
revoke all on function public.is_roll_member(uuid) from public, anon;
grant execute on function public.is_roll_member(uuid) to authenticated;
revoke all on function public.is_roll_owner(uuid) from public, anon;
grant execute on function public.is_roll_owner(uuid) to authenticated;
revoke all on function public.create_profile_for_user() from public, anon, authenticated;
revoke all on function public.add_roll_owner_member() from public, anon, authenticated;
revoke all on function public.track_roll_photo_count() from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.rolls, public.roll_members, public.photos to authenticated;
