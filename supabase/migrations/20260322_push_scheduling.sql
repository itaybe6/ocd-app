-- Scheduled push notifications queue
-- This enables scheduling pushes for future delivery.

create extension if not exists "pgcrypto";

create table if not exists public.push_notification_jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  image_url text null,
  scope text not null default 'general', -- 'general' | 'product'
  product_handles text[] null,
  scheduled_for timestamptz not null,
  status text not null default 'scheduled', -- 'scheduled' | 'sending' | 'sent' | 'failed'
  created_at timestamptz not null default now(),
  executed_at timestamptz null,
  total_tokens integer not null default 0,
  success_count integer not null default 0,
  error_count integer not null default 0,
  errors jsonb null
);

create index if not exists push_notification_jobs_scheduled_for_idx
  on public.push_notification_jobs (status, scheduled_for asc);

alter table public.push_notification_jobs enable row level security;
-- no policies: clients cannot read/insert jobs via anon key (Edge Functions use service role key)

