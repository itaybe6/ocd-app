// ocd-plus-hyp-callback
//
// Server-to-server callback from Hyp after a payment attempt. This is the ONLY
// place a subscription becomes `active`. The app's return-from-browser is never
// trusted.
//
// Guarantees:
//   - Verifies the transaction against Hyp (verifyHypTransaction).
//   - Idempotent: the unique `hyp_transaction_id` in ocd_plus_payment_events
//     prevents the same transaction from being processed twice.
//   - On success  → status=active, dates advanced, Shopify OCD_PLUS_ACTIVE tag added.
//   - On failure  → status=past_due, tag removed if there is no grace period.
//
// Deploy WITHOUT JWT verification (public webhook):
//   supabase functions deploy ocd-plus-hyp-callback --no-verify-jwt
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto),
//          SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_API_TOKEN,
//          HYP_* (see _shared/hyp.ts)

import { CORS_HEADERS, jsonResponse } from '../_shared/cors.ts';
import { createSupabaseAdmin, type SupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { addOcdPlusTag, findOrCreateCustomerByPhone, removeOcdPlusTag } from '../_shared/shopifyAdmin.ts';
import { verifyHypTransaction } from '../_shared/hyp.ts';

function addOneMonth(from: Date): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}

async function readPayload(req: Request): Promise<Record<string, unknown>> {
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await req.json()) as Record<string, unknown>;
  }
  // Hyp commonly posts form-encoded data.
  const text = await req.text();
  const params = new URLSearchParams(text);
  const out: Record<string, unknown> = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

/** Ensure we have a Shopify customer id for the subscription's user. */
async function resolveShopifyCustomerId(
  supabase: SupabaseAdmin,
  sub: { id: string; user_id: string; shopify_customer_id: string | null },
): Promise<string | null> {
  if (sub.shopify_customer_id) return sub.shopify_customer_id;

  const { data: userRows } = await supabase
    .from('users')
    .select('phone, name')
    .eq('id', sub.user_id)
    .limit(1);
  const u = (userRows ?? [])[0] as { phone: string; name: string } | undefined;
  if (!u) return null;

  try {
    const id = await findOrCreateCustomerByPhone({ phone: u.phone, name: u.name });
    await supabase.from('ocd_plus_subscriptions').update({ shopify_customer_id: id }).eq('id', sub.id);
    return id;
  } catch (e) {
    console.error('[ocd-plus-hyp-callback] resolve shopify customer failed:', e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const payload = await readPayload(req);

    // 1) Verify server-to-server. Throws if Hyp is not configured / signature bad.
    const verified = await verifyHypTransaction(payload);
    if (!verified.transactionId) {
      return jsonResponse({ ok: false, error: 'Missing transaction id' }, { status: 400 });
    }

    // 2) Idempotency guard: record the event first. A duplicate transaction id
    //    hits the unique index and means we already processed it.
    const { error: eventErr } = await supabase.from('ocd_plus_payment_events').insert({
      hyp_transaction_id: verified.transactionId,
      subscription_id: verified.subscriptionId ?? null,
      status: verified.success ? 'success' : 'failed',
      amount: verified.amount ?? null,
      currency: verified.currency ?? null,
      raw: (verified.raw ?? payload) as unknown,
    });
    if (eventErr) {
      const duplicate = eventErr.code === '23505' || (eventErr.message ?? '').includes('duplicate');
      if (duplicate) return jsonResponse({ ok: true, alreadyProcessed: true });
      return jsonResponse({ ok: false, error: eventErr.message }, { status: 500 });
    }

    // 3) Locate the subscription.
    let subQuery = supabase
      .from('ocd_plus_subscriptions')
      .select('id, user_id, shopify_customer_id, current_period_end, status');
    subQuery = verified.subscriptionId
      ? subQuery.eq('id', verified.subscriptionId)
      : subQuery.eq('hyp_subscription_id', verified.hypSubscriptionId ?? '__none__');

    const { data: subs, error: subErr } = await subQuery.limit(1);
    if (subErr) return jsonResponse({ ok: false, error: subErr.message }, { status: 500 });
    const sub = (subs ?? [])[0] as
      | { id: string; user_id: string; shopify_customer_id: string | null; current_period_end: string | null; status: string }
      | undefined;
    if (!sub) return jsonResponse({ ok: false, error: 'Subscription not found' }, { status: 404 });

    const now = new Date();

    if (verified.success) {
      const nextBilling = addOneMonth(now);
      await supabase
        .from('ocd_plus_subscriptions')
        .update({
          status: 'active',
          last_payment_at: now.toISOString(),
          current_period_end: nextBilling.toISOString(),
          next_billing_at: nextBilling.toISOString(),
          hyp_subscription_id: verified.hypSubscriptionId ?? null,
          cancel_at_period_end: false,
        })
        .eq('id', sub.id);

      await supabase.from('users').update({ ocd_plus_subscriber: true }).eq('id', sub.user_id);

      const customerId = await resolveShopifyCustomerId(supabase, sub);
      if (customerId) {
        try {
          await addOcdPlusTag(customerId);
        } catch (e) {
          console.error('[ocd-plus-hyp-callback] addOcdPlusTag failed:', e);
        }
      }

      return jsonResponse({ ok: true, status: 'active' });
    }

    // Payment failed → past_due. Remove access if there is no grace period left.
    await supabase.from('ocd_plus_subscriptions').update({ status: 'past_due' }).eq('id', sub.id);

    const graceActive = sub.current_period_end != null && new Date(sub.current_period_end) > now;
    if (!graceActive) {
      await supabase.from('users').update({ ocd_plus_subscriber: false }).eq('id', sub.user_id);
      if (sub.shopify_customer_id) {
        try {
          await removeOcdPlusTag(sub.shopify_customer_id);
        } catch (e) {
          console.error('[ocd-plus-hyp-callback] removeOcdPlusTag failed:', e);
        }
      }
    }

    return jsonResponse({ ok: true, status: 'past_due' });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonResponse({ ok: false, error: message }, { status: 500 });
  }
});
