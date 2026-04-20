-- Customer membership flag for OCD+ pricing in the mobile store.
alter table public.users
  add column if not exists ocd_plus_subscriber boolean not null default false;

comment on column public.users.ocd_plus_subscriber is 'When true, customer sees member OCD+ pricing without join CTA in the store.';
