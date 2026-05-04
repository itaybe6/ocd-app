-- Push + inbox when admin updates mission details (time, notes, type, customer…).
-- Worker reassignment alone is handled by `enqueue_push_job_worker_reassigned`; this trigger skips worker_id-only changes via WHEN clauses.

create or replace function public.enqueue_push_job_worker_details_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
begin
  if NEW.worker_id is null then
    return NEW;
  end if;

  if TG_TABLE_NAME = 'jobs' then
    k := 'regular';
  elsif TG_TABLE_NAME = 'installation_jobs' then
    k := 'installation';
  elsif TG_TABLE_NAME = 'special_jobs' then
    k := 'special';
  else
    return NEW;
  end if;

  insert into public.push_notification_jobs (
    title,
    body,
    image_url,
    scheduled_for,
    status,
    target_user_id
  ) values (
    'עודכנה משימה',
    'פרטי המשימה עודכנו. פתח/י את האפליקציה לפרטים.',
    null,
    now(),
    'scheduled',
    NEW.worker_id
  );

  insert into public.worker_job_notifications (
    user_id,
    title,
    body,
    job_kind,
    job_id
  ) values (
    NEW.worker_id,
    'עודכנה משימה',
    'פרטי המשימה עודכנו. פתח/י את האפליקציה לפרטים.',
    k,
    NEW.id
  );

  return NEW;
end;
$$;

drop trigger if exists enqueue_worker_push_after_job_details_updated on public.jobs;
create trigger enqueue_worker_push_after_job_details_updated
  after update on public.jobs
  for each row
  when (
    new.worker_id is not null
    and (
      old.date is distinct from new.date
      or old.notes is distinct from new.notes
    )
  )
  execute function public.enqueue_push_job_worker_details_updated();

drop trigger if exists enqueue_worker_push_after_installation_job_details_updated on public.installation_jobs;
create trigger enqueue_worker_push_after_installation_job_details_updated
  after update on public.installation_jobs
  for each row
  when (
    new.worker_id is not null
    and (
      old.date is distinct from new.date
      or old.notes is distinct from new.notes
      or old.device_type is distinct from new.device_type
      or old.customer_id is distinct from new.customer_id
      or old.one_time_customer_id is distinct from new.one_time_customer_id
    )
  )
  execute function public.enqueue_push_job_worker_details_updated();

drop trigger if exists enqueue_worker_push_after_special_job_details_updated on public.special_jobs;
create trigger enqueue_worker_push_after_special_job_details_updated
  after update on public.special_jobs
  for each row
  when (
    new.worker_id is not null
    and (
      old.date is distinct from new.date
      or old.notes is distinct from new.notes
      or old.job_type is distinct from new.job_type
      or old.battery_type is distinct from new.battery_type
      or old.customer_id is distinct from new.customer_id
      or old.one_time_customer_id is distinct from new.one_time_customer_id
    )
  )
  execute function public.enqueue_push_job_worker_details_updated();
