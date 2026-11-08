-- Only managed HYP memberships enter this worker. Manual legacy memberships
-- remain unchanged. Secrets are provisioned separately into Vault.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
alter function public.set_ocd_plus_subscriptions_updated_at() set search_path = '';

do $$
begin
  if not exists(select 1 from vault.secrets where name='ocd_maintenance_secret') or
     not exists(select 1 from vault.secrets where name='ocd_project_url') or
     not exists(select 1 from vault.secrets where name='ocd_project_anon_key') then
    raise exception 'Provision OCD maintenance Vault secrets before scheduling';
  end if;
end $$;

select cron.schedule('ocd-plus-sync', '* * * * *', $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='ocd_project_url') || '/functions/v1/ocd-plus-maintenance',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='ocd_project_anon_key'),
      'x-ocd-maintenance-secret',(select decrypted_secret from vault.decrypted_secrets where name='ocd_maintenance_secret')
    ),
    body := '{"action":"run"}'::jsonb,
    timeout_milliseconds := 55000
  );
$cron$);
