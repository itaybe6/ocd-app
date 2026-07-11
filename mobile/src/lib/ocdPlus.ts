import { getAccessToken } from './appSession';
import { supabaseAnonKey, supabaseUrl } from './supabase';

/** OCD+ membership state as exposed to the app. `none` = never subscribed. */
export type OcdPlusStatus = 'none' | 'pending' | 'active' | 'past_due' | 'cancelled';

export type OcdPlusSubscription = {
  status: Exclude<OcdPlusStatus, 'none'>;
  next_billing_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export type OcdPlusStatusResult = {
  status: OcdPlusStatus;
  subscription: OcdPlusSubscription | null;
};

/** Thrown when the server responds that Hyp payments are not wired up yet. */
export class OcdPlusNotConfiguredError extends Error {}

/** Thrown when there is no valid app session (user must (re)login). */
export class OcdPlusUnauthorizedError extends Error {}

async function callEdgeFunction<T>(name: string, body: Record<string, unknown> = {}): Promise<T> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase לא מוגדר בבנייה הזו');
  }

  const doFetch = (accessToken: string | null) =>
    fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: supabaseAnonKey,
        authorization: `Bearer ${supabaseAnonKey}`,
        ...(accessToken ? { 'x-app-session': accessToken } : {}),
      },
      body: JSON.stringify(body),
    });

  let accessToken = await getAccessToken();
  let res = await doFetch(accessToken);

  // The session token may have just expired server-side → force one refresh.
  if (res.status === 401) {
    accessToken = await getAccessToken(true);
    if (accessToken) res = await doFetch(accessToken);
  }

  let parsed: any = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }

  if (parsed?.code === 'HYP_NOT_CONFIGURED' || res.status === 501) {
    throw new OcdPlusNotConfiguredError(parsed?.error ?? 'מערכת התשלום עדיין לא מחוברת');
  }

  if (res.status === 401) {
    throw new OcdPlusUnauthorizedError(parsed?.error ?? 'צריך להתחבר מחדש');
  }

  if (!res.ok || !parsed || parsed.ok === false) {
    const message = parsed?.error ?? parsed?.message ?? `${name} החזיר ${res.status}`;
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }

  return parsed as T;
}

/**
 * Start a 49₪/month membership purchase and get the Hyp paymentUrl to open.
 * Identity comes from the app session token (X-App-Session) — never the body.
 */
export async function createOcdPlusPayment(): Promise<{ paymentUrl: string }> {
  const res = await callEdgeFunction<{ ok: true; paymentUrl: string }>('ocd-plus-create-payment');
  return { paymentUrl: res.paymentUrl };
}

/** Read the current membership status from the server (source of truth). */
export async function getOcdPlusStatus(): Promise<OcdPlusStatusResult> {
  const res = await callEdgeFunction<{ ok: true; subscription: OcdPlusSubscription | null }>(
    'ocd-plus-status',
  );
  return {
    status: res.subscription?.status ?? 'none',
    subscription: res.subscription,
  };
}

/** Cancel the membership (end of period, or immediately if no paid period left). */
export async function cancelOcdPlus(): Promise<{
  status: OcdPlusStatus;
  cancel_at_period_end: boolean;
  current_period_end?: string | null;
}> {
  const res = await callEdgeFunction<{
    ok: true;
    status: OcdPlusStatus;
    cancel_at_period_end: boolean;
    current_period_end?: string | null;
  }>('ocd-plus-cancel');
  return {
    status: res.status,
    cancel_at_period_end: res.cancel_at_period_end,
    current_period_end: res.current_period_end ?? null,
  };
}
