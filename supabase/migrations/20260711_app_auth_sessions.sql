-- App auth sessions for the custom phone-OTP identity (no Supabase Auth).
--
-- The server issues a short-lived HS256 access token (sub = public.users.id)
-- and an opaque refresh token. Only the SHA-256 hash of the refresh token is
-- stored here so a DB leak cannot be used to mint sessions. Access tokens are
-- stateless and never stored.
--
-- RLS is enabled with NO policies: the table is reachable only via Edge
-- Functions using the service role.

create table if not exists public.app_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  refresh_token_hash text not null unique,
  user_agent text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists app_auth_sessions_user_id_idx on public.app_auth_sessions (user_id);
create index if not exists app_auth_sessions_expires_at_idx on public.app_auth_sessions (expires_at);

alter table public.app_auth_sessions enable row level security;
