-- When a job row is created (any kind), enqueue a targeted push for that worker.
-- run-scheduled-pushes sends only to push_tokens.user_id = target_user_id when set.

alter table public.push_notification_jobs
  add column if not exists target_user_id uuid null;

comment on column public.push_notification_jobs.target_user_id is
  'If set, Expo push is sent only to devices whose push_tokens.user_id matches (worker).';

create or replace function public.enqueue_push_job_for_worker()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.worker_id is null then
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
    'משימה חדשה',
    'הוקצתה לך משימה חדשה. פתח/י את האפליקציה לפרטים.',
    null,
    now(),
    'scheduled',
    NEW.worker_id
  );

  return NEW;
end;
$$;

drop trigger if exists enqueue_worker_push_after_job_insert on public.jobs;
create trigger enqueue_worker_push_after_job_insert
  after insert on public.jobs
  for each row
  execute function public.enqueue_push_job_for_worker();

drop trigger if exists enqueue_worker_push_after_installation_job_insert on public.installation_jobs;
create trigger enqueue_worker_push_after_installation_job_insert
  after insert on public.installation_jobs
  for each row
  execute function public.enqueue_push_job_for_worker();

drop trigger if exists enqueue_worker_push_after_special_job_insert on public.special_jobs;
create trigger enqueue_worker_push_after_special_job_insert
  after insert on public.special_jobs
  for each row
  execute function public.enqueue_push_job_for_worker();
