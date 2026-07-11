// ocd-plus-cancel
//
// Cancels an OCD+ membership.
//
// Auth: identity is taken ONLY from the verified `X-App-Session` token.
//
// Behaviour:
//   - Verifies the app user.
//   - Asks Hyp to stop the recurring charge (best-effort, if a cancel API exists).
//   - Cancellation is at end of period: sets cancel_at_period_end = true and
//     keeps access until current_period_end.
//   - If there is no remaining paid period, cancels immediately (status=cancelled,
//     OCD_PLUS_ACTIVE tag removed).
//
// NOTE: the end-of-period transition (active → cancelled once current_period_end
// passes) should be finalised by a scheduled job. See the TODO below.

import { CORS_HEADERS, jsonResponse } from '../_shared/cors.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { requireUserFromRequest } from '../_shared/authUser.ts';
import { removeOcdPlusTag } from '../_shared/shopifyAdmin.ts';
import { cancelHypSubscription } from '../_shared/hyp.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const supabase = createSupabaseAdmin();

    const user = await requireUserFromRequest(req, supabase);
    if (!user) return jsonResponse({ ok: false, error: 'לא מחובר' }, { status: 401 });

    const { data: subs, error: subErr } = await supabase
      .from('ocd_plus_subscriptions')
      .select('id, shopify_customer_id, hyp_subscription_id, current_period_end, status')
      .eq('user_id', user.id)
      .limit(1);
    if (subErr) return jsonResponse({ ok: false, error: subErr.message }, { status: 500 });
    const sub = (subs ?? [])[0] as
      | {
          id: string;
          shopify_customer_id: string | null;
          hyp_subscription_id: string | null;
          current_period_end: string | null;
          status: string;
        }
      | undefined;
    if (!sub) return jsonResponse({ ok: false, error: 'לא נמצא מנוי' }, { status: 404 });

    // Best-effort: stop the recurring charge at Hyp.
    if (sub.hyp_subscription_id) {
      try {
        await cancelHypSubscription(sub.hyp_subscription_id);
      } catch (e) {
        console.error('[ocd-plus-cancel] cancelHypSubscription failed:', e);
      }
    }

    const now = new Date();
    const graceActive = sub.current_period_end != null && new Date(sub.current_period_end) > now;

    if (graceActive) {
      // Keep access until the period ends; a scheduled finalizer flips it to
      // `cancelled` and removes the tag once current_period_end passes.
      //
      // TODO(cron): add a scheduled function (pg_cron / run-scheduled-* style)
      // that finds rows where cancel_at_period_end = true AND current_period_end
      // <= now(), sets status='cancelled', users.ocd_plus_subscriber=false and
      // calls removeOcdPlusTag(shopify_customer_id).
      await supabase
        .from('ocd_plus_subscriptions')
        .update({ cancel_at_period_end: true })
        .eq('id', sub.id);

      return jsonResponse({
        ok: true,
        status: 'active',
        cancel_at_period_end: true,
        current_period_end: sub.current_period_end,
      });
    }

    // No remaining paid period → cancel immediately.
    await supabase
      .from('ocd_plus_subscriptions')
      .update({ status: 'cancelled', cancel_at_period_end: true })
      .eq('id', sub.id);
    await supabase.from('users').update({ ocd_plus_subscriber: false }).eq('id', user.id);

    if (sub.shopify_customer_id) {
      try {
        await removeOcdPlusTag(sub.shopify_customer_id);
      } catch (e) {
        console.error('[ocd-plus-cancel] removeOcdPlusTag failed:', e);
      }
    }

    return jsonResponse({ ok: true, status: 'cancelled', cancel_at_period_end: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonResponse({ ok: false, error: message }, { status: 500 });
  }
});
