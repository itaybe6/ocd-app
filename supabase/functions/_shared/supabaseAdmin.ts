import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export type SupabaseAdmin = ReturnType<typeof createClient>;

/**
 * Service-role Supabase client. Bypasses RLS — use ONLY inside Edge Functions,
 * never expose the service-role key to the app.
 */
export function createSupabaseAdmin(): SupabaseAdmin {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
