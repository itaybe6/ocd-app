-- Extended customer profile fields collected during registration.
alter table public.users
  add column if not exists gender text,
  add column if not exists date_of_birth date,
  add column if not exists city text,
  add column if not exists email text;

comment on column public.users.gender is 'Customer gender: male | female | prefer_not_to_say (optional).';
comment on column public.users.date_of_birth is 'Customer date of birth (optional).';
comment on column public.users.city is 'Customer city.';
comment on column public.users.email is 'Customer email address.';
