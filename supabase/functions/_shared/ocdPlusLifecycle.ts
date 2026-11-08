import type { SupabaseAdmin } from './supabaseAdmin.ts';
import { addOcdPlusTag, removeOcdPlusTag, findOrCreateCustomerByPhone } from './shopifyAdmin.ts';
import { cancelHypSubscription } from './hyp.ts';

export type MembershipRow = {
  id: string; user_id: string; status: string; current_period_end: string | null;
  hyp_subscription_id: string | null; shopify_customer_id: string | null;
  cancel_requested_at: string | null; provider_cancelled_at: string | null;
  cancel_at_period_end: boolean; next_billing_at: string | null;
  sync_token: string; sync_version: number; synced_version: number;
};

export function membershipIsActive(sub: { status: string; current_period_end: string | null; hyp_subscription_id?: string | null }, now = Date.now()) {
  // Existing manually managed memberships do not belong to this payment flow.
  if (!sub.hyp_subscription_id) return sub.status === 'active';
  return ['active', 'past_due'].includes(sub.status) && !!sub.current_period_end && Date.parse(sub.current_period_end) > now;
}

export async function expireMemberships(db: SupabaseAdmin) {
  const { error } = await db.rpc('ocd_expire_memberships');
  if (error) throw new Error('Membership expiry failed');
}

/** Durable revisions and a lease serialize Shopify updates per membership.
 * Crashes leave work pending; an old worker cannot acknowledge a newer revision.
 */
export async function syncMembership(db: SupabaseAdmin, id?: string): Promise<'idle' | 'synced' | 'retry'> {
  const { data, error } = await db.rpc('ocd_claim_sync', { p_id: id ?? null });
  if (error) throw new Error('Could not claim membership sync');
  const sub = (data as MembershipRow[] | null)?.[0];
  if (!sub) return 'idle';
  let stage = 'customer';
  try {
    let customerId = sub.shopify_customer_id;
    if (!customerId) {
      const user = await db.from('users').select('phone,name').eq('id', sub.user_id).single();
      if (user.error || !user.data) throw new Error('Missing user');
      customerId = await findOrCreateCustomerByPhone({ phone: String(user.data.phone), name: String(user.data.name ?? '') });
      const linked = await db.from('ocd_plus_subscriptions').update({ shopify_customer_id: customerId }).eq('id', sub.id);
      if (linked.error) throw new Error('Could not link customer');
    }
    const linkedUser = await db.from('users').update({ shopify_customer_id: customerId }).eq('id', sub.user_id);
    if (linkedUser.error) throw new Error('Could not link user');
    if (sub.cancel_requested_at && !sub.provider_cancelled_at) {
      stage = 'cancel';
      if (!sub.hyp_subscription_id) throw new Error('Missing agreement');
      const stopped = await cancelHypSubscription(sub.hyp_subscription_id);
      if (!stopped.ok) throw new Error('Cancellation unconfirmed');
      const active = membershipIsActive(sub);
      const confirmed = await db.from('ocd_plus_subscriptions').update({
        provider_cancelled_at: new Date().toISOString(), cancel_at_period_end: true,
        next_billing_at: null, ...(active ? {} : { status: 'cancelled' }),
      }).eq('id', sub.id).eq('hyp_subscription_id', sub.hyp_subscription_id).eq('sync_token', sub.sync_token);
      if (confirmed.error) throw new Error('Could not persist cancellation');
      if (!active) sub.status = 'cancelled';
    }
    stage = 'shopify_tag';
    const active = membershipIsActive(sub);
    if (active) await addOcdPlusTag(customerId);
    else await removeOcdPlusTag(customerId);
    // Entitlements are updated in the payment/expiry transaction. Do not
    // overwrite them here from a potentially stale network snapshot.
    const saved = await db.from('ocd_plus_subscriptions').update({
      synced_version: sub.sync_version, sync_error: null, sync_retry_at: null,
    }).eq('id', sub.id).eq('sync_token', sub.sync_token).eq('sync_version', sub.sync_version);
    if (saved.error) throw new Error('Could not acknowledge sync');
    return 'synced';
  } catch {
    // Store an allowlisted stage only: no credentials, payment URLs or PII.
    await db.from('ocd_plus_subscriptions').update({
      sync_error: stage, sync_retry_at: new Date(Date.now() + 60_000).toISOString(),
    }).eq('id', sub.id).eq('sync_token', sub.sync_token);
    return 'retry';
  } finally {
    await db.from('ocd_plus_subscriptions').update({ sync_token: null, sync_until: null })
      .eq('id', sub.id).eq('sync_token', sub.sync_token);
  }
}
