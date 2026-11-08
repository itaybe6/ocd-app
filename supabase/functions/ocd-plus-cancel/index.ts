import { CORS_HEADERS, jsonResponse } from '../_shared/cors.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { requireUserFromRequest } from '../_shared/authUser.ts';
import { membershipIsActive, syncMembership, type MembershipRow } from '../_shared/ocdPlusLifecycle.ts';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ ok: false }, { status: 405 });
  try {
    const db = createSupabaseAdmin();
    const user = await requireUserFromRequest(req, db);
    if (!user) return jsonResponse({ ok: false, error: 'לא מחובר' }, { status: 401 });
    const found = await db.from('ocd_plus_subscriptions').select('id,hyp_subscription_id').eq('user_id', user.id).maybeSingle();
    if (found.error) throw new Error('Read failed');
    if (!found.data?.hyp_subscription_id) return jsonResponse({ ok: false, error: 'לא נמצאה הוראת חיוב מחוברת. יש לפנות לשירות לביטול המנוי.' }, { status: 409 });
    const requested = await db.rpc('ocd_request_cancel', { p_user: user.id });
    if (requested.error) throw new Error('Cancel request failed');
    const subscriptionId = String(found.data.id);
    await syncMembership(db, subscriptionId);
    const result = await db.from('ocd_plus_subscriptions')
      .select('status,current_period_end,hyp_subscription_id,provider_cancelled_at,cancel_at_period_end').eq('id', subscriptionId).single();
    if (result.error) throw new Error('Read failed');
    if (!result.data.provider_cancelled_at) return jsonResponse({ ok: false, code: 'CANCEL_PENDING',
      error: 'בקשת הביטול נשמרה, אך חברת הסליקה עדיין לא אישרה אותה. ננסה שוב אוטומטית; החיוב טרם אושר כמבוטל.' }, { status: 409 });
    return jsonResponse({ ok: true, status: membershipIsActive(result.data as MembershipRow) ? 'active' : 'cancelled',
      cancel_at_period_end: true, current_period_end: result.data.current_period_end });
  } catch {
    return jsonResponse({ ok: false, error: 'לא ניתן לאשר את הביטול כרגע. נסו שוב או פנו לשירות.' }, { status: 502 });
  }
});
