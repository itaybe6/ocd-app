import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type EnvName = 'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_ANON_KEY';

function readEnv(name: EnvName): string | undefined {
  const v = process.env[name];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

const _supabaseUrl = readEnv('EXPO_PUBLIC_SUPABASE_URL');
const _supabaseAnonKey = readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');

if (!_supabaseUrl || !_supabaseAnonKey) {
  // Log but do NOT throw at module-load: throwing here causes a silent
  // white-screen in production (the error happens before the React tree
  // mounts so the ErrorBoundary cannot catch it). The first real call
  // against `supabase` will throw a descriptive error that surfaces in
  // the on-screen DebugLogOverlay / ErrorBoundary instead.
  // eslint-disable-next-line no-console
  console.error(
    `[supabase] Missing env vars at module init. ` +
      `EXPO_PUBLIC_SUPABASE_URL=${_supabaseUrl ? 'set' : 'MISSING'} ` +
      `EXPO_PUBLIC_SUPABASE_ANON_KEY=${_supabaseAnonKey ? 'set' : 'MISSING'}`
  );
}

export const supabaseUrl = _supabaseUrl ?? '';
export const supabaseAnonKey = _supabaseAnonKey ?? '';

function buildClient(): SupabaseClient {
  if (!_supabaseUrl || !_supabaseAnonKey) {
    throw new Error(
      'Supabase env vars missing. Ensure EXPO_PUBLIC_SUPABASE_URL and ' +
        'EXPO_PUBLIC_SUPABASE_ANON_KEY are defined for the active EAS build profile.'
    );
  }
  return createClient(_supabaseUrl, _supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

let _client: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  if (_client) return _client;
  _client = buildClient();
  return _client;
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const c = getClient();
    const value = Reflect.get(c as object, prop, receiver);
    return typeof value === 'function' ? value.bind(c) : value;
  },
});

export const JOB_IMAGES_BUCKET = 'job-images' as const;
export const USER_AVATARS_BUCKET = 'user-avatars' as const;
