-- Allow special jobs with no customer (internal / warehouse tasks).
-- Previous check often required at least one of customer_id / one_time_customer_id.
-- New rule: at most one of them may be set; both null is OK.

alter table public.special_jobs
  drop constraint if exists special_jobs_customer_check;

alter table public.special_jobs
  add constraint special_jobs_customer_check
  check (
    not (customer_id is not null and one_time_customer_id is not null)
  );
