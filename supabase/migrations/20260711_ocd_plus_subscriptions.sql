-- OCD+ paid monthly membership (49₪ via Hyp).
--
-- Stores ONLY subscription state — never card number / CVV / expiry / any raw
-- payment-instrument data. Hyp is the system of record for payment methods.
--
-- Access model: these tables are written/read exclusively by the OCD+ Edge
-- Functions using the service-role key (which bypasses RLS). RLS is enabled
-- with NO policies so the anon/public key cannot read or write them directly.

create table if not exists public.ocd_plus_subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.users (id) on delete cascade,
  shopify_customer_id   text,
  status                text not null default 'pending'
                          check (status in ('pending', 'active', 'past_due', 'cancelled')),
  hyp_subscription_id   text,
  current_period_end    timestamptz,
  next_billing_at       timestamptz,
  cancel_at_period_end  boolean not null default false,
  last_payment_at       timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- One subscription row per user (upsert target).
create unique index if not exists ocd_plus_subscriptions_user_id_key
  on public.ocd_plus_subscriptions (user_id);

create index if not exists ocd_plus_subscriptions_status_idx
  on public.ocd_plus_subscriptions (status);

create index if not exists ocd_plus_subscriptions_hyp_sub_idx
  on public.ocd_plus_subscriptions (hyp_subscription_id);

comment on table public.ocd_plus_subscriptions is
  'OCD+ paid membership state. No sensitive payment-instrument data is ever stored here.';

-- Idempotency ledger: every verified Hyp transaction/callback is recorded once
-- so the same payment can never be processed twice.
create table if not exists public.ocd_plus_payment_events (
  id                  uuid primary key default gen_random_uuid(),
  subscription_id     uuid references public.ocd_plus_subscriptions (id) on delete set null,
  user_id             uuid references public.users (id) on delete set null,
  hyp_transaction_id  text not null,
  status              text not null,
  amount              numeric,
  currency            text,
  raw                 jsonb,
  created_at          timestamptz not null default now()
);

-- The unique key is what guarantees "no double processing" of a transaction.
create unique index if not exists ocd_plus_payment_events_tx_key
  on public.ocd_plus_payment_events (hyp_transaction_id);

comment on table public.ocd_plus_payment_events is
  'Verified Hyp payment events. Unique hyp_transaction_id prevents double processing.';

-- keep updated_at fresh on the subscriptions table
create or replace function public.set_ocd_plus_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ocd_plus_subscriptions_updated_at on public.ocd_plus_subscriptions;
create trigger trg_ocd_plus_subscriptions_updated_at
  before update on public.ocd_plus_subscriptions
  for each row execute function public.set_ocd_plus_subscriptions_updated_at();

-- Lock down: enable RLS, add no policies. Only the service role (Edge
-- Functions) may touch these tables; the public/anon key is denied.
alter table public.ocd_plus_subscriptions enable row level security;
alter table public.ocd_plus_payment_events enable row level security;
