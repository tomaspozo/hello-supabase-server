-- Per-call invocation log: the signed-in user records one row per /hello call
-- (client-side, via supabase-js) with the round-trip latency it observed.
create table public.invocations (
  request_id  uuid        primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  platform    text        not null check (platform in ('supabase','vercel','cloudflare')),
  latency_ms  int         not null check (latency_ms >= 0),
  created_at  timestamptz not null default now()
);

create index invocations_user_created_idx
  on public.invocations (user_id, created_at desc);

-- 1. Grants — anon has none (anonymous calls don't write here)
grant select, insert on public.invocations to authenticated;
grant select, insert on public.invocations to service_role;

-- 2. Enable RLS
alter table public.invocations enable row level security;

-- 3. Policies — authenticated reads + writes own rows only
create policy "users read their own invocations"
  on public.invocations
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "users insert their own invocations"
  on public.invocations
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));
