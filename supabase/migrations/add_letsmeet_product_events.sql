-- Pseudonymous product journey events (dashboard analytics)
create table if not exists letsmeet_product_events (
  event_id uuid primary key,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  install_id uuid not null,
  user_id text,
  session_id uuid not null,
  event_name text not null,
  platform text not null,
  app_version text not null default '',
  locale text not null default '',
  properties jsonb not null default '{}'::jsonb
);

create index if not exists letsmeet_product_events_install_time_idx
  on letsmeet_product_events (install_id, occurred_at);

create index if not exists letsmeet_product_events_name_time_idx
  on letsmeet_product_events (event_name, occurred_at desc);

create index if not exists letsmeet_product_events_received_at_idx
  on letsmeet_product_events (received_at desc);

create index if not exists letsmeet_product_events_user_time_idx
  on letsmeet_product_events (user_id, occurred_at desc)
  where user_id is not null;

alter table letsmeet_product_events enable row level security;

drop policy if exists "letsmeet_product_events_deny_anon" on letsmeet_product_events;
create policy "letsmeet_product_events_deny_anon"
  on letsmeet_product_events
  for all
  to anon, authenticated
  using (false)
  with check (false);
