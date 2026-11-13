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
  inserted_count integer;
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
  get diagnostics inserted_count = row_count;

  return jsonb_build_object('roll_id', target_roll.id, 'joined', inserted_count = 1);
end;
$$;
revoke all on function public.join_roll_by_invitation(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.join_roll_by_invitation(uuid, text, text, text, text) to service_role;
