-- Optional link from special_jobs to a registered or one-time customer (admin mobile create flow).

alter table public.special_jobs
  add column if not exists customer_id uuid references public.users(id) on delete set null;

alter table public.special_jobs
  add column if not exists one_time_customer_id uuid references public.one_time_customers(id) on delete set null;

create index if not exists special_jobs_customer_id_idx on public.special_jobs (customer_id)
  where customer_id is not null;

create index if not exists special_jobs_one_time_customer_id_idx on public.special_jobs (one_time_customer_id)
  where one_time_customer_id is not null;
