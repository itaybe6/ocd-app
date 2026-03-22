-- Push notifications: device tokens + send log
-- Run in Supabase SQL editor, or via supabase migrations.

create extension if not exists "pgcrypto";

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  expo_push_token text not null unique,
  platform text not null,
  user_id uuid null,
  role text null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_tokens_last_seen_at_idx on public.push_tokens (last_seen_at desc);

alter table public.push_tokens enable row level security;

-- NOTE: This app currently doesn't use Supabase Auth (no JWT), so we allow public upserts of tokens.
-- The Edge Function uses the service role key to read tokens and send broadcasts.
drop policy if exists "push_tokens_insert_any" on public.push_tokens;
create policy "push_tokens_insert_any" on public.push_tokens
  for insert
  with check (true);

drop policy if exists "push_tokens_update_any" on public.push_tokens;
create policy "push_tokens_update_any" on public.push_tokens
  for update
  using (true)
  with check (true);

create table if not exists public.push_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  image_url text null,
  product_handle text null,
  product_title text null,
  sent_at timestamptz not null default now(),
  total_tokens integer not null default 0,
  success_count integer not null default 0,
  error_count integer not null default 0,
  errors jsonb null
);

alter table public.push_notifications enable row level security;
-- no policies: clients cannot read/insert logs via anon key

