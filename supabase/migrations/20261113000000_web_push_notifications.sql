create table public.push_subscriptions (
  endpoint text primary key check (char_length(endpoint) between 1 and 4096),
  user_id uuid not null references public.profiles(id) on delete cascade,
  p256dh_key text not null check (char_length(p256dh_key) between 1 and 256),
  auth_key text not null check (char_length(auth_key) between 1 and 128),
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from public, anon, authenticated;
grant all on table public.push_subscriptions to service_role;
