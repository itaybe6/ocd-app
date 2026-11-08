// ocd-plus-status
//
// Returns the real OCD+ subscription state for the logged-in app user so the
// existing OCD+ screen can render the correct status (no design change).
//
// Auth: identity is taken ONLY from the verified `X-App-Session` token.
// Response:  { ok, subscription: { status, next_billing_at, current_period_end,
//                                   cancel_at_period_end } | null }

import { CORS_HEADERS, jsonResponse } from '../_shared/cors.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { requireUserFromRequest } from '../_shared/authUser.ts';
import { membershipIsActive, type MembershipRow } from '../_shared/ocdPlusLifecycle.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const supabase = createSupabaseAdmin();

    const user = await requireUserFromRequest(req, supabase);
    if (!user) return jsonResponse({ ok: false, error: 'לא מחובר' }, { status: 401 });

    const { data: subs, error } = await supabase
      .from('ocd_plus_subscriptions')
      .select('status, next_billing_at, current_period_end, cancel_at_period_end, hyp_subscription_id, cancel_requested_at, provider_cancelled_at, sync_version, synced_version')
      .eq('user_id', user.id)
      .limit(1);
    if (error) return jsonResponse({ ok: false, error: error.message }, { status: 500 });

    const sub = ((subs ?? [])[0] as MembershipRow | undefined) ?? null;
    if (!sub) return jsonResponse({ ok: true, subscription: null });
    return jsonResponse({ ok: true, subscription: {
      status: membershipIsActive(sub) ? 'active' : sub.status === 'active' ? 'past_due' : sub.status,
      next_billing_at: sub.next_billing_at, current_period_end: sub.current_period_end,
      cancel_at_period_end: sub.cancel_at_period_end,
      cancellation_pending: !!sub.cancel_requested_at && !sub.provider_cancelled_at,
      sync_pending: sub.sync_version !== sub.synced_version,
    } });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonResponse({ ok: false, error: message }, { status: 500 });
  }
});
