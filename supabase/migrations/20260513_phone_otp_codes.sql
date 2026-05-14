-- Phone OTP codes for SMS-based authentication via Pulseem.
-- Accessed only from the `auth-phone-otp` Edge Function with the service role.
-- No RLS policies are defined so anon/authenticated roles cannot read or write.

create extension if not exists "pgcrypto";

create table if not exists public.phone_otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  purpose text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  constraint phone_otp_codes_purpose_check check (purpose in ('login', 'register'))
);

create index if not exists phone_otp_codes_phone_purpose_created_idx
  on public.phone_otp_codes (phone, purpose, created_at desc);

create index if not exists phone_otp_codes_expires_at_idx
  on public.phone_otp_codes (expires_at);

alter table public.phone_otp_codes enable row level security;

-- Best-effort cleanup helper. Edge Function calls this opportunistically
-- to keep the table small. Safe to call concurrently.
create or replace function public.cleanup_expired_phone_otp_codes()
returns void
language sql
as $$
  delete from public.phone_otp_codes
  where (expires_at < now() - interval '1 day')
     or (consumed_at is not null and consumed_at < now() - interval '1 day');
$$;
