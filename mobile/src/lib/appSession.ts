import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabaseAnonKey, supabaseUrl } from './supabase';

/**
 * Client-side storage + refresh for the app session tokens.
 *
 * - Access token: short-lived HS256 JWT. Sent to Edge Functions as the
 *   `X-App-Session` header. The app never verifies or signs it.
 * - Refresh token: opaque secret used to obtain a new access token via the
 *   `auth-phone-otp` function (action `refresh_session`).
 *
 * Tokens live in SecureStore on device (falls back to AsyncStorage on web,
 * where SecureStore is unavailable).
 */

const ACCESS_KEY = 'ocd_app_access_token';
const ACCESS_EXP_KEY = 'ocd_app_access_exp';
const REFRESH_KEY = 'ocd_app_refresh_token';

const useSecure = Platform.OS !== 'web';

async function setItem(key: string, value: string | null): Promise<void> {
  if (value == null) {
    await removeItem(key);
    return;
  }
  if (useSecure) {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch {
      // fall through to AsyncStorage
    }
  }
  await AsyncStorage.setItem(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (useSecure) {
    try {
      const v = await SecureStore.getItemAsync(key);
      if (v != null) return v;
    } catch {
      // fall through to AsyncStorage
    }
  }
  return AsyncStorage.getItem(key);
}

async function removeItem(key: string): Promise<void> {
  if (useSecure) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore
    }
  }
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export type SessionPart = { accessToken: string; expiresAt: string };
export type RefreshPart = { token: string; expiresAt: string };

export async function storeSession(session?: SessionPart, refresh?: RefreshPart): Promise<void> {
  if (session?.accessToken) {
    await setItem(ACCESS_KEY, session.accessToken);
    await setItem(ACCESS_EXP_KEY, session.expiresAt ?? '');
  }
  if (refresh?.token) {
    await setItem(REFRESH_KEY, refresh.token);
  }
}

export async function clearSession(): Promise<void> {
  await removeItem(ACCESS_KEY);
  await removeItem(ACCESS_EXP_KEY);
  await removeItem(REFRESH_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return getItem(REFRESH_KEY);
}

let refreshInFlight: Promise<RefreshSessionPayload | null> | null = null;

type RefreshSessionPayload = {
  accessToken: string;
  session: SessionPart;
  refresh?: RefreshPart;
  user: Record<string, unknown> | null;
};

async function fetchRefreshSession(): Promise<RefreshSessionPayload | null> {
  const refresh = await getItem(REFRESH_KEY);
  if (!refresh || !supabaseUrl || !supabaseAnonKey) return null;

  const res = await fetch(`${supabaseUrl}/functions/v1/auth-phone-otp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: supabaseAnonKey,
      authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ action: 'refresh_session', refreshToken: refresh }),
  });

  const parsed = await res.json().catch(() => null);
  if (!res.ok || !parsed?.ok || !parsed.session?.accessToken) {
    if (res.status === 401) await clearSession();
    return null;
  }

  const session: SessionPart = {
    accessToken: parsed.session.accessToken as string,
    expiresAt: parsed.session.expiresAt as string,
  };
  const refreshPart: RefreshPart | undefined = parsed.refresh?.token
    ? { token: parsed.refresh.token as string, expiresAt: parsed.refresh.expiresAt as string }
    : undefined;

  await storeSession(session, refreshPart);

  return {
    accessToken: session.accessToken,
    session,
    refresh: refreshPart,
    user: (parsed.user as Record<string, unknown> | null) ?? null,
  };
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) {
    const existing = await refreshInFlight;
    return existing?.accessToken ?? null;
  }
  refreshInFlight = (async () => {
    try {
      return await fetchRefreshSession();
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  const result = await refreshInFlight;
  return result?.accessToken ?? null;
}

/**
 * On cold start: rotate the refresh token and return the fresh user row from
 * the server (includes up-to-date ocd_plus_subscriber). Returns null when there
 * is no stored refresh token or the session was revoked.
 */
export async function restoreSession(): Promise<{
  session: SessionPart;
  refresh?: RefreshPart;
  user: Record<string, unknown> | null;
} | null> {
  try {
    const result = await fetchRefreshSession();
    if (!result) return null;
    return { session: result.session, refresh: result.refresh, user: result.user };
  } catch {
    return null;
  }
}

/**
 * Returns a valid access token, refreshing it when missing/near expiry (or when
 * `force` is set). Returns null when there is no usable session.
 */
export async function getAccessToken(force = false): Promise<string | null> {
  if (!force) {
    const token = await getItem(ACCESS_KEY);
    const expStr = await getItem(ACCESS_EXP_KEY);
    const exp = expStr ? Date.parse(expStr) : 0;
    const refreshSoon = !exp || Date.now() > exp - 60_000; // refresh 1 min early
    if (token && !refreshSoon) return token;
  }
  return refreshAccessToken();
}
