// ocd-plus-create-payment
//
// Starts an OCD+ membership purchase (49₪/month via Hyp).
//
// Auth: identity is taken ONLY from the verified `X-App-Session` token.
//
// Flow:
//   1. Verify the logged-in app user (from the session token).
//   2. Resolve/create the user's Shopify customer id (Admin API, best-effort).
//   3. Upsert a `pending` ocd_plus_subscriptions row.
//   4. Ask Hyp to create a 49₪ payment and return its paymentUrl.
//
// The subscription is NEVER activated here — only a verified Hyp callback
// (ocd-plus-hyp-callback) flips it to `active`.
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto),
//          SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_API_TOKEN,
//          HYP_API_BASE_URL, HYP_MASOF/HYP_TERMINAL, HYP_API_KEY, HYP_CALLBACK_SECRET

import { CORS_HEADERS, jsonResponse } from '../_shared/cors.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { requireUserFromRequest } from '../_shared/authUser.ts';
import { findOrCreateCustomerByPhone } from '../_shared/shopifyAdmin.ts';
import {
  createHypPayment,
  OCD_PLUS_CURRENCY,
  OCD_PLUS_PRICE_ILS,
} from '../_shared/hyp.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const supabase = createSupabaseAdmin();

    const user = await requireUserFromRequest(req, supabase);
    if (!user) return jsonResponse({ ok: false, error: 'לא מחובר' }, { status: 401 });
    if (user.role !== 'customer') {
      return jsonResponse({ ok: false, error: 'רק לקוחות יכולים להצטרף ל-OCD+' }, { status: 403 });
    }

    // Prefer the Shopify customer already linked to the user; otherwise resolve
    // by phone (best-effort — don't block the join if Admin API isn't ready).
    let shopifyCustomerId: string | null = user.shopify_customer_id ?? null;
    if (!shopifyCustomerId) {
      try {
        shopifyCustomerId = await findOrCreateCustomerByPhone({ phone: user.phone, name: user.name });
      } catch (e) {
        console.error('[ocd-plus-create-payment] shopify customer resolve failed:', e);
      }
    }

    // Upsert a pending subscription row (one per user).
    const { data: upserted, error: upsertErr } = await supabase
      .from('ocd_plus_subscriptions')
      .upsert(
        {
          user_id: user.id,
          shopify_customer_id: shopifyCustomerId,
          status: 'pending',
          cancel_at_period_end: false,
        },
        { onConflict: 'user_id' },
      )
      .select('id, shopify_customer_id')
      .single();

    if (upsertErr) return jsonResponse({ ok: false, error: upsertErr.message }, { status: 500 });

    const subscriptionId = (upserted as { id: string }).id;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const callbackUrl = `${supabaseUrl}/functions/v1/ocd-plus-hyp-callback`;

    const payment = await createHypPayment({
      amount: OCD_PLUS_PRICE_ILS,
      currency: OCD_PLUS_CURRENCY,
      subscriptionId,
      userId: user.id,
      callbackUrl,
      customer: { name: user.name, phone: user.phone },
    });

    return jsonResponse({
      ok: true,
      status: 'pending',
      subscriptionId,
      paymentUrl: payment.paymentUrl,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Hyp not wired yet → surface a clear, non-fatal signal to the client.
    const notImplemented = message.includes('not implemented') || message.includes('not configured');
    return jsonResponse(
      { ok: false, error: message, code: notImplemented ? 'HYP_NOT_CONFIGURED' : undefined },
      { status: notImplemented ? 501 : 500 },
    );
  }
});
