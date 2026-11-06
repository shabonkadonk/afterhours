-- Host accounts create and manage rolls. Guests join with Supabase anonymous auth.
-- This migration keeps existing roll/photo rows and adds invitation and retention data.

create or replace function public.generate_roll_join_code()
returns text language sql volatile set search_path = '' as $$
  select 'AFTR-' || upper(encode(extensions.gen_random_bytes(4), 'hex'));
$$;

alter table public.rolls
  add column if not exists invite_token text,
  add column if not exists join_code text,
  add column if not exists invitation_enabled boolean not null default true,
  add column if not exists revealed_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists deletion_started_at timestamptz,
  add column if not exists deletion_lease_until timestamptz,
  add column if not exists deletion_lease_token uuid,
  add column if not exists deletion_attempts integer not null default 0;

do $$
declare
  target record;
  token_value text;
  code_value text;
begin
  for target in select id from public.rolls where invite_token is null or join_code is null loop
    if exists (select 1 from public.rolls where id = target.id and invite_token is null) then
      token_value := encode(extensions.gen_random_bytes(32), 'hex');
    else
      select invite_token into token_value from public.rolls where id = target.id;
    end if;
    if exists (select 1 from public.rolls where id = target.id and join_code is null) then
      select invite_code into code_value from public.rolls where id = target.id;
      if code_value is null or code_value !~ '^[0-9A-F]{10}$' then
        loop
          code_value := public.generate_roll_join_code();
          exit when not exists (select 1 from public.rolls where join_code = code_value);
        end loop;
      else
        code_value := upper(code_value);
      end if;
    else
      select join_code into code_value from public.rolls where id = target.id;
    end if;
    update public.rolls set invite_token = token_value, join_code = code_value where id = target.id;
  end loop;
end;
$$;

alter table public.rolls alter column invite_token set not null;
alter table public.rolls alter column join_code set not null;
create unique index if not exists rolls_invite_token_unique on public.rolls(invite_token);
create unique index if not exists rolls_join_code_unique on public.rolls(join_code);
create index if not exists rolls_expiration_idx on public.rolls(expires_at)
  where status = 'revealed' and expires_at is not null;

-- Existing revealed rolls receive a fresh full retention period at migration time.
update public.rolls set revealed_at = coalesce(revealed_at, now()),
  expires_at = coalesce(expires_at, now() + interval '30 days')
where status = 'revealed' and expires_at is null;

create or replace function public.set_roll_invitation_defaults()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.invite_token := encode(extensions.gen_random_bytes(32), 'hex');
  loop
    new.join_code := public.generate_roll_join_code();
    exit when not exists (select 1 from public.rolls r where r.join_code = new.join_code);
  end loop;
  new.invitation_enabled := true;
  return new;
end;
$$;
create trigger rolls_invitation_defaults before insert on public.rolls
for each row execute function public.set_roll_invitation_defaults();

create or replace function public.validate_photo_storage_paths()
returns trigger language plpgsql security definer set search_path = '' as $$
declare expected_prefix text;
begin
  expected_prefix := '^' || new.uploaded_by::text || '/' || new.roll_id::text || '/[^/]+[.]jpg$';
  if new.object_path !~ expected_prefix then
    raise exception 'Photo storage path must stay inside its uploader and roll folder.' using errcode = '23514';
  end if;
  if new.original_object_path is not null and new.original_object_path !~ expected_prefix then
    raise exception 'Original photo storage path must stay inside its uploader and roll folder.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger photos_validate_storage_paths before insert or update on public.photos
for each row execute function public.validate_photo_storage_paths();
revoke all on function public.validate_photo_storage_paths() from public, anon, authenticated;
revoke all on function public.set_roll_invitation_defaults() from public, anon, authenticated;

-- Rate-limit code guesses by a server-derived, HMACed client address.
create table if not exists public.invite_code_attempts (
  rate_key text primary key,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  blocked_until timestamptz
);
create index if not exists invite_code_attempts_window_idx on public.invite_code_attempts(window_started_at);
alter table public.invite_code_attempts enable row level security;
revoke all on public.invite_code_attempts from public, anon, authenticated;

drop function if exists public.join_roll_by_invite_code(text, text);

create or replace function public.join_roll_by_invitation(
  target_user_id uuid,
  target_invite_token text,
  target_join_code text,
  target_display_name text,
  target_rate_key text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_attempts integer;
  current_block timestamptz;
  target_roll public.rolls%rowtype;
begin
  if target_rate_key is null or target_rate_key !~ '^[0-9a-f]{64}$'
     or not exists (select 1 from auth.users u where u.id = target_user_id) then
    return jsonb_build_object('error', 'invalid');
  end if;

  insert into public.invite_code_attempts(rate_key, window_started_at, attempt_count, blocked_until)
  values (target_rate_key, now(), 1, null)
  on conflict (rate_key) do update set
    window_started_at = case
      when public.invite_code_attempts.window_started_at < now() - interval '15 minutes' then now()
      else public.invite_code_attempts.window_started_at end,
    attempt_count = case
      when public.invite_code_attempts.window_started_at < now() - interval '15 minutes' then 1
      else public.invite_code_attempts.attempt_count + 1 end,
    blocked_until = case
      when public.invite_code_attempts.window_started_at < now() - interval '15 minutes' then null
      when public.invite_code_attempts.attempt_count >= 10 then now() + interval '15 minutes'
      else public.invite_code_attempts.blocked_until end
  returning attempt_count, blocked_until into current_attempts, current_block;

  if current_block is not null and current_block > now() then
    return jsonb_build_object('error', 'rate_limited');
  end if;
  if current_attempts > 10 then
    return jsonb_build_object('error', 'rate_limited');
  end if;

  select * into target_roll from public.rolls r
  where r.invitation_enabled
    and r.status = 'active'
    and r.ends_at > now()
    and ((target_invite_token is not null and r.invite_token = target_invite_token)
      or (target_invite_token is null and r.join_code = upper(trim(coalesce(target_join_code, '')))))
  limit 1;
  if not found then return jsonb_build_object('error', 'invalid'); end if;

  insert into public.roll_members(roll_id, user_id, display_name, role)
  values (target_roll.id, target_user_id, left(trim(coalesce(target_display_name, '')), 48), 'member')
  on conflict (roll_id, user_id) do nothing;

  return jsonb_build_object('roll_id', target_roll.id);
end;
$$;
revoke all on function public.join_roll_by_invitation(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.join_roll_by_invitation(uuid, text, text, text, text) to service_role;

create or replace function public.rotate_roll_invitation(target_roll_id uuid)
returns table(invite_token text, join_code text)
language plpgsql security definer set search_path = '' as $$
declare
  next_token text;
  next_code text;
begin
  if (select auth.uid()) is null
     or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true'
     or not exists (select 1 from public.rolls r where r.id = target_roll_id and r.owner_id = (select auth.uid())) then
    raise exception 'Only the host can manage this invitation.' using errcode = '42501';
  end if;
  next_token := encode(extensions.gen_random_bytes(32), 'hex');
  loop
    next_code := public.generate_roll_join_code();
    exit when not exists (select 1 from public.rolls r where r.join_code = next_code and r.id <> target_roll_id);
  end loop;
  update public.rolls r set invite_token = next_token, join_code = next_code, invitation_enabled = true
  where r.id = target_roll_id;
  return query select next_token, next_code;
end;
$$;

create or replace function public.set_roll_invitation_enabled(target_roll_id uuid, enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null
     or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true'
     or not exists (select 1 from public.rolls r where r.id = target_roll_id and r.owner_id = (select auth.uid())) then
    raise exception 'Only the host can manage this invitation.' using errcode = '42501';
  end if;
  update public.rolls set invitation_enabled = enabled where id = target_roll_id;
end;
$$;

create or replace function public.get_roll_invitation(target_roll_id uuid)
returns table(invite_token text, join_code text, invitation_enabled boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null
     or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true'
     or not exists (select 1 from public.rolls r where r.id = target_roll_id and r.owner_id = (select auth.uid())) then
    raise exception 'Only the host can view this invitation.' using errcode = '42501';
  end if;
  return query select r.invite_token, r.join_code, r.invitation_enabled
    from public.rolls r where r.id = target_roll_id;
end;
$$;

create or replace function public.renew_roll(target_roll_id uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare next_expiry timestamptz;
begin
  if (select auth.uid()) is null
     or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception 'Sign in with the host account to renew this roll.' using errcode = '42501';
  end if;
  update public.rolls r set
    expires_at = greatest(r.expires_at, now()) + interval '30 days'
  where r.id = target_roll_id
    and r.owner_id = (select auth.uid())
    and r.status = 'revealed'
    and r.expires_at > now() - interval '7 days'
    and r.deletion_started_at is null
  returning r.expires_at into next_expiry;
  if next_expiry is null then
    raise exception 'This roll is outside its renewal window.' using errcode = 'P0002';
  end if;
  return next_expiry;
end;
$$;

create or replace function public.claim_expired_rolls(batch_size integer default 5)
returns table(roll_id uuid, lease_token uuid, object_paths text[])
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with candidates as (
    select r.id from public.rolls r
    where r.status = 'revealed'
      and r.expires_at <= now() - interval '7 days'
      and (r.deletion_lease_until is null or r.deletion_lease_until < now())
    order by r.expires_at
    limit greatest(1, least(coalesce(batch_size, 5), 10))
    for update skip locked
  ), claimed as (
    update public.rolls r set
      deletion_started_at = coalesce(r.deletion_started_at, now()),
      deletion_lease_until = now() + interval '5 minutes',
      deletion_lease_token = gen_random_uuid(),
      deletion_attempts = r.deletion_attempts + 1
    from candidates c where r.id = c.id
    returning r.id, r.deletion_lease_token
  )
  select c.id, c.deletion_lease_token,
    coalesce(array_agg(distinct object_paths.path) filter (where object_paths.path is not null), '{}')
  from claimed c left join public.photos p on p.roll_id = c.id
  left join lateral (values
    (p.object_path),
    (p.original_object_path),
    (regexp_replace(p.object_path, '\.jpg$', '.thumb.jpg')),
    (regexp_replace(p.original_object_path, '\.jpg$', '.thumb.jpg'))
  ) as object_paths(path) on p.id is not null
  group by c.id, c.deletion_lease_token;
end;
$$;

create or replace function public.finalize_expired_roll(target_roll_id uuid, target_lease_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare removed integer;
begin
  delete from public.rolls r
  where r.id = target_roll_id and r.deletion_started_at is not null
    and r.deletion_lease_token = target_lease_token
    and r.expires_at <= now() - interval '7 days';
  get diagnostics removed = row_count;
  return removed = 1;
end;
$$;

create or replace function public.cleanup_old_anonymous_users()
returns integer language plpgsql security definer set search_path = '' as $$
declare removed integer;
begin
  delete from public.invite_code_attempts where window_started_at < now() - interval '1 day';
  delete from auth.users u
  where u.is_anonymous
    and u.created_at < now() - interval '90 days'
    and not exists (
      select 1 from public.roll_members rm where rm.user_id = u.id
    );
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.claim_expired_rolls(integer) from public, anon, authenticated;
grant execute on function public.claim_expired_rolls(integer) to service_role;
revoke all on function public.finalize_expired_roll(uuid, uuid) from public, anon, authenticated;
grant execute on function public.finalize_expired_roll(uuid, uuid) to service_role;
revoke all on function public.cleanup_old_anonymous_users() from public, anon, authenticated;
grant execute on function public.cleanup_old_anonymous_users() to service_role;
revoke all on function public.renew_roll(uuid) from public, anon;
grant execute on function public.renew_roll(uuid) to authenticated;
revoke all on function public.rotate_roll_invitation(uuid) from public, anon;
grant execute on function public.rotate_roll_invitation(uuid) to authenticated;
revoke all on function public.set_roll_invitation_enabled(uuid, boolean) from public, anon;
grant execute on function public.set_roll_invitation_enabled(uuid, boolean) to authenticated;
revoke all on function public.get_roll_invitation(uuid) from public, anon;
grant execute on function public.get_roll_invitation(uuid) to authenticated;

-- Only registered hosts may create, update, or delete rolls.
drop policy if exists "Users create rolls" on public.rolls;
create policy "Registered hosts create rolls" on public.rolls
for insert to authenticated with check (
  owner_id = (select auth.uid())
  and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  and status = 'active' and photo_count = 0
  and photo_limit in (12, 24, 36)
  and ends_at > now() and ends_at <= now() + interval '30 days'
);
drop policy if exists "Owners update rolls" on public.rolls;
create policy "Registered hosts update rolls" on public.rolls
for update to authenticated using (
  owner_id = (select auth.uid()) and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
) with check (
  owner_id = (select auth.uid()) and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
);
drop policy if exists "Owners delete rolls" on public.rolls;
create policy "Registered hosts delete rolls" on public.rolls
for delete to authenticated using (
  owner_id = (select auth.uid()) and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
);

-- Match the object key layout used by the uploader: user ID / roll ID / photo.
-- Metadata insertion still uses the atomic photo counter to close capacity races.
drop policy if exists "Users upload to their own private folder" on storage.objects;
drop policy if exists "Members and owners upload to active rolls" on storage.objects;
drop policy if exists "Members upload to active rolls" on storage.objects;

create or replace function public.can_upload_roll_photo_object(target_object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.photos p
    join public.rolls r on r.id = p.roll_id
    where p.uploaded_by = (select auth.uid())
      and r.status = 'active'
      and (r.owner_id = (select auth.uid()) or public.is_roll_member(r.id))
      and (p.object_path = target_object_name
        or p.original_object_path = target_object_name
        or regexp_replace(p.object_path, '[.]jpg$', '.thumb.jpg') = target_object_name
        or regexp_replace(p.original_object_path, '[.]jpg$', '.thumb.jpg') = target_object_name)
  );
$$;
revoke all on function public.can_upload_roll_photo_object(text) from public, anon;
grant execute on function public.can_upload_roll_photo_object(text) to authenticated;

create policy "Members upload to active rolls" on storage.objects
for insert to authenticated with check (
  bucket_id = 'roll-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.can_upload_roll_photo_object(name)
);

-- New uploads are processed JPEGs (up to about 560 KB in the current UI).
-- Keep a generous ceiling for future quality changes without accepting unbounded files.
update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['image/jpeg']
where id = 'roll-photos';

-- Invitation secrets are returned only by the host-checked RPC above.
revoke select, update on public.rolls from authenticated;
grant select (id, owner_id, name, theme, status, created_at, ends_at, photo_limit,
  photo_count, revealed_at, expires_at) on public.rolls to authenticated;
revoke insert on public.rolls from authenticated;
grant insert (owner_id, name, theme, ends_at, photo_limit) on public.rolls to authenticated;

create or replace function public.close_roll(target_roll_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_roll_member(target_roll_id) then
    raise exception 'That roll is not available.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.rolls r where r.id = target_roll_id and r.status = 'revealed') then
    return;
  end if;
  update public.rolls r set status = 'revealed', revealed_at = now(), expires_at = now() + interval '30 days'
  where r.id = target_roll_id and r.status = 'active'
    and (r.owner_id = (select auth.uid()) or r.ends_at <= now());
  if not found then
    raise exception 'You cannot close this roll yet.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.close_roll(uuid) from public, anon;
grant execute on function public.close_roll(uuid) to authenticated;

