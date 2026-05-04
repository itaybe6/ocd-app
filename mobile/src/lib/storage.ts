import * as ImageManipulator from 'expo-image-manipulator';
import { supabase, JOB_IMAGES_BUCKET } from './supabase';

export function getPublicUrl(path: string): string {
  const { data } = supabase.storage.from(JOB_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

const base64Lookup = (() => {
  const t = new Int16Array(256);
  t.fill(-1);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < alphabet.length; i++) t[alphabet.charCodeAt(i)] = i;
  t['-'.charCodeAt(0)] = 62;
  t['_'.charCodeAt(0)] = 63;
  return t;
})();

function decodeBase64ToBytes(b64: string): Uint8Array {
  const clean = (b64 || '').replace(/[\r\n\s]+/g, '');
  if (!clean) return new Uint8Array(0);
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const outLen = Math.floor((clean.length * 3) / 4) - pad;
  const out = new Uint8Array(outLen);

  let outIdx = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c1 = base64Lookup[clean.charCodeAt(i)] ?? -1;
    const c2 = base64Lookup[clean.charCodeAt(i + 1)] ?? -1;
    const c3ch = clean.charAt(i + 2);
    const c4ch = clean.charAt(i + 3);
    const c3 = c3ch === '=' ? 0 : base64Lookup[clean.charCodeAt(i + 2)] ?? -1;
    const c4 = c4ch === '=' ? 0 : base64Lookup[clean.charCodeAt(i + 3)] ?? -1;
    if (c1 < 0 || c2 < 0 || c3 < 0 || c4 < 0) continue;

    const triple = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4;
    if (outIdx < outLen) out[outIdx++] = (triple >> 16) & 0xff;
    if (outIdx < outLen && c3ch !== '=') out[outIdx++] = (triple >> 8) & 0xff;
    if (outIdx < outLen && c4ch !== '=') out[outIdx++] = triple & 0xff;
  }

  return out;
}

/**
 * DB `image_url` is normally a storage path under `job-images`.
 * If a row already stores a full http(s) URL, return it as-is — wrapping that string in
 * `getPublicUrl()` produces an invalid URL and images fail to load (common after viewing completed jobs).
 */
export function jobImageDisplayUri(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower.startsWith('http://') || lower.startsWith('https://')) return s;
  return getPublicUrl(s.replace(/^\/+/, ''));
}

/**
 * Path stored in DB → URL that actually loads in the app.
 * Prefer signed URLs so private buckets work; fall back to public URL when signing is unavailable.
 */
export async function resolveJobImageUriForDisplay(raw: string | null | undefined): Promise<string | null> {
  const sync = jobImageDisplayUri(raw);
  if (sync == null) return null;
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (s.toLowerCase().startsWith('http://') || s.toLowerCase().startsWith('https://')) return sync;

  const path = s.replace(/^\/+/, '');
  const { data, error } = await supabase.storage.from(JOB_IMAGES_BUCKET).createSignedUrl(path, 3600);
  if (!error && data?.signedUrl) return data.signedUrl;
  return sync;
}

type UploadCompressedImageArgs = {
  localUri: string;
  path: string; // destination path inside bucket
};

export async function uploadCompressedImage({ localUri, path }: UploadCompressedImageArgs): Promise<string> {
  // Read pixels as base64 from the manipulator: in React Native, `fetch(file://).blob()` then
  // `storage.upload(blob)` regularly produces a 0-byte object, so we go base64 → Uint8Array instead.
  const manipulated = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1280 } }],
    { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );

  const b64 = manipulated.base64;
  if (!b64) throw new Error('Failed to encode image (no base64)');
  const bytes = decodeBase64ToBytes(b64);
  if (!bytes.length) throw new Error('Image file is empty');

  const { error } = await supabase.storage.from(JOB_IMAGES_BUCKET).upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: true,
    cacheControl: '3600',
  });

  if (error) throw error;
  return path;
}

