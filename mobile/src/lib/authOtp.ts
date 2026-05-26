import { supabaseUrl, supabaseAnonKey, getSupabaseEnvDiagnostics } from './supabase';
import type { UserRow } from '../types/database';

const FUNCTION_URL = `${supabaseUrl}/functions/v1/auth-phone-otp`;

function describeEnvForUser(): string {
  const d = getSupabaseEnvDiagnostics();
  return (
    `SUPABASE_URL=${d.urlPresent ? d.urlHost : 'MISSING'} ` +
    `ANON_KEY=${
      d.anonKeyPresent ? `len=${d.anonKeyLength} tail=${d.anonKeyTail}` : 'MISSING'
    }`
  );
}

export type AuthOtpUser = Omit<UserRow, 'password'>;

type SendOtpResult = {
  ok: true;
  phone: string;
  transport?: 'rest' | 'asmx';
  /** Only present when AUTH_OTP_DEBUG_RETURN_CODE='1' is set on the function. */
  code?: string;
};

type VerifyOtpResult = {
  ok: true;
  user: AuthOtpUser;
};

type CheckPulseemResult = {
  ok: true;
  mode: 'rest' | 'asmx' | 'none';
  hasApiKey: boolean;
  hasFieldEncryptionKey: boolean;
  hasUserPass: boolean;
  hasFromNumber: boolean;
  fromNumberSample: string | null;
};

async function callOtpFunction<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      `Supabase env vars are missing in this build (${describeEnvForUser()}). ` +
        `EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY were not ` +
        `inlined into the JS bundle. Set them on EAS for the active profile ` +
        `and rebuild with --clear-cache.`
    );
  }

  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: supabaseAnonKey,
      authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify(body),
  });

  let parsed: any = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }

  if (!res.ok || !parsed || parsed.ok === false) {
    const baseMessage =
      parsed?.error ??
      parsed?.message ??
      `auth-phone-otp returned ${res.status}`;
    const message =
      res.status === 401
        ? `${typeof baseMessage === 'string' ? baseMessage : JSON.stringify(baseMessage)} ` +
          `(${describeEnvForUser()})`
        : typeof baseMessage === 'string'
        ? baseMessage
        : JSON.stringify(baseMessage);
    throw new Error(message);
  }
  return parsed as T;
}

export async function sendLoginOtp(phone: string): Promise<SendOtpResult> {
  return callOtpFunction<SendOtpResult>({ action: 'send_login_otp', phone });
}

export async function verifyLoginOtp(args: { phone: string; code: string }): Promise<VerifyOtpResult> {
  return callOtpFunction<VerifyOtpResult>({
    action: 'verify_login_otp',
    phone: args.phone,
    code: args.code,
  });
}

export async function sendRegisterOtp(phone: string): Promise<SendOtpResult> {
  return callOtpFunction<SendOtpResult>({ action: 'send_register_otp', phone });
}

export async function verifyRegisterOtp(args: {
  phone: string;
  code: string;
  name: string;
  address?: string | null;
}): Promise<VerifyOtpResult> {
  return callOtpFunction<VerifyOtpResult>({
    action: 'verify_register_otp',
    phone: args.phone,
    code: args.code,
    name: args.name,
    address: args.address ?? null,
  });
}

export async function checkPulseem(): Promise<CheckPulseemResult> {
  return callOtpFunction<CheckPulseemResult>({ action: 'check_pulseem' });
}
