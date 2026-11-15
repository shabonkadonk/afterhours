alter table public.rolls
  add column if not exists pre_reveal_notified_at timestamptz;

alter table public.roll_members
  add column if not exists camera_frame_count integer not null default 0;

update public.roll_members m
set camera_frame_count = coalesce((
  select count(*)::integer from public.photos p
  where p.roll_id = m.roll_id and p.uploaded_by = m.user_id
), 0);

create or replace function public.track_roll_photo_count()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  frame_limit integer;
begin
  if tg_op = 'INSERT' then
    update public.rolls r set photo_count = r.photo_count + 1
    where r.id = new.roll_id and r.status = 'active' and r.photo_count < r.photo_limit;
    if not found then
      raise exception 'This roll is closed or has no frames left.' using errcode = '23514';
    end if;

    select greatest(1, ceil(r.photo_limit::numeric / count(m.user_id))::integer)
    into frame_limit
    from public.rolls r
    join public.roll_members m on m.roll_id = r.id
    where r.id = new.roll_id
    group by r.photo_limit;

    update public.roll_members m set camera_frame_count = m.camera_frame_count + 1
    from public.rolls r
    where m.roll_id = new.roll_id and m.user_id = new.uploaded_by
      and r.id = m.roll_id
      and (r.owner_id = new.uploaded_by or m.camera_frame_count < frame_limit);
    if not found then
      raise exception 'This disposable camera has used all its frames for the current roll size.' using errcode = '23514';
    end if;
    return new;
  end if;

  update public.rolls r set photo_count = greatest(0, r.photo_count - 1)
  where r.id = old.roll_id;
  update public.roll_members m set camera_frame_count = greatest(0, m.camera_frame_count - 1)
  where m.roll_id = old.roll_id and m.user_id = old.uploaded_by;
  return old;
end;
$$;

create or replace function public.claim_roll_pre_reveal_notifications()
returns table(roll_id uuid, roll_name text)
language sql volatile security definer set search_path = '' as $$
  with candidates as (
    select r.id
    from public.rolls r
    where r.status = 'active'
      and r.pre_reveal_notified_at is null
      and r.ends_at > now() + interval '4 minutes'
      and r.ends_at <= now() + interval '6 minutes'
    order by r.ends_at
    limit 100
    for update skip locked
  ), claimed as (
    update public.rolls r set pre_reveal_notified_at = now()
    from candidates c
    where r.id = c.id
    returning r.id, r.name
  )
  select c.id, c.name from claimed c;
$$;

create or replace function public.reveal_due_rolls()
returns table(roll_id uuid)
language sql volatile security definer set search_path = '' as $$
  with due as (
    select r.id
    from public.rolls r
    where r.status = 'active' and r.ends_at <= now()
    order by r.ends_at
    limit 100
    for update skip locked
  ), revealed as (
    update public.rolls r
    set status = 'revealed', revealed_at = now(), expires_at = now() + interval '30 days'
    from due d
    where r.id = d.id and r.status = 'active'
    returning r.id
  )
  select r.id from revealed r;
$$;

revoke all on function public.claim_roll_pre_reveal_notifications() from public, anon, authenticated;
revoke all on function public.reveal_due_rolls() from public, anon, authenticated;
revoke all on function public.track_roll_photo_count() from public, anon, authenticated;
grant execute on function public.claim_roll_pre_reveal_notifications() to service_role;
grant execute on function public.reveal_due_rolls() to service_role;
