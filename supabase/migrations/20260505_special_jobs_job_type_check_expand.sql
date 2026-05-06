-- Admin app uses job_type codes from `ADMIN_SPECIAL_JOB_TYPES` (e.g. device_issue, customer_request, other).
-- Legacy rows may still use older codes. Widen the check so updates/inserts from the app do not fail.

alter table public.special_jobs
  drop constraint if exists special_jobs_job_type_check;

alter table public.special_jobs
  add constraint special_jobs_job_type_check
  check (
    job_type = any (
      array[
        -- legacy (existing data)
        'scent_spread',
        'plants',
        'batteries',
        'repairs',
        -- admin mobile (`AdminCreateJobSheet`)
        'device_issue',
        'customer_request',
        'other'
      ]::text[]
    )
  );
