import { getAccessToken } from './appSession';
import { supabaseAnonKey, supabaseUrl } from './supabase';

export function normalizeProfileName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function isValidProfileName(name: string): boolean {
  const normalized = normalizeProfileName(name);
  return normalized.length >= 2 && normalized.length <= 80 && !/[\u0000-\u001F\u007F]/.test(normalized);
}

export function displayAccountPhone(phone?: string | null): string {
  const value = phone?.trim() ?? '';
  if (!value) return 'לא מופיע מספר טלפון בחשבון';
  // Historical accounts use both local and international Israeli numbers.
  return /^972\d{8,9}$/.test(value) ? `+${value}` : value;
}

export async function updateCustomerName(name: string): Promise<{ id: string; name: string }> {
  const normalized = normalizeProfileName(name);
  if (!isValidProfileName(normalized)) throw new Error('יש להזין שם באורך 2 עד 80 תווים');
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('לא ניתן לשמור את הפרטים כרגע');
  let token = await getAccessToken();
  if (!token) throw new Error('צריך להתחבר מחדש כדי לעדכן פרטים');

  const send = (accessToken: string) => fetch(`${supabaseUrl}/functions/v1/customer-profile`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: supabaseAnonKey,
      authorization: `Bearer ${supabaseAnonKey}`,
      'x-app-session': accessToken,
    },
    body: JSON.stringify({ name: normalized }),
  });
  let res = await send(token);
  if (res.status === 401) {
    token = await getAccessToken(true);
    if (token) res = await send(token);
  }
  if (res.status === 401) throw new Error('צריך להתחבר מחדש כדי לעדכן פרטים');
  const parsed = await res.json().catch(() => null);
  if (!res.ok || parsed?.ok !== true) {
    throw new Error(typeof parsed?.error === 'string' ? parsed.error : 'שמירת הפרטים נכשלה. נסו שוב.');
  }
  if (typeof parsed.profile?.id !== 'string' || typeof parsed.profile?.name !== 'string') {
    throw new Error('לא התקבל אישור לשמירת הפרטים. נסו שוב.');
  }
  return { id: parsed.profile.id, name: parsed.profile.name };
}
