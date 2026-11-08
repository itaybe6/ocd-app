import { CORS_HEADERS, jsonResponse } from '../_shared/cors.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { requireUserFromRequest } from '../_shared/authUser.ts';
import { findOrCreateCustomerByPhone, getCustomerById } from '../_shared/shopifyAdmin.ts';
import { assertHypCheckoutReady, createHypPayment, OCD_PLUS_PRICE_ILS, OCD_PLUS_CURRENCY } from '../_shared/hyp.ts';
import { expireMemberships } from '../_shared/ocdPlusLifecycle.ts';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ ok: false }, { status: 405 });
  const db = createSupabaseAdmin();
  let attemptId: string | undefined;
  try {
    const user = await requireUserFromRequest(req, db);
    if (!user || user.role !== 'customer') return jsonResponse({ ok: false, error: 'צריך להתחבר לחשבון לקוח' }, { status: 401 });
    try { assertHypCheckoutReady(user.id); } catch {
      return jsonResponse({ ok: false, code: 'HYP_NOT_CONFIGURED', error: 'ההצטרפות למועדון עדיין אינה זמינה' }, { status: 501 });
    }
    await expireMemberships(db);
    const linkedCustomer = user.shopify_customer_id ? await getCustomerById(user.shopify_customer_id) : null;
    const customerId = linkedCustomer?.id || await findOrCreateCustomerByPhone({ phone: user.phone, name: user.name });
    const begun = await db.rpc('ocd_begin_checkout', { p_user: user.id, p_customer: customerId });
    if (begun.error || !begun.data) throw new Error('Could not begin checkout');
    const attempt = begun.data as { blocked?: boolean; created?: boolean; state?: string; payment_url?: string; attempt_id?: string };
    if (attempt.blocked) return jsonResponse({ ok: false, error: 'כבר קיימת חברות או הוראת חיוב. יש לנהל אותה באזור האישי.' }, { status: 409 });
    if (!attempt.created) {
      if (attempt.state === 'ready' && attempt.payment_url) return jsonResponse({ ok: true, paymentUrl: attempt.payment_url });
      return jsonResponse({ ok: false, error: 'בקשת התשלום נמצאת בבדיקה. נסו שוב בעוד רגע או פנו לשירות.' }, { status: 409 });
    }
    if (!attempt.attempt_id) throw new Error('Missing payment attempt');
    attemptId = attempt.attempt_id;
    const payment = await createHypPayment({
      amount: OCD_PLUS_PRICE_ILS, currency: OCD_PLUS_CURRENCY,
      subscriptionId: attempt.attempt_id, userId: user.id,
      callbackUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/ocd-plus-hyp-callback`,
      customer: { name: user.name, phone: user.phone },
    });
    const saved = await db.from('ocd_plus_payment_attempts').update({ state: 'ready', payment_url: payment.paymentUrl })
      .eq('id', attemptId).eq('state', 'creating').select('id').single();
    if (saved.error) throw new Error('Could not persist payment page');
    return jsonResponse({ ok: true, paymentUrl: payment.paymentUrl });
  } catch {
    if (attemptId) await db.from('ocd_plus_payment_attempts').update({ state: 'blocked' }).eq('id', attemptId).eq('state', 'creating');
    return jsonResponse({ ok: false, error: 'לא ניתן להכין את התשלום כרגע. נסו שוב מאוחר יותר.' }, { status: 502 });
  }
});
