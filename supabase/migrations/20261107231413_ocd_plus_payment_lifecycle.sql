-- Server-only state transitions. No browser/client may execute these functions.
alter table public.ocd_plus_subscriptions
  add column if not exists sync_version bigint not null default 0,
  add column if not exists synced_version bigint not null default 0,
  add column if not exists sync_token uuid,
  add column if not exists sync_until timestamptz,
  add column if not exists sync_retry_at timestamptz,
  add column if not exists sync_error text,
  add column if not exists cancel_requested_at timestamptz,
  add column if not exists provider_cancelled_at timestamptz;

create table if not exists public.ocd_plus_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.ocd_plus_subscriptions(id),
  state text not null check(state in ('creating','ready','completed','blocked','closed')),
  payment_url text,
  created_at timestamptz not null default now()
);
create unique index if not exists ocd_one_open_attempt on public.ocd_plus_payment_attempts(subscription_id)
  where state in ('creating','ready','blocked');
alter table public.ocd_plus_payment_attempts enable row level security;
revoke all on public.ocd_plus_payment_attempts from public, anon, authenticated;
grant all on public.ocd_plus_payment_attempts to service_role;

alter table public.ocd_plus_payment_events
  add column if not exists applied_at timestamptz,
  add column if not exists occurred_at timestamptz,
  add column if not exists agreement_id text,
  add column if not exists order_state text not null default 'pending',
  add column if not exists shopify_order_id text,
  add column if not exists order_error text;
create unique index if not exists ocd_agreement_unique on public.ocd_plus_subscriptions(hyp_subscription_id)
  where hyp_subscription_id is not null;
create index if not exists ocd_sync_pending on public.ocd_plus_subscriptions(sync_retry_at) where sync_version <> synced_version;

create or replace function public.ocd_begin_checkout(p_user uuid, p_customer text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.ocd_plus_subscriptions; a public.ocd_plus_payment_attempts;
begin
  -- Lock the existing user even before a subscription row exists.
  perform 1 from public.users where id=p_user for update;
  if not found then raise exception 'Unknown user'; end if;
  insert into public.ocd_plus_subscriptions(user_id,shopify_customer_id)
    values(p_user,p_customer) on conflict(user_id) do nothing;
  select * into strict s from public.ocd_plus_subscriptions where user_id=p_user for update;
  if s.status='active' or s.current_period_end > now() or
     (s.hyp_subscription_id is not null and s.provider_cancelled_at is null) then
    return jsonb_build_object('blocked',true);
  end if;
  update public.users set shopify_customer_id=p_customer where id=p_user;
  update public.ocd_plus_subscriptions set shopify_customer_id=p_customer where id=s.id;
  select * into a from public.ocd_plus_payment_attempts where subscription_id=s.id and state in ('creating','ready','blocked');
  if found then
    return jsonb_build_object('attempt_id',a.id,'subscription_id',s.id,'state',a.state,'payment_url',a.payment_url,'created',false);
  end if;
  insert into public.ocd_plus_payment_attempts(subscription_id,state) values(s.id,'creating') returning * into a;
  return jsonb_build_object('attempt_id',a.id,'subscription_id',s.id,'state',a.state,'created',true);
end $$;

create or replace function public.ocd_apply_payment(
  p_reference uuid, p_transaction text, p_agreement text, p_success boolean,
  p_amount numeric, p_currency text, p_occurred_at timestamptz default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a public.ocd_plus_payment_attempts; s public.ocd_plus_subscriptions;
  e public.ocd_plus_payment_events; event_time timestamptz; period_end timestamptz;
begin
  if p_success is null or coalesce(p_transaction,'')='' or p_amount is null or p_currency is null then raise exception 'Missing payment fields'; end if;
  select * into a from public.ocd_plus_payment_attempts where id=p_reference;
  if not found then raise exception 'Unknown payment reference'; end if;
  select * into strict s from public.ocd_plus_subscriptions where id=a.subscription_id for update;
  -- A concurrent callback may have completed the attempt while we waited for
  -- the subscription lock. Re-read its state before making any decision.
  select * into strict a from public.ocd_plus_payment_attempts where id=p_reference;
  select * into e from public.ocd_plus_payment_events where hyp_transaction_id=p_transaction;
  if found then
    if e.subscription_id<>s.id or e.amount is distinct from p_amount or e.currency is distinct from p_currency or e.agreement_id is distinct from p_agreement or e.status <> (case when p_success then 'success' else 'failed' end) then
      raise exception 'Conflicting payment identity';
    end if;
    return jsonb_build_object('subscription_id',s.id,'duplicate',true,'status',s.status);
  end if;
  if p_success and (p_amount<>49 or p_currency<>'ILS' or coalesce(p_agreement,'')='') then raise exception 'Payment mismatch'; end if;
  if a.state='closed' then raise exception 'Closed payment attempt'; end if;
  if a.state='completed' and s.hyp_subscription_id is distinct from p_agreement then raise exception 'Different recurring agreement; manual reconciliation required'; end if;
  -- The initial completion is verified on arrival. Renewals require an independently
  -- verified billing timestamp; never extend a subscription just because a callback arrived.
  if a.state='completed' and p_occurred_at is null then raise exception 'Verified renewal timestamp required'; end if;
  event_time := coalesce(p_occurred_at, now());
  if event_time > now()+interval '5 minutes' then raise exception 'Future payment'; end if;
  insert into public.ocd_plus_payment_events(subscription_id,user_id,hyp_transaction_id,status,amount,currency,agreement_id,occurred_at,applied_at,order_state)
    values(s.id,s.user_id,p_transaction,case when p_success then 'success' else 'failed' end,p_amount,p_currency,p_agreement,event_time,now(),case when p_success then 'pending' else 'not_required' end) returning * into e;
  if p_success then
    period_end := event_time + interval '1 month';
    -- Out-of-order successful payments can be recorded but never shorten access.
    update public.ocd_plus_subscriptions set
      status=case when greatest(coalesce(current_period_end,period_end),period_end)>now() then 'active' else 'past_due' end,
      current_period_end=greatest(coalesce(current_period_end,period_end),period_end),
      next_billing_at=case when a.state<>'completed' or cancel_requested_at is null then greatest(coalesce(current_period_end,period_end),period_end) else null end,
      last_payment_at=greatest(coalesce(last_payment_at,event_time),event_time),
      hyp_subscription_id=p_agreement,
      -- A newly purchased agreement after confirmed cancellation starts a new term.
      cancel_at_period_end=case when a.state<>'completed' then false else cancel_at_period_end end,
      cancel_requested_at=case when a.state<>'completed' then null else cancel_requested_at end,
      provider_cancelled_at=case when a.state<>'completed' then null else provider_cancelled_at end,
      sync_version=sync_version+1,sync_retry_at=null
      where id=s.id;
    update public.ocd_plus_payment_attempts set state='completed',payment_url=null where id=a.id;
  elsif s.last_payment_at is null or event_time>=s.last_payment_at then
    update public.ocd_plus_subscriptions set status='past_due',sync_version=sync_version+1,sync_retry_at=null where id=s.id;
  end if;
  update public.users set ocd_plus_subscriber=exists(select 1 from public.ocd_plus_subscriptions where id=s.id and current_period_end>now() and status in ('active','past_due')) where id=s.user_id;
  return jsonb_build_object('subscription_id',s.id,'duplicate',false);
end $$;

create or replace function public.ocd_request_cancel(p_user uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare result uuid;
begin
  update public.ocd_plus_subscriptions set cancel_requested_at=coalesce(cancel_requested_at,now()),
    sync_version=sync_version+1,sync_retry_at=null where user_id=p_user returning id into result;
  return result;
end $$;

create or replace function public.ocd_expire_memberships()
returns void language plpgsql security invoker set search_path = '' as $$
begin
  with expired as (
    update public.ocd_plus_subscriptions set status=case when cancel_at_period_end then 'cancelled' else 'past_due' end,
      sync_version=sync_version+1,sync_retry_at=null
      where hyp_subscription_id is not null and current_period_end<=now() and (status='active' or (status='past_due' and cancel_at_period_end))
      returning user_id
  ) update public.users set ocd_plus_subscriber=false where id in (select user_id from expired);
end $$;

create or replace function public.ocd_claim_sync(p_id uuid default null)
returns setof public.ocd_plus_subscriptions language sql security invoker set search_path = '' as $$
  update public.ocd_plus_subscriptions set sync_token=gen_random_uuid(),sync_until=now()+interval '3 minutes'
  where id=(select id from public.ocd_plus_subscriptions where sync_version<>synced_version
    and (p_id is null or id=p_id) and (sync_until is null or sync_until<now())
    and (sync_retry_at is null or sync_retry_at<=now()) order by updated_at limit 1 for update skip locked)
  returning *;
$$;

-- SECURITY INVOKER: callers must have service-role privileges on the underlying
-- tables. Explicitly revoke PostgreSQL's default PUBLIC execute privilege.
revoke all on function public.ocd_begin_checkout(uuid,text) from public,anon,authenticated;
revoke all on function public.ocd_apply_payment(uuid,text,text,boolean,numeric,text,timestamptz) from public,anon,authenticated;
revoke all on function public.ocd_request_cancel(uuid) from public,anon,authenticated;
revoke all on function public.ocd_expire_memberships() from public,anon,authenticated;
revoke all on function public.ocd_claim_sync(uuid) from public,anon,authenticated;
grant execute on function public.ocd_begin_checkout(uuid,text), public.ocd_apply_payment(uuid,text,text,boolean,numeric,text,timestamptz), public.ocd_request_cancel(uuid), public.ocd_expire_memberships(), public.ocd_claim_sync(uuid) to service_role;
