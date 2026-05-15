// auth-phone-otp Edge Function
//
// SMS OTP authentication via Pulseem.
//
// POST JSON:
//   { action: 'check_pulseem' }
//   { action: 'send_login_otp',     phone }
//   { action: 'verify_login_otp',   phone, code }
//   { action: 'send_register_otp',  phone }
//   { action: 'verify_register_otp', phone, code, name, address? }
//
// Required Edge Function secrets:
//   SUPABASE_URL                 (auto)
//   SUPABASE_SERVICE_ROLE_KEY    (auto)
//   PULSEEM_FROM_NUMBER          ('EliyaMoshe' / sender id or virtual number registered with Pulseem)
//
// One of (REST preferred, ASMX fallback):
//   PULSEEM_MAIN_API_KEY_B64     base64-encoded Pulseem REST API key  ← preferred
//   PULSEEM_API_KEY              raw Pulseem REST API key             ← alternative
//   PULSEEM_USER_ID + PULSEEM_PASSWORD  legacy ASMX SOAP credentials  ← fallback
//
// Optional:
//   PULSEEM_OTP_FROM_NUMBER      overrides PULSEEM_FROM_NUMBER for OTP only
//   PULSEEM_REST_FROM_NUMBER     overrides PULSEEM_FROM_NUMBER when REST is used
//   AUTH_OTP_DEBUG_RETURN_CODE='1'  return the OTP in the response (DEV ONLY!)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const PULSEEM_REST_URL = 'https://api.pulseem.com/api/v1/SmsApi/SendSms';
const PULSEEM_ASMX_URL = 'https://www.pulseem.com/PublicService/PublicService.asmx';

type Action =
  | 'check_pulseem'
  | 'send_login_otp'
  | 'verify_login_otp'
  | 'send_register_otp'
  | 'verify_register_otp';

type Payload = {
  action?: Action;
  phone?: string;
  code?: string;
  name?: string;
  address?: string | null;
};

type PulseemCreds = {
  apiKey: string;
  userId: string;
  password: string;
  fromNumber: string;
  fromNumberRest: string;
};

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
      ...(init?.headers ?? {}),
    },
  });
}

function decodeBase64ToString(b64: string): string {
  try {
    const bin = atob(b64);
    // Decode UTF-8 bytes (Pulseem keys are ASCII; this also works for that case).
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

function loadPulseemCredentials(): PulseemCreds {
  const apiKeyRaw = (Deno.env.get('PULSEEM_API_KEY') ?? '').trim();
  const apiKeyB64 = (Deno.env.get('PULSEEM_MAIN_API_KEY_B64') ?? '').trim();
  const apiKey = apiKeyRaw || (apiKeyB64 ? decodeBase64ToString(apiKeyB64).trim() : '');

  const userId = (Deno.env.get('PULSEEM_USER_ID') ?? '').trim();
  const password = (Deno.env.get('PULSEEM_PASSWORD') ?? '').trim();

  const fromGeneric = (Deno.env.get('PULSEEM_FROM_NUMBER') ?? '').trim();
  const fromOtp = (Deno.env.get('PULSEEM_OTP_FROM_NUMBER') ?? '').trim();
  const fromRest = (Deno.env.get('PULSEEM_REST_FROM_NUMBER') ?? '').trim();

  const fromNumber = fromOtp || fromGeneric || fromRest;
  const fromNumberRest = fromRest || fromOtp || fromGeneric;

  return { apiKey, userId, password, fromNumber, fromNumberRest };
}

/**
 * Normalize an Israeli phone number to international (no '+') for Pulseem,
 * and to a canonical local form for DB lookups (we keep the same normalized
 * value everywhere for consistency).
 */
function normalizePhone(input: string): string {
  const digits = (input ?? '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return `972${digits.slice(1)}`;
  return digits;
}

function generateOtp(): string {
  // Cryptographically random 6-digit numeric code.
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const n = buf[0] % 1_000_000;
  return n.toString().padStart(6, '0');
}

async function sha256Hex(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function sendSmsViaRest(opts: {
  apiKey: string;
  fromNumber: string;
  toPhone: string;
  text: string;
}) {
  const body = {
    sendId: crypto.randomUUID(),
    isAsync: false,
    smsSendData: {
      fromNumber: opts.fromNumber,
      toNumberList: [opts.toPhone],
      referenceList: ['otp'],
      textList: [opts.text],
      isAutomaticUnsubscribeLink: false,
    },
  };
  const res = await fetch(PULSEEM_REST_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Pulseem swagger declares the header name as `APIKey`. Some accounts
      // also accept `X-Api-Key`; sending both is harmless.
      APIKey: opts.apiKey,
      'X-Api-Key': opts.apiKey,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Pulseem REST ${res.status}: ${text.slice(0, 300)}`);
  }
  return { transport: 'rest' as const, status: res.status, response: tryParseJson(text) };
}

async function sendSmsViaAsmx(opts: {
  userId: string;
  password: string;
  fromNumber: string;
  toPhone: string;
  text: string;
}) {
  const innerXml =
    `<SendSMS>` +
    `<dest_phones>${escapeXml(opts.toPhone)}</dest_phones>` +
    `<msg_text>${escapeXml(opts.text)}</msg_text>` +
    `<from>${escapeXml(opts.fromNumber)}</from>` +
    `</SendSMS>`;

  const soap =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<soap:Body>` +
    `<Send_SMSXML xmlns="http://www.pulseem.com/">` +
    `<user_id>${escapeXml(opts.userId)}</user_id>` +
    `<password>${escapeXml(opts.password)}</password>` +
    `<xml_request><![CDATA[${innerXml}]]></xml_request>` +
    `</Send_SMSXML>` +
    `</soap:Body>` +
    `</soap:Envelope>`;

  const res = await fetch(PULSEEM_ASMX_URL, {
    method: 'POST',
    headers: {
      'content-type': 'text/xml; charset=utf-8',
      SOAPAction: '"http://www.pulseem.com/Send_SMSXML"',
    },
    body: soap,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Pulseem ASMX ${res.status}: ${text.slice(0, 300)}`);
  }
  return { transport: 'asmx' as const, status: res.status, response: text.slice(0, 1000) };
}

async function sendOtpSms(opts: { phone: string; code: string }) {
  const creds = loadPulseemCredentials();

  const text = `OCD: קוד האימות שלך הוא ${opts.code}. הקוד תקף ל-5 דקות. אין למסור אותו לאף גורם.`;

  if (creds.apiKey) {
    const from = creds.fromNumberRest || creds.fromNumber;
    if (!from) throw new Error('Missing PULSEEM_FROM_NUMBER (sender)');
    return sendSmsViaRest({ apiKey: creds.apiKey, fromNumber: from, toPhone: opts.phone, text });
  }

  if (creds.userId && creds.password) {
    if (!creds.fromNumber) throw new Error('Missing PULSEEM_FROM_NUMBER (sender)');
    return sendSmsViaAsmx({
      userId: creds.userId,
      password: creds.password,
      fromNumber: creds.fromNumber,
      toPhone: opts.phone,
      text,
    });
  }

  throw new Error(
    'Pulseem credentials missing. Set PULSEEM_MAIN_API_KEY_B64 (preferred) or PULSEEM_USER_ID + PULSEEM_PASSWORD.',
  );
}

type SupabaseAdmin = ReturnType<typeof createClient>;

async function throttleSends(
  supabase: SupabaseAdmin,
  phone: string,
  purpose: 'login' | 'register',
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('phone_otp_codes')
    .select('id', { count: 'exact', head: true })
    .eq('phone', phone)
    .eq('purpose', purpose)
    .gte('created_at', since);

  if (error) {
    return { ok: false, status: 500, error: error.message };
  }
  if ((count ?? 0) >= 3) {
    return { ok: false, status: 429, error: 'יותר מדי בקשות. נא להמתין כמה דקות לפני בקשת קוד נוסף.' };
  }
  return { ok: true };
}

async function persistOtp(
  supabase: SupabaseAdmin,
  phone: string,
  purpose: 'login' | 'register',
  code: string,
) {
  const code_hash = await sha256Hex(code);
  const expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from('phone_otp_codes')
    .insert({ phone, purpose, code_hash, expires_at });
  if (error) throw new Error(error.message);
}

async function verifyOtp(
  supabase: SupabaseAdmin,
  phone: string,
  purpose: 'login' | 'register',
  code: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!code || code.length < 4) {
    return { ok: false, status: 400, error: 'קוד אימות לא תקין' };
  }

  const { data, error } = await supabase
    .from('phone_otp_codes')
    .select('id, code_hash, expires_at, consumed_at, attempts')
    .eq('phone', phone)
    .eq('purpose', purpose)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) return { ok: false, status: 500, error: error.message };
  const row = (data ?? [])[0] as
    | {
        id: string;
        code_hash: string;
        expires_at: string;
        consumed_at: string | null;
        attempts: number | null;
      }
    | undefined;

  if (!row) return { ok: false, status: 400, error: 'לא נמצא קוד פעיל. נא לבקש קוד חדש.' };
  if (row.consumed_at) return { ok: false, status: 400, error: 'הקוד כבר מומש. נא לבקש קוד חדש.' };
  if (new Date(row.expires_at).getTime() < Date.now())
    return { ok: false, status: 400, error: 'תוקף הקוד פג. נא לבקש קוד חדש.' };
  if ((row.attempts ?? 0) >= 5)
    return { ok: false, status: 400, error: 'מספר נסיונות חורג. נא לבקש קוד חדש.' };

  const expectedHash = await sha256Hex(code.trim());
  if (row.code_hash !== expectedHash) {
    await supabase
      .from('phone_otp_codes')
      .update({ attempts: (row.attempts ?? 0) + 1 })
      .eq('id', row.id);
    return { ok: false, status: 400, error: 'קוד אימות שגוי' };
  }

  const { error: consumeErr } = await supabase
    .from('phone_otp_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', row.id);
  if (consumeErr) return { ok: false, status: 500, error: consumeErr.message };

  return { ok: true };
}

const USER_COLUMNS =
  'id, phone, role, name, address, price, ocd_plus_subscriber, avatar_url, created_at';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ ok: false, error: 'Missing Supabase env' }, { status: 500 });
  }

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const debugReturnCode = (Deno.env.get('AUTH_OTP_DEBUG_RETURN_CODE') ?? '').trim() === '1';

  try {
    switch (payload.action) {
      case 'check_pulseem': {
        const c = loadPulseemCredentials();
        return jsonResponse({
          ok: true,
          mode: c.apiKey ? 'rest' : c.userId && c.password ? 'asmx' : 'none',
          hasApiKey: !!c.apiKey,
          hasUserPass: !!(c.userId && c.password),
          hasFromNumber: !!c.fromNumber,
          fromNumberSample: c.fromNumber ? `${c.fromNumber.slice(0, 3)}…` : null,
        });
      }

      case 'send_login_otp': {
        const phone = normalizePhone(payload.phone ?? '');
        if (!phone) return jsonResponse({ ok: false, error: 'מספר טלפון חסר או לא תקין' }, { status: 400 });

        const { data: user, error: userErr } = await supabase
          .from('users')
          .select('id')
          .eq('phone', phone)
          .maybeSingle();
        if (userErr) return jsonResponse({ ok: false, error: userErr.message }, { status: 500 });
        if (!user) return jsonResponse({ ok: false, error: 'המשתמש לא נמצא' }, { status: 404 });

        const throttle = await throttleSends(supabase, phone, 'login');
        if (!throttle.ok) return jsonResponse({ ok: false, error: throttle.error }, { status: throttle.status });

        const code = generateOtp();
        await persistOtp(supabase, phone, 'login', code);
        const sendResult = await sendOtpSms({ phone, code });
        await supabase.rpc('cleanup_expired_phone_otp_codes').catch(() => null);

        return jsonResponse({
          ok: true,
          phone,
          transport: sendResult.transport,
          ...(debugReturnCode ? { code } : {}),
        });
      }

      case 'verify_login_otp': {
        const phone = normalizePhone(payload.phone ?? '');
        if (!phone) return jsonResponse({ ok: false, error: 'מספר טלפון חסר או לא תקין' }, { status: 400 });

        const result = await verifyOtp(supabase, phone, 'login', String(payload.code ?? ''));
        if (!result.ok) return jsonResponse({ ok: false, error: result.error }, { status: result.status });

        const { data: user, error: userErr } = await supabase
          .from('users')
          .select(USER_COLUMNS)
          .eq('phone', phone)
          .maybeSingle();
        if (userErr) return jsonResponse({ ok: false, error: userErr.message }, { status: 500 });
        if (!user) return jsonResponse({ ok: false, error: 'המשתמש לא נמצא' }, { status: 404 });

        return jsonResponse({ ok: true, user });
      }

      case 'send_register_otp': {
        const phone = normalizePhone(payload.phone ?? '');
        if (!phone) return jsonResponse({ ok: false, error: 'מספר טלפון חסר או לא תקין' }, { status: 400 });

        const { data: existing, error: existingErr } = await supabase
          .from('users')
          .select('id')
          .eq('phone', phone)
          .maybeSingle();
        if (existingErr) return jsonResponse({ ok: false, error: existingErr.message }, { status: 500 });
        if (existing) return jsonResponse({ ok: false, error: 'כבר קיים חשבון עם הטלפון הזה' }, { status: 409 });

        const throttle = await throttleSends(supabase, phone, 'register');
        if (!throttle.ok) return jsonResponse({ ok: false, error: throttle.error }, { status: throttle.status });

        const code = generateOtp();
        await persistOtp(supabase, phone, 'register', code);
        const sendResult = await sendOtpSms({ phone, code });
        await supabase.rpc('cleanup_expired_phone_otp_codes').catch(() => null);

        return jsonResponse({
          ok: true,
          phone,
          transport: sendResult.transport,
          ...(debugReturnCode ? { code } : {}),
        });
      }

      case 'verify_register_otp': {
        const phone = normalizePhone(payload.phone ?? '');
        const name = (payload.name ?? '').trim();
        const address = (payload.address ?? null)?.toString().trim() || null;

        if (!phone) return jsonResponse({ ok: false, error: 'מספר טלפון חסר או לא תקין' }, { status: 400 });
        if (!name) return jsonResponse({ ok: false, error: 'שם מלא חסר' }, { status: 400 });

        const result = await verifyOtp(supabase, phone, 'register', String(payload.code ?? ''));
        if (!result.ok) return jsonResponse({ ok: false, error: result.error }, { status: result.status });

        const { data: existing, error: existingErr } = await supabase
          .from('users')
          .select('id')
          .eq('phone', phone)
          .maybeSingle();
        if (existingErr) return jsonResponse({ ok: false, error: existingErr.message }, { status: 500 });
        if (existing) return jsonResponse({ ok: false, error: 'כבר קיים חשבון עם הטלפון הזה' }, { status: 409 });

        // The legacy `password` column is NOT NULL; OTP login no longer uses
        // it, so we store an unused random secret to satisfy the constraint.
        const placeholderPassword = `otp:${crypto.randomUUID()}${crypto.randomUUID()}`;

        const { data: created, error: insertErr } = await supabase
          .from('users')
          .insert({
            phone,
            password: placeholderPassword,
            role: 'customer',
            name,
            address,
            price: null,
            avatar_url: null,
          })
          .select(USER_COLUMNS)
          .single();
        if (insertErr) return jsonResponse({ ok: false, error: insertErr.message }, { status: 500 });

        return jsonResponse({ ok: true, user: created });
      }

      default:
        return jsonResponse({ ok: false, error: `Unknown action: ${payload.action ?? '(missing)'}` }, { status: 400 });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonResponse({ ok: false, error: message }, { status: 500 });
  }
});
