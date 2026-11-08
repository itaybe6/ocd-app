import { jsonResponse } from '../_shared/cors.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { verifyHypTransaction } from '../_shared/hyp.ts';
import { syncMembership } from '../_shared/ocdPlusLifecycle.ts';

// Public endpoint. Only a server-verified HYP completion can change membership.
Deno.serve(async req => {
  if (!['GET', 'POST'].includes(req.method)) return jsonResponse({ ok: false }, { status: 405 });
  try {
    if (req.method === 'POST' && !req.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) {
      return jsonResponse({ ok: false, error: 'Expected original form parameters' }, { status: 415 });
    }
    const raw = req.method === 'GET' ? new URL(req.url).search.slice(1) : await req.text();
    const verified = await verifyHypTransaction(raw);
    if (!verified.subscriptionId || !/^[0-9a-f-]{36}$/i.test(verified.subscriptionId)) throw new Error('Invalid reference');
    const db = createSupabaseAdmin();
    const applied = await db.rpc('ocd_apply_payment', {
      p_reference: verified.subscriptionId, p_transaction: verified.transactionId,
      p_agreement: verified.hypSubscriptionId ?? null, p_success: verified.success,
      p_amount: verified.amount, p_currency: verified.currency,
    });
    if (applied.error) {
      console.error('[ocd-payment] atomic_apply_failed', applied.error.code);
      return jsonResponse({ ok: false, error: 'לא הצלחנו לעדכן את החברות. אם חויבתם, פנו לשירות ולא בצעו תשלום נוסף.' }, { status: 503 });
    }
    const appliedPayment = applied.data as { subscription_id: string };
    const sync = await syncMembership(db, appliedPayment.subscription_id).catch(() => 'retry');
    return jsonResponse({ ok: true, paymentApproved: verified.success, syncPending: sync === 'retry',
      message: verified.success ? 'התשלום אושר. אפשר לחזור לאפליקציה ולבדוק את החברות.' : 'התשלום לא אושר.' });
  } catch {
    return jsonResponse({ ok: false, error: 'לא ניתן לאמת את פרטי התשלום.' }, { status: 400 });
  }
});
