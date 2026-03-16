import { createClient } from '@supabase/supabase-js';

function requireEnv(name: 'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_ANON_KEY'): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export const supabaseUrl = requireEnv('EXPO_PUBLIC_SUPABASE_URL');
export const supabaseAnonKey = requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

export const JOB_IMAGES_BUCKET = 'job-images' as const;

