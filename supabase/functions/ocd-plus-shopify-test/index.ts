// ocd-plus-shopify-test  (TEMPORARY diagnostic — delete after verifying)
//
// SECURITY MODEL
// --------------
// This app authenticates every Edge call with the SHARED Supabase anon key
// (there is no per-user Supabase Auth session), so the request JWT has no
// per-user `sub` to trust. To honour the intent of "don't let a caller poke an
// arbitrary Shopify customer", this temporary diagnostic:
//   - is NOT public (deployed with verify_jwt = true),
//   - IGNORES the request body entirely (no userId / no customerId accepted),
//   - is locked to a single pre-approved test user id,
//   - reads shopify_customer_id ONLY from the DB (public.users).
// It therefore can never touch any customer other than the one linked to the
// approved test user, and never changes the subscription status.

import { CORS_HEADERS, jsonResponse } from '../_shared/cors.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import {
  addOcdPlusTag,
  getCustomerById,
  getShopifyAdminAccessToken,
  getShopifyAdminTokenInfo,
  OCD_PLUS_TAG,
  removeOcdPlusTag,
} from '../_shared/shopifyAdmin.ts';

// Single approved test user. This diagnostic operates on no one else.
const ALLOWED_TEST_USER_ID = 'af8fc33a-9b9e-4f94-a980-9bcbca690177';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const supabase = createSupabaseAdmin();

    // Identity is fixed — the body is deliberately not read.
    const { data: rows, error } = await supabase
      .from('users')
      .select('id, shopify_customer_id')
      .eq('id', ALLOWED_TEST_USER_ID)
      .limit(1);
    if (error) throw new Error(error.message);

    const userRow = (rows ?? [])[0] as { id: string; shopify_customer_id: string | null } | undefined;
    if (!userRow) {
      return jsonResponse({ ok: false, error: 'Test user not found' }, { status: 404 });
    }

    // Prove the Client Credentials Grant works (token never returned/logged).
    await getShopifyAdminAccessToken();
    const tokenInfo = getShopifyAdminTokenInfo();

    const shopifyCustomerId = (userRow.shopify_customer_id ?? '').trim() || null;
    if (!shopifyCustomerId) {
      return jsonResponse({
        ok: false,
        missingShopifyCustomerId: true,
        tokenInfo,
        message: 'No shopify_customer_id stored on the test user. Not creating/guessing a customer.',
      });
    }

    // Read the customer.
    const before = await getCustomerById(shopifyCustomerId);
    if (!before) {
      return jsonResponse({
        ok: false,
        tokenInfo,
        shopifyCustomerId,
        customerRead: false,
        message: 'Shopify customer not found for the stored id. Aborting tag test.',
      });
    }

    // Add tag → verify present.
    let addError: string | null = null;
    try {
      await addOcdPlusTag(shopifyCustomerId);
    } catch (e) {
      addError = e instanceof Error ? e.message : String(e);
    }
    const afterAdd = await getCustomerById(shopifyCustomerId);
    const tagPresentAfterAdd = !!afterAdd?.tags.includes(OCD_PLUS_TAG);

    // Remove tag → verify absent.
    let removeError: string | null = null;
    try {
      await removeOcdPlusTag(shopifyCustomerId);
    } catch (e) {
      removeError = e instanceof Error ? e.message : String(e);
    }
    const afterRemove = await getCustomerById(shopifyCustomerId);
    const tagPresentAfterRemove = !!afterRemove?.tags.includes(OCD_PLUS_TAG);

    return jsonResponse({
      ok: !addError && !removeError && tagPresentAfterAdd && !tagPresentAfterRemove,
      tokenInfo,
      shopifyCustomerId,
      customerRead: true,
      customerDisplayName: before.displayName,
      addTag: { success: !addError && tagPresentAfterAdd, userError: addError },
      removeTag: { success: !removeError && !tagPresentAfterRemove, userError: removeError },
      tagPresentAfterAdd,
      tagPresentAfterRemove,
      note: 'DB subscription status was NOT modified by this test.',
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonResponse({ ok: false, error: message }, { status: 500 });
  }
});
