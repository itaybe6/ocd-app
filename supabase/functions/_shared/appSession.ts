// App session tokens for the custom phone-OTP identity (no Supabase Auth).
//
// Access token: short-lived HS256 JWT with `sub = public.users.id`, signed with
// the server-only secret APP_JWT_SECRET. Stateless (never stored).
// Refresh token: opaque 256-bit random string; only its SHA-256 hash is stored
// in public.app_auth_sessions, so it can be revoked/rotated.
//
// APP_JWT_SECRET is a Supabase Edge secret and must NEVER reach the app bundle.

export const ACCESS_TTL_SECONDS = 60 * 60; // 60 minutes
export const REFRESH_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

function getSecret(): string {
  const s = (Deno.env.get('APP_JWT_SECRET') ?? '').trim();
  if (!s) throw new Error('APP_JWT_SECRET is not set');
  return s;
}

function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlFromString(s: string): string {
  return b64urlFromBytes(new TextEncoder().encode(s));
}

function bytesFromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function stringFromB64url(s: string): string {
  return new TextDecoder().decode(bytesFromB64url(s));
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export type AppSessionClaims = { sub: string; iat: number; exp: number };

export async function signAppSession(
  userId: string,
  ttlSeconds = ACCESS_TTL_SECONDS,
): Promise<{ token: string; expiresAt: string }> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttlSeconds;
  const header = b64urlFromString(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64urlFromString(JSON.stringify({ sub: userId, iat, exp } satisfies AppSessionClaims));
  const signingInput = `${header}.${payload}`;
  const key = await hmacKey();
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput)));
  return { token: `${signingInput}.${b64urlFromBytes(sig)}`, expiresAt: new Date(exp * 1000).toISOString() };
}

/** Returns the claims when the signature is valid and not expired, else null. */
export async function verifyAppSession(token: string): Promise<AppSessionClaims | null> {
  const parts = (token ?? '').split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const signingInput = `${header}.${payload}`;
  const key = await hmacKey();
  let valid = false;
  try {
    valid = await crypto.subtle.verify('HMAC', key, bytesFromB64url(signature), new TextEncoder().encode(signingInput));
  } catch {
    return null;
  }
  if (!valid) return null;

  let claims: AppSessionClaims;
  try {
    claims = JSON.parse(stringFromB64url(payload));
  } catch {
    return null;
  }
  if (!claims?.sub || typeof claims.exp !== 'number') return null;
  if (Math.floor(Date.now() / 1000) >= claims.exp) return null;
  return claims;
}

export function generateRefreshToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return b64urlFromBytes(bytes);
}

export async function hashRefreshToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const bytes = new Uint8Array(digest);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}
