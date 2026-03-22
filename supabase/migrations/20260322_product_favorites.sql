-- Customer product favorites
-- Stores liked Shopify products per customer user.

create extension if not exists "pgcrypto";

create table if not exists public.product_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id text not null,
  product_handle text not null,
  product_title text not null,
  product_description text null,
  product_type text null,
  image_url text null,
  image_alt_text text null,
  price numeric(12, 2) not null,
  currency_code text not null default 'ILS',
  created_at timestamptz not null default now(),
  constraint product_favorites_user_product_unique unique (user_id, product_id)
);

create index if not exists product_favorites_user_created_at_idx
  on public.product_favorites (user_id, created_at desc);

create or replace function public.ensure_product_favorite_customer()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.users
    where id = new.user_id
      and role = 'customer'
  ) then
    raise exception 'product favorites can only be saved for customer users';
  end if;

  return new;
end;
$$;

drop trigger if exists product_favorites_customer_guard on public.product_favorites;
create trigger product_favorites_customer_guard
before insert or update on public.product_favorites
for each row
execute function public.ensure_product_favorite_customer();

alter table public.product_favorites enable row level security;

-- NOTE:
-- This project currently uses a custom users table instead of Supabase Auth/JWT sessions,
-- so the anon client cannot be scoped to auth.uid() yet. Policies stay permissive and the app
-- must always query/write favorites with the logged-in customer's user_id.
drop policy if exists "product_favorites_select_any" on public.product_favorites;
create policy "product_favorites_select_any" on public.product_favorites
  for select
  using (true);

drop policy if exists "product_favorites_insert_any" on public.product_favorites;
create policy "product_favorites_insert_any" on public.product_favorites
  for insert
  with check (true);

drop policy if exists "product_favorites_update_any" on public.product_favorites;
create policy "product_favorites_update_any" on public.product_favorites
  for update
  using (true)
  with check (true);

drop policy if exists "product_favorites_delete_any" on public.product_favorites;
create policy "product_favorites_delete_any" on public.product_favorites
  for delete
  using (true);
