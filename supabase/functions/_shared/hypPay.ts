/** Server-only Hyp Pay protocol. No requests are made during module loading.
 * Sources: developers.hyp.co.il/pay/{getting-started/creating-a-payment-page,
 * security/transaction-validation,advanced-features/recurring-payments}
 */
const ENDPOINT = 'https://pay.hyp.co.il/p/';

export type HypPayCredentials = { terminal: string; apiKey: string; passP: string };
type RequestFn = typeof fetch;

function auth(config: HypPayCredentials, action: string, what?: string) {
  if (!/^\d{10}$/.test(config.terminal) || !config.apiKey || !config.passP) {
    throw new Error('Hyp is not configured: terminal, API key and PassP are required.');
  }
  const params = new URLSearchParams({ action });
  if (what) params.append('What', what);
  params.append('Masof', config.terminal);
  params.append('KEY', config.apiKey);
  params.append('PassP', config.passP);
  return params;
}

function parseResponse(text: string) {
  if (!text || text.length > 32_768 || /[<>]/.test(text) || !text.includes('=')) {
    throw new Error('Invalid Hyp response.');
  }
  const params = new URLSearchParams(text);
  const keys = new Set<string>();
  for (const [key] of params) {
    if (keys.has(key.toLowerCase())) throw new Error('Ambiguous Hyp response.');
    keys.add(key.toLowerCase());
  }
  return params;
}

async function request(params: URLSearchParams, config: HypPayCredentials, fetcher: RequestFn) {
  let response: Response;
  try {
    response = await fetcher(`${ENDPOINT}?${params}`, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15_000),
      headers: { accept: 'text/plain' },
    });
  } catch {
    // Fetch errors can include the request URL, which contains credentials.
    throw new Error('Hyp request failed.');
  }
  if (!response.ok) throw new Error(`Hyp HTTP ${response.status}.`);
  let raw: string;
  try { raw = (await response.text()).trim(); } catch { throw new Error('Could not read Hyp response.'); }
  const values = parseResponse(raw);
  if (values.has('CCode') && values.get('CCode') !== '0') {
    const code = values.get('CCode') ?? '';
    throw new Error(`Hyp rejected the request${/^\d+$/.test(code) ? ` (code ${code})` : ''}.`);
  }
  // A signed public payment URL must never contain credentials, even if the
  // provider changes its response format or accidentally echoes a secret.
  for (const [key, value] of values) {
    if (['key', 'passp'].includes(key.toLowerCase()) || [config.apiKey, config.passP].some(secret => value.includes(secret))) {
      throw new Error('Hyp response included credentials.');
    }
  }
  return { raw, values };
}

export async function createHypPayAgreement(config: HypPayCredentials, args: {
  amount: number; currency: string; reference: string; name?: string | null; phone?: string | null;
}, fetcher: RequestFn = fetch): Promise<string> {
  if (!Number.isFinite(args.amount) || args.amount <= 0 || Math.round(args.amount * 100) !== args.amount * 100 || args.currency !== 'ILS') {
    throw new Error('Invalid membership amount or currency.');
  }
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(args.reference)) throw new Error('Invalid payment reference.');
  const params = auth(config, 'APISign', 'SIGN');
  const fields = {
    Sign: 'True', Amount: args.amount.toFixed(2), Coin: '1', Order: args.reference,
    HK: 'True', freq: '1', Tash: '999', OnlyOnApprove: 'True', PageLang: 'HEB',
    Info: 'OCD+ monthly membership',
  };
  for (const [key, value] of Object.entries(fields)) params.append(key, value);
  const [firstName, ...lastName] = (args.name ?? '').trim().split(/\s+/);
  if (firstName) params.append('ClientName', firstName);
  if (lastName.length) params.append('ClientLName', lastName.join(' '));
  if (args.phone) params.append('cell', args.phone);
  const { raw, values } = await request(params, config, fetcher);
  if (values.get('action') !== 'pay' || !values.get('signature')) throw new Error('Hyp did not return a signed payment page.');
  // These fields must survive signing unchanged; never silently downgrade to a
  // one-off charge or enable an agreement before the first payment succeeds.
  for (const key of ['Masof', 'Amount', 'Coin', 'Order', 'HK', 'freq', 'Tash', 'OnlyOnApprove', 'Sign']) {
    if (values.get(key) !== params.get(key)) throw new Error('Hyp signed payment details do not match the request.');
  }
  return `${ENDPOINT}?${raw}`;
}

export async function verifyHypPayCompletion(config: HypPayCredentials, raw: string, fetcher: RequestFn = fetch) {
  const fields = parseResponse(raw);
  for (const [key] of fields) {
    if (['action', 'what', 'masof', 'key', 'passp'].includes(key.toLowerCase())) throw new Error('Reserved Hyp completion parameter.');
  }
  const id = fields.get('Id');
  const sign = fields.get('Sign');
  const status = fields.get('CCode');
  const amountText = fields.get('Amount') ?? '';
  if (!id || !/^\d+$/.test(id) || !sign || !/^[a-fA-F0-9]{64}$/.test(sign) || !status || !/^\d+$/.test(status) || !/^\d+(?:\.\d{1,2})?$/.test(amountText)) {
    throw new Error('Incomplete Hyp completion.');
  }
  const params = auth(config, 'APISign', 'VERIFY');
  // Preserve original key order. Never let browser parameters override auth.
  for (const [key, value] of fields) params.append(key, value);
  const verified = await request(params, config, fetcher);
  if (verified.values.get('CCode') !== '0') throw new Error('Hyp did not verify the transaction.');
  const agreementId = fields.get('HKId') || undefined;
  if (agreementId && !/^\d+$/.test(agreementId)) throw new Error('Invalid Hyp agreement id.');
  const reference = fields.get('Order') || undefined;
  if (reference && !/^[a-zA-Z0-9-]{1,64}$/.test(reference)) throw new Error('Invalid Hyp order reference.');
  const coin = fields.get('Coin') ?? '1'; // This terminal creates ILS-only pages.
  return {
    success: status === '0', transactionId: id, subscriptionId: reference,
    hypSubscriptionId: agreementId, amount: Number(amountText), currency: coin === '1' ? 'ILS' : `HYP:${coin}`,
    // Do not persist signatures, identity numbers, card details or full callbacks.
    raw: { Id: id, CCode: status, Amount: amountText, Coin: coin, Order: reference, HKId: agreementId },
  };
}

export async function stopHypPayAgreement(config: HypPayCredentials, agreementId: string, fetcher: RequestFn = fetch) {
  if (!/^\d+$/.test(agreementId)) throw new Error('Invalid Hyp agreement id.');
  const params = auth(config, 'HKStatus');
  params.append('HKId', agreementId);
  params.append('NewStat', '1');
  const { values } = await request(params, config, fetcher);
  if (values.get('CCode') !== '0' || values.get('HKId') !== agreementId) throw new Error('Hyp did not confirm cancellation.');
  return { ok: true };
}
