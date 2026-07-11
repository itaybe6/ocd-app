import type { SupabaseAdmin } from './supabaseAdmin.ts';
import { phoneLookupVariants } from './phone.ts';
import { verifyAppSession } from './appSession.ts';

export type AppUser = {
  id: string;
  phone: string;
  name: string;
  role: string;
  ocd_plus_subscriber: boolean | null;
  shopify_customer_id: string | null;
};

const APP_USER_COLUMNS = 'id, phone, name, role, ocd_plus_subscriber, shopify_customer_id';

async function loadUserById(supabase: SupabaseAdmin, userId: string): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select(APP_USER_COLUMNS)
    .eq('id', userId)
    .limit(1);
  if (error) throw new Error(error.message);
  return ((data ?? [])[0] as AppUser | undefined) ?? null;
}

/**
 * Authenticate the caller from a verified app session token (header
 * `X-App-Session`). The user id is taken ONLY from the token's `sub` claim —
 * never from the request body — so a caller can never act on another user.
 *
 * Returns the user row, or null when the token is missing/invalid/expired or
 * the user no longer exists.
 */
export async function requireUserFromRequest(
  req: Request,
  supabase: SupabaseAdmin,
): Promise<AppUser | null> {
  const token = (req.headers.get('x-app-session') ?? '').trim();
  if (!token) return null;

  const claims = await verifyAppSession(token);
  if (!claims?.sub) return null;

  return loadUserById(supabase, claims.sub);
}

/**
 * @deprecated Legacy body-based identity (userId + optional phone). Kept only
 * for reference; do NOT use for sensitive operations — it trusts a client-
 * supplied user id. Use `requireUserFromRequest` instead.
 */
export async function verifyAppUser(
  supabase: SupabaseAdmin,
  args: { userId?: string | null; phone?: string | null },
): Promise<AppUser | null> {
  const userId = (args.userId ?? '').trim();
  if (!userId) return null;

  const row = await loadUserById(supabase, userId);
  if (!row) return null;

  const phone = (args.phone ?? '').trim();
  if (phone) {
    const variants = phoneLookupVariants(phone);
    if (!variants.includes(row.phone)) return null;
  }
  return row;
}
