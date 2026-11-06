-- Persist one Afterhours Awards ceremony per revealed roll.
create table public.roll_awards (
  id uuid primary key default gen_random_uuid(),
  roll_id uuid not null unique references public.rolls(id) on delete cascade,
  generated_by uuid references public.profiles(id) on delete set null,
  selected_photo_ids uuid[] not null default '{}',
  awards_json jsonb,
  generation_status text not null default 'generating'
    check (generation_status in ('generating', 'completed', 'failed')),
  provider text not null default 'pending',
  model text not null default 'pending',
  error_code text check (error_code is null or error_code in (
    'provider_unavailable', 'provider_auth', 'provider_model', 'provider_quota',
    'invalid_response', 'photo_processing', 'internal'
  )),
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.roll_awards enable row level security;

create policy "Roll members view saved awards" on public.roll_awards
for select to authenticated using (
  public.is_roll_member(roll_id)
  and exists (select 1 from public.rolls r where r.id = roll_id and r.status = 'revealed')
);

create policy "Roll owners delete saved awards" on public.roll_awards
for delete to authenticated using (public.is_roll_owner(roll_id));

-- The daily counter is private and is changed only by claim_roll_awards().
create table public.awards_generation_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, usage_date)
);
alter table public.awards_generation_usage enable row level security;

-- A low global ceiling protects the account from unexpected usage spikes.
create table public.awards_global_usage (
  usage_date date primary key,
  request_count integer not null default 0 check (request_count >= 0)
);
alter table public.awards_global_usage enable row level security;

create function public.claim_roll_awards(target_roll_id uuid, target_photo_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := auth.uid();
  selected_count integer;
  matching_count integer;
  roll_status text;
  existing public.roll_awards%rowtype;
  has_existing boolean := false;
  claimed_id uuid;
  usage_count integer;
  global_count integer;
begin
  if actor_id is null then
    raise exception 'AWARDS_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not public.is_roll_member(target_roll_id) then
    raise exception 'AWARDS_ROLL_UNAVAILABLE' using errcode = 'P0002';
  end if;

  select r.status into roll_status from public.rolls r where r.id = target_roll_id;
  if roll_status is distinct from 'revealed' then
    raise exception 'AWARDS_ROLL_NOT_REVEALED' using errcode = 'P0001';
  end if;

  if target_photo_ids is null then
    raise exception 'AWARDS_NO_PHOTOS' using errcode = 'P0001';
  end if;
  select count(distinct selected.photo_id) into selected_count from unnest(target_photo_ids) as selected(photo_id);
  if selected_count < 1 then
    raise exception 'AWARDS_NO_PHOTOS' using errcode = 'P0001';
  end if;
  if selected_count > 10 then
    raise exception 'AWARDS_TOO_MANY_PHOTOS' using errcode = 'P0001';
  end if;
  if selected_count <> cardinality(target_photo_ids) then
    raise exception 'AWARDS_DUPLICATE_PHOTOS' using errcode = 'P0001';
  end if;
  select count(*) into matching_count from public.photos p
    where p.roll_id = target_roll_id and p.id = any(target_photo_ids);
  if matching_count <> selected_count then
    raise exception 'AWARDS_PHOTO_UNAVAILABLE' using errcode = 'P0001';
  end if;

  select * into existing from public.roll_awards a where a.roll_id = target_roll_id;
  has_existing := found;
  if has_existing and (existing.generation_status = 'completed'
    or (existing.generation_status = 'generating' and existing.updated_at > now() - interval '5 minutes')) then
    return jsonb_build_object(
      'state', existing.generation_status,
      'id', existing.id,
      'awards', existing.awards_json,
      'provider', existing.provider,
      'model', existing.model
    );
  end if;

  insert into public.awards_global_usage as current_global_usage (usage_date, request_count)
  values (current_date, 1)
  on conflict (usage_date) do update
    set request_count = current_global_usage.request_count + 1
    where current_global_usage.request_count < 5
  returning request_count into global_count;
  if global_count is null then
    raise exception 'AWARDS_DAILY_LIMIT' using errcode = 'P0001';
  end if;

  insert into public.awards_generation_usage as current_user_usage (user_id, usage_date, request_count)
  values (actor_id, current_date, 1)
  on conflict (user_id, usage_date) do update
    set request_count = current_user_usage.request_count + 1
    where current_user_usage.request_count < 3
  returning request_count into usage_count;
  if usage_count is null then
    raise exception 'AWARDS_RATE_LIMIT' using errcode = 'P0001';
  end if;
  delete from public.awards_generation_usage where usage_date < current_date - 7;
  delete from public.awards_global_usage where usage_date < current_date - 7;

  if has_existing and (existing.generation_status = 'failed'
    or (existing.generation_status = 'generating' and existing.updated_at <= now() - interval '5 minutes')) then
    update public.roll_awards a set
      generated_by = actor_id,
      selected_photo_ids = target_photo_ids,
      awards_json = null,
      generation_status = 'generating',
      provider = 'pending',
      model = 'pending',
      error_code = null,
      consented_at = now(),
      created_at = now(),
      updated_at = now()
    where a.id = existing.id and (a.generation_status = 'failed'
      or (a.generation_status = 'generating' and a.updated_at <= now() - interval '5 minutes'))
    returning a.id into claimed_id;
    if claimed_id is not null then
      return jsonb_build_object('state', 'claimed', 'id', claimed_id);
    end if;
    select * into existing from public.roll_awards a where a.roll_id = target_roll_id;
    return jsonb_build_object('state', existing.generation_status, 'id', existing.id,
      'awards', existing.awards_json, 'provider', existing.provider, 'model', existing.model);
  end if;

  insert into public.roll_awards(roll_id, generated_by, selected_photo_ids, consented_at)
  values (target_roll_id, actor_id, target_photo_ids, now())
  on conflict (roll_id) do nothing
  returning id into claimed_id;
  if claimed_id is not null then
    return jsonb_build_object('state', 'claimed', 'id', claimed_id);
  end if;

  select * into existing from public.roll_awards a where a.roll_id = target_roll_id;
  return jsonb_build_object('state', existing.generation_status, 'id', existing.id,
    'awards', existing.awards_json, 'provider', existing.provider, 'model', existing.model);
end;
$$;

create function public.complete_roll_awards(
  target_generation_id uuid,
  target_awards_json jsonb,
  target_provider text,
  target_model text
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  current_generation public.roll_awards%rowtype;
  item jsonb;
  item_photo_id uuid;
  runner_up_photo_id uuid;
  titles text[] := '{}';
  award_ids text[] := '{}';
  main_photo_ids uuid[] := '{}';
  item_count integer;
  item_order integer := 0;
begin
  if auth.uid() is null then
    raise exception 'AWARDS_AUTH_REQUIRED' using errcode = '28000';
  end if;
  select * into current_generation from public.roll_awards a
    where a.id = target_generation_id and a.generated_by = auth.uid()
      and a.generation_status = 'generating' for update;
  if not found then return false; end if;
  if target_provider is null or target_provider not in ('mock', 'cloudflare')
    or target_model is null or length(target_model) not between 1 and 160 then
    raise exception 'AWARDS_INVALID_PROVIDER' using errcode = 'P0001';
  end if;
  if target_awards_json is null or jsonb_typeof(target_awards_json -> 'awards') is distinct from 'array' then
    raise exception 'AWARDS_INVALID_RESULT' using errcode = 'P0001';
  end if;
  item_count := jsonb_array_length(target_awards_json -> 'awards');
  if item_count < 1 or item_count > 8 then
    raise exception 'AWARDS_INVALID_RESULT' using errcode = 'P0001';
  end if;

  for item in select award.value from jsonb_array_elements(target_awards_json -> 'awards') as award(value) loop
    item_order := item_order + 1;
    if jsonb_typeof(item -> 'id') <> 'string'
      or jsonb_typeof(item -> 'title') <> 'string'
      or jsonb_typeof(item -> 'explanation') <> 'string'
      or coalesce(length(item ->> 'id'), 0) not between 1 and 64
      or coalesce(length(item ->> 'title'), 0) not between 1 and 48
      or coalesce(length(item ->> 'explanation'), 0) not between 1 and 220
      or (item ->> 'explanation') ~* '\m(attractive|beauty|sexy|ugly|fat|skinny|dating|boyfriend|girlfriend|husband|wife|pregnant|race|ethnicity|religion|disabled|disability|gay|lesbian|transgender|drunk|intoxicated|high)\M'
      or item ->> 'title' not in ('Most Main Character Energy', 'Funniest Photo', 'Most Unhinged Moment',
        'Best Accidental Photo', 'Best Photo Aesthetic', 'Most Cinematic Moment', 'Best Group Photo',
        'Most Mysterious Photo', 'Photo of the Night', 'Most Likely to Become a Meme',
        'Best Background Appearance', 'Most Unexpected Moment') then
      raise exception 'AWARDS_INVALID_RESULT' using errcode = 'P0001';
    end if;
    if item ->> 'id' = any(award_ids) then
      raise exception 'AWARDS_INVALID_RESULT' using errcode = 'P0001';
    end if;
    award_ids := array_append(award_ids, item ->> 'id');
    begin
      item_photo_id := (item ->> 'photoId')::uuid;
      runner_up_photo_id := nullif(item ->> 'runnerUpPhotoId', '')::uuid;
    exception when others then
      raise exception 'AWARDS_INVALID_RESULT' using errcode = 'P0001';
    end;
    if not (item_photo_id = any(current_generation.selected_photo_ids))
      or (runner_up_photo_id is not null and not (runner_up_photo_id = any(current_generation.selected_photo_ids))) then
      raise exception 'AWARDS_INVALID_RESULT' using errcode = 'P0001';
    end if;
    if runner_up_photo_id = item_photo_id then
      raise exception 'AWARDS_INVALID_RESULT' using errcode = 'P0001';
    end if;
    if lower(item ->> 'title') = any(titles) then
      raise exception 'AWARDS_INVALID_RESULT' using errcode = 'P0001';
    end if;
    titles := array_append(titles, lower(item ->> 'title'));
    if (item ->> 'title' = 'Photo of the Night') <> (item_order = item_count) then
      raise exception 'AWARDS_INVALID_RESULT' using errcode = 'P0001';
    end if;
    main_photo_ids := array_append(main_photo_ids, item_photo_id);
  end loop;
  if exists (select 1 from unnest(main_photo_ids) as selected(photo_id)
    group by selected.photo_id having count(*) > 2) then
    raise exception 'AWARDS_INVALID_RESULT' using errcode = 'P0001';
  end if;

  update public.roll_awards set awards_json = target_awards_json,
    generation_status = 'completed', provider = target_provider, model = target_model,
    error_code = null, updated_at = now()
  where id = target_generation_id;
  return true;
end;
$$;

create function public.fail_roll_awards(target_generation_id uuid, target_error_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'AWARDS_AUTH_REQUIRED' using errcode = '28000';
  end if;
  if target_error_code not in ('provider_unavailable', 'provider_auth', 'provider_model',
    'provider_quota', 'invalid_response', 'photo_processing', 'internal') then
    target_error_code := 'internal';
  end if;
  update public.roll_awards set generation_status = 'failed', error_code = target_error_code,
    awards_json = null, updated_at = now()
  where id = target_generation_id and generated_by = auth.uid()
    and generation_status = 'generating';
  return found;
end;
$$;

-- If a selected photo is deleted, remove the ceremony so it cannot show stale IDs.
create function public.remove_awards_for_deleted_photo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.roll_awards a where a.roll_id = old.roll_id and old.id = any(a.selected_photo_ids);
  return old;
end;
$$;
create trigger photos_remove_dependent_awards after delete on public.photos
for each row execute function public.remove_awards_for_deleted_photo();

revoke all on function public.claim_roll_awards(uuid, uuid[]) from public, anon;
grant execute on function public.claim_roll_awards(uuid, uuid[]) to authenticated;
revoke all on function public.complete_roll_awards(uuid, jsonb, text, text) from public, anon;
grant execute on function public.complete_roll_awards(uuid, jsonb, text, text) to authenticated;
revoke all on function public.fail_roll_awards(uuid, text) from public, anon;
grant execute on function public.fail_roll_awards(uuid, text) to authenticated;
revoke all on function public.remove_awards_for_deleted_photo() from public, anon, authenticated;
grant select, delete on public.roll_awards to authenticated;
