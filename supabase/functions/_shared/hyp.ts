/**
 * Hyp payment adapter (server-only).
 *
 * ⚠️ IMPLEMENTATION IS INTENTIONALLY STUBBED.
 *
 * The exact Hyp (הופ / HYP) API endpoints, request shape, signing method and
 * field names are NOT hard-coded here on purpose — inventing them would produce
 * a broken integration. Fill in the TODOs once you have the Hyp merchant docs
 * and credentials. Everything below the adapter (DB state machine, idempotency,
 * Shopify tagging) already works and only depends on this adapter's return
 * shapes, so wiring the real calls in is isolated to this file.
 *
 * Required secrets (set via `supabase secrets set` — NEVER in the app bundle):
 *   HYP_API_BASE_URL       Hyp API base URL (from Hyp)
 *   HYP_MASOF / HYP_TERMINAL   terminal / masof number (from Hyp)
 *   HYP_API_KEY            API key / password (from Hyp)
 *   HYP_CALLBACK_SECRET    shared secret used to verify server-to-server callbacks
 *
 * The 49₪ monthly membership charge is created as a recurring/tokenized payment
 * (Hyp "הוראת קבע" / recurring). Use the recurring flow so renewals bill
 * automatically — do NOT store the card yourself.
 */

export const OCD_PLUS_PRICE_ILS = 49;
export const OCD_PLUS_CURRENCY = 'ILS';

export type HypCreatePaymentArgs = {
  amount: number;
  currency: string;
  /** Our internal subscription row id — echoed back on the callback. */
  subscriptionId: string;
  userId: string;
  /** Where Hyp should send the browser after payment (app deep link / web). */
  returnUrl?: string;
  /** Server-to-server callback URL Hyp should POST the result to. */
  callbackUrl: string;
  customer?: { name?: string | null; phone?: string | null };
};

export type HypCreatePaymentResult = {
  /** URL to open in a secure browser / WebView for the user to pay. */
  paymentUrl: string;
  /** Hyp's own reference for this payment attempt, if returned up-front. */
  hypReference?: string;
};

export type HypVerifiedTransaction = {
  success: boolean;
  /** Unique transaction id from Hyp — used as the idempotency key. */
  transactionId: string;
  /** Our subscription id, echoed back by Hyp (from `subscriptionId` above). */
  subscriptionId?: string;
  /** Recurring/subscription token id from Hyp, if this created a standing order. */
  hypSubscriptionId?: string;
  amount?: number;
  currency?: string;
  /** Raw provider payload, stored for auditing. */
  raw?: unknown;
};

function getConfig() {
  return {
    baseUrl: (Deno.env.get('HYP_API_BASE_URL') ?? '').trim(),
    terminal: (Deno.env.get('HYP_MASOF') ?? Deno.env.get('HYP_TERMINAL') ?? '').trim(),
    apiKey: (Deno.env.get('HYP_API_KEY') ?? '').trim(),
    callbackSecret: (Deno.env.get('HYP_CALLBACK_SECRET') ?? '').trim(),
  };
}

export function isHypConfigured(): boolean {
  const c = getConfig();
  return !!(c.baseUrl && c.terminal && c.apiKey);
}

/**
 * Create a Hyp payment session for the 49₪ monthly membership and return a
 * paymentUrl to open in the app.
 */
export async function createHypPayment(
  _args: HypCreatePaymentArgs,
): Promise<HypCreatePaymentResult> {
  const c = getConfig();
  if (!isHypConfigured()) {
    throw new Error(
      'Hyp is not configured. Set HYP_API_BASE_URL, HYP_MASOF/HYP_TERMINAL and HYP_API_KEY as Edge Function secrets.',
    );
  }

  // TODO(Hyp): Build and POST the real "create payment / recurring order"
  // request to `${c.baseUrl}` using the terminal + apiKey. Map _args.amount,
  // currency, callbackUrl and subscriptionId (as a passthrough param that Hyp
  // echoes back on the callback) into Hyp's expected fields. Parse Hyp's
  // response into { paymentUrl, hypReference }.
  //
  // Reference the Hyp merchant integration docs for the exact endpoint,
  // parameter names and signature. Do NOT guess.
  void c;
  throw new Error('createHypPayment not implemented — fill in the Hyp adapter (see _shared/hyp.ts).');
}

/**
 * Verify a payment server-to-server. Never trust the browser redirect — this
 * must independently confirm the transaction against Hyp (or verify a signed
 * callback with HYP_CALLBACK_SECRET).
 */
export async function verifyHypTransaction(
  _callbackPayload: Record<string, unknown>,
): Promise<HypVerifiedTransaction> {
  const c = getConfig();
  if (!isHypConfigured()) {
    throw new Error('Hyp is not configured. Cannot verify transaction.');
  }

  // TODO(Hyp): Verify the callback authenticity (validate the signature/HMAC
  // using HYP_CALLBACK_SECRET, or call Hyp's "get transaction status" endpoint
  // with the transaction id from the payload). Return a normalised
  // HypVerifiedTransaction. Extract: transactionId, subscriptionId (our
  // passthrough), hypSubscriptionId (recurring token), amount, currency, and
  // whether the payment truly succeeded.
  void c;
  throw new Error('verifyHypTransaction not implemented — fill in the Hyp adapter (see _shared/hyp.ts).');
}

/**
 * Cancel a recurring Hyp subscription (standing order). Returns true if Hyp
 * confirmed cancellation. If Hyp has no cancel API for your plan type, keep the
 * cancel_at_period_end flow in the DB and stop renewals on your side.
 */
export async function cancelHypSubscription(_hypSubscriptionId: string): Promise<{ ok: boolean }> {
  if (!isHypConfigured()) {
    // Allow local cancellation to proceed even when Hyp isn't wired yet.
    return { ok: false };
  }

  // TODO(Hyp): Call Hyp's cancel-recurring endpoint with _hypSubscriptionId.
  throw new Error('cancelHypSubscription not implemented — fill in the Hyp adapter (see _shared/hyp.ts).');
}
