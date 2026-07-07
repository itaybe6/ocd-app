import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// IMPORTANT: Read each EXPO_PUBLIC_* var via *static* dot-notation only.
// Babel / Metro inline `process.env.EXPO_PUBLIC_FOO` at build time, but
// dynamic forms like `process.env[name]` are NOT inlined and end up as
// `undefined` in production builds — which is exactly what caused the
// TestFlight 401 ("Missing authorization header") on auth-phone-otp,
// while Expo Go (which populates process.env at runtime from .env)
// kept working.
function nonEmpty(v: string | undefined): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

const _supabaseUrl = nonEmpty(process.env.EXPO_PUBLIC_SUPABASE_URL);
const _supabaseAnonKey = nonEmpty(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

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

/**
 * Safe runtime diagnostics for the Supabase env vars. Useful when the JS
 * bundle was built before EAS env was set, so `EXPO_PUBLIC_SUPABASE_*` end up
 * inlined as empty strings and the app silently fails with 401 on Edge
 * Functions ("Missing authorization header"). Does NOT expose secrets.
 */
export function getSupabaseEnvDiagnostics() {
  return {
    urlPresent: supabaseUrl.length > 0,
    urlHost: supabaseUrl ? safeHost(supabaseUrl) : null,
    anonKeyPresent: supabaseAnonKey.length > 0,
    anonKeyLength: supabaseAnonKey.length,
    anonKeyTail: supabaseAnonKey ? supabaseAnonKey.slice(-4) : null,
  };
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'invalid-url';
  }
}

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
