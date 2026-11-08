/** Server-only OCD+ adapter for Hyp Pay. See hypPay.ts for protocol sources.
 * Checkout stays disabled until the terminal and renewal delivery are verified.
 */
import { createHypPayAgreement, verifyHypPayCompletion, stopHypPayAgreement } from './hypPay.ts';

export const OCD_PLUS_PRICE_ILS = 49;
export const OCD_PLUS_CURRENCY = 'ILS';

export type HypCreatePaymentArgs = {
  amount: number;
  currency: string;
  /** Unique checkout-attempt id — echoed back in Order, not the customer id. */
  subscriptionId: string;
  userId: string;
  /** Where Hyp should send the browser after payment (app deep link / web). */
  returnUrl?: string;
  /** Success URL configured in the Hyp terminal settings (not an API parameter). */
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
  /** Checkout-attempt reference echoed back by Hyp in Order. */
  subscriptionId?: string;
  /** Recurring/subscription token id from Hyp, if this created a standing order. */
  hypSubscriptionId?: string;
  amount?: number;
  currency?: string;
  /** Allowlisted transaction metadata only, without payment instruments. */
  raw?: unknown;
};


function getConfig() {
  return {
    terminal: (Deno.env.get('HYP_MASOF') ?? Deno.env.get('HYP_TERMINAL') ?? '').trim(),
    apiKey: (Deno.env.get('HYP_API_KEY') ?? '').trim(),
    passP: (Deno.env.get('HYP_PASS_P') ?? '').trim(),
  };
}

export function isHypConfigured(): boolean {
  const c = getConfig();
  return /^\d{10}$/.test(c.terminal) && !!c.apiKey && !!c.passP;
}

export function isHypCheckoutEnabledForUser(userId?: string): boolean {
  if (Deno.env.get('HYP_CHECKOUT_ENABLED') === 'true') return true;
  // Only a verified server session may supply this id. Local demo identities
  // cannot be allowlisted, and the list is never sent to the client.
  if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) return false;
  const customerIds = (Deno.env.get('HYP_CHECKOUT_CUSTOMER_IDS') ?? '').split(',').map(id => id.trim());
  return customerIds.includes(userId);
}

export function assertHypCheckoutReady(userId?: string): void {
  if (!isHypConfigured() || !isHypCheckoutEnabledForUser(userId)) {
    throw new Error('Hyp is not configured for checkout.');
  }
}

export async function createHypPayment(args: HypCreatePaymentArgs): Promise<HypCreatePaymentResult> {
  assertHypCheckoutReady(args.userId);
  return { paymentUrl: await createHypPayAgreement(getConfig(), {
    amount: args.amount, currency: args.currency, reference: args.subscriptionId,
    name: args.customer?.name, phone: args.customer?.phone,
  }) };
}

export async function verifyHypTransaction(payload: string): Promise<HypVerifiedTransaction> {
  return verifyHypPayCompletion(getConfig(), payload);
}

export async function cancelHypSubscription(id: string): Promise<{ ok: boolean }> {
  return stopHypPayAgreement(getConfig(), id);
}

/** Non-charging server diagnostic. APISign generates a URL only. The URL is
 * neither opened nor returned, and no customer or agreement is created.
 */
export async function checkHypSigning(): Promise<void> {
  await createHypPayAgreement(getConfig(), {
    amount: OCD_PLUS_PRICE_ILS, currency: OCD_PLUS_CURRENCY,
    reference: crypto.randomUUID(),
  });
}
