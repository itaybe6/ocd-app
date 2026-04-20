-- Remove product targeting from broadcast push log and job queue.

alter table public.push_notifications
  drop column if exists product_handle,
  drop column if exists product_title;

alter table public.push_notification_jobs
  drop column if exists scope,
  drop column if exists product_handles;
