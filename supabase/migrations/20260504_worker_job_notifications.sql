-- In-app feed for workers: admin-assigned jobs + DB triggers for push on reassignment.

create table if not exists public.worker_job_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  body text not null,
  job_kind text not null check (job_kind in ('regular', 'installation', 'special')),
  job_id uuid not null,
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

create index if not exists worker_job_notifications_user_created_idx
  on public.worker_job_notifications (user_id, created_at desc);

create index if not exists worker_job_notifications_user_unread_idx
  on public.worker_job_notifications (user_id)
  where read_at is null;

alter table public.worker_job_notifications enable row level security;

drop policy if exists "worker_job_notifications_select_any" on public.worker_job_notifications;
create policy "worker_job_notifications_select_any" on public.worker_job_notifications
  for select using (true);

drop policy if exists "worker_job_notifications_update_any" on public.worker_job_notifications;
create policy "worker_job_notifications_update_any" on public.worker_job_notifications
  for update using (true) with check (true);

-- Insert: enqueue push + inbox row (replaces previous function body).
create or replace function public.enqueue_push_job_for_worker()
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
    k := 'regular';
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

  insert into public.worker_job_notifications (
    user_id,
    title,
    body,
    job_kind,
    job_id
  ) values (
    NEW.worker_id,
    'משימה חדשה',
    'הוקצתה לך משימה חדשה. פתח/י את האפליקציה לפרטים.',
    k,
    NEW.id
  );

  return NEW;
end;
$$;

-- Update: new worker gets push + inbox when assignment changes.
create or replace function public.enqueue_push_job_worker_reassigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
begin
  if NEW.worker_id is null or NEW.worker_id is not distinct from OLD.worker_id then
    return NEW;
  end if;

  if TG_TABLE_NAME = 'jobs' then
    k := 'regular';
  elsif TG_TABLE_NAME = 'installation_jobs' then
    k := 'installation';
  elsif TG_TABLE_NAME = 'special_jobs' then
    k := 'special';
  else
    k := 'regular';
  end if;

  insert into public.push_notification_jobs (
    title,
    body,
    image_url,
    scheduled_for,
    status,
    target_user_id
  ) values (
    'הוקצית למשימה',
    'עודכנה הקצאת משימה אליך. פתח/י את האפליקציה לפרטים.',
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
    'הוקצית למשימה',
    'עודכנה הקצאת משימה אליך. פתח/י את האפליקציה לפרטים.',
    k,
    NEW.id
  );

  return NEW;
end;
$$;

drop trigger if exists enqueue_worker_push_after_job_update on public.jobs;
create trigger enqueue_worker_push_after_job_update
  after update on public.jobs
  for each row
  execute function public.enqueue_push_job_worker_reassigned();

drop trigger if exists enqueue_worker_push_after_installation_job_update on public.installation_jobs;
create trigger enqueue_worker_push_after_installation_job_update
  after update on public.installation_jobs
  for each row
  execute function public.enqueue_push_job_worker_reassigned();

drop trigger if exists enqueue_worker_push_after_special_job_update on public.special_jobs;
create trigger enqueue_worker_push_after_special_job_update
  after update on public.special_jobs
  for each row
  execute function public.enqueue_push_job_worker_reassigned();
