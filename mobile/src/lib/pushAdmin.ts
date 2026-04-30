import { supabase } from './supabase';

/** Processes due rows in push_notification_jobs (worker-targeted or broadcast). */
export async function flushScheduledPushJobs(opts?: { limit?: number }) {
  const secret = process.env.EXPO_PUBLIC_ADMIN_BROADCAST_SECRET?.trim();
  if (!secret) return { ok: false as const, skipped: true as const, reason: 'no_admin_secret' };

  const { data, error } = await supabase.functions.invoke('run-scheduled-pushes', {
    body: { limit: opts?.limit ?? 25 },
    headers: { 'x-admin-secret': secret },
  });
  if (error) throw error;
  return { ok: true as const, skipped: false as const, data };
}
