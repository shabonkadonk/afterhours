alter table public.roll_awards
  add column if not exists ceremony_started_at timestamptz;

drop policy if exists "Roll members view saved awards" on public.roll_awards;
create policy "Roll members view released awards" on public.roll_awards
for select to authenticated using (
  public.is_roll_member(roll_id)
  and exists (select 1 from public.rolls r where r.id = roll_id and r.status = 'revealed')
  and (public.is_roll_owner(roll_id) or ceremony_started_at is not null)
);

create function public.get_roll_awards_state(target_roll_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  saved public.roll_awards%rowtype;
  actor_is_host boolean;
begin
  if auth.uid() is null then
    raise exception 'AWARDS_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not public.is_roll_member(target_roll_id) and not public.is_roll_owner(target_roll_id) then
    raise exception 'AWARDS_ROLL_UNAVAILABLE' using errcode = 'P0002';
  end if;

  actor_is_host := public.is_roll_owner(target_roll_id);
  select * into saved from public.roll_awards a where a.roll_id = target_roll_id;
  if not found then return null; end if;

  return jsonb_build_object(
    'id', saved.id,
    'generation_status', saved.generation_status,
    'awards_json', case when actor_is_host or saved.ceremony_started_at is not null then saved.awards_json else null end,
    'provider', saved.provider,
    'model', saved.model,
    'error_code', saved.error_code,
    'selected_photo_ids', saved.selected_photo_ids,
    'created_at', saved.created_at,
    'updated_at', saved.updated_at,
    'ceremony_started_at', saved.ceremony_started_at
  );
end;
$$;

revoke all on function public.get_roll_awards_state(uuid) from public, anon;
grant execute on function public.get_roll_awards_state(uuid) to authenticated;

-- Only the roll host can reserve the provider request for a shared ceremony.
create function public.claim_roll_awards_for_host(target_roll_id uuid, target_photo_ids uuid[])
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'AWARDS_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not public.is_roll_owner(target_roll_id) then
    raise exception 'AWARDS_HOST_REQUIRED' using errcode = '42501';
  end if;
  return public.claim_roll_awards(target_roll_id, target_photo_ids);
end;
$$;

revoke all on function public.claim_roll_awards(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.claim_roll_awards_for_host(uuid, uuid[]) from public, anon;
grant execute on function public.claim_roll_awards_for_host(uuid, uuid[]) to authenticated;

create function public.start_roll_awards_ceremony(target_roll_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  started_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'AWARDS_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not public.is_roll_owner(target_roll_id) then
    raise exception 'AWARDS_HOST_REQUIRED' using errcode = '42501';
  end if;

  update public.roll_awards a
  set ceremony_started_at = now(), updated_at = now()
  where a.roll_id = target_roll_id
    and a.generation_status = 'completed'
    and a.ceremony_started_at is null
  returning a.ceremony_started_at into started_at;

  if found then
    return jsonb_build_object('started', true, 'startedAt', started_at);
  end if;

  select a.ceremony_started_at into started_at
  from public.roll_awards a
  where a.roll_id = target_roll_id and a.generation_status = 'completed';
  if not found then
    raise exception 'AWARDS_NOT_READY' using errcode = 'P0001';
  end if;

  return jsonb_build_object('started', false, 'startedAt', started_at);
end;
$$;

revoke all on function public.start_roll_awards_ceremony(uuid) from public, anon;
grant execute on function public.start_roll_awards_ceremony(uuid) to authenticated;
