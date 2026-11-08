import { jsonResponse } from '../_shared/cors.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { expireMemberships, syncMembership } from '../_shared/ocdPlusLifecycle.ts';
import { adminRequest } from '../_shared/shopifyAdmin.ts';
import { isHypConfigured, checkHypSigning, isHypCheckoutEnabledForUser } from '../_shared/hyp.ts';

async function authorized(req: Request) {
  const secret = Deno.env.get('OCD_MAINTENANCE_SECRET');
  if (!secret || secret.length < 32) return false;
  const header = req.headers.get('x-ocd-maintenance-secret') ?? '';
  if (header.length > 256) return false;
  const digest = (text: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const [a, b] = await Promise.all([digest(header), digest(secret)]);
  const aa = new Uint8Array(a), bb = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < aa.length; i++) difference |= aa[i] ^ bb[i];
  return difference === 0;
}

Deno.serve(async req => {
  if (req.method !== 'POST') return jsonResponse({ ok: false }, { status: 405 });
  if (!await authorized(req)) return jsonResponse({ ok: false }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === 'hyp_sign_check') {
      try {
        await checkHypSigning();
        return jsonResponse({ ok: true, signedPaymentPageValidated: true, charged: false });
      } catch (error) {
        return jsonResponse({ ok: false, charged: false,
          detail: error instanceof Error ? error.message : 'Signing failed' }, { status: 502 });
      }
    }
    if (body.action === 'readiness') {
      let shopify: unknown;
      try { shopify = await adminRequest<unknown>(`query OcdReadiness {
        shop { currencyCode taxesIncluded }
        currentAppInstallation { accessScopes { handle } }
        segments(first: 50) { nodes { name query } }
      }`); } catch (error) {
        // Protected diagnostics; this query contains no customer/payment data.
        return jsonResponse({ ok: false, stage: 'shopify_readiness',
          detail: error instanceof Error ? error.message.slice(0, 700) : 'Unknown error' }, { status: 503 });
      }
      return jsonResponse({ ok: true, hypCredentialsPresent: isHypConfigured(),
        checkoutEnabled: Deno.env.get('HYP_CHECKOUT_ENABLED') === 'true',
        ...(typeof body.checkoutCustomerId === 'string' ? {
          customerCheckoutEnabled: isHypCheckoutEnabledForUser(body.checkoutCustomerId),
        } : {}), shopify });
    }
    if (body.action && body.action !== 'run') return jsonResponse({ ok: false }, { status: 400 });
    const db = createSupabaseAdmin();
    await expireMemberships(db);
    const counts = { synced: 0, retry: 0 };
    // Bounded work; subsequent cron invocations continue the durable queue.
    const deadline = Date.now() + 35_000;
    for (let i = 0; i < 10 && Date.now() < deadline; i++) {
      const result = await syncMembership(db);
      if (result === 'idle') break;
      counts[result]++;
    }
    return jsonResponse({ ok: true, ...counts });
  } catch {
    return jsonResponse({ ok: false, error: 'Maintenance failed; inspect server configuration and retry.' }, { status: 503 });
  }
});
