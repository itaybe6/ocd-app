import * as ImageManipulator from 'expo-image-manipulator';
import { supabase, JOB_IMAGES_BUCKET } from './supabase';

export function getPublicUrl(path: string): string {
  const { data } = supabase.storage.from(JOB_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
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

type UploadCompressedImageArgs = {
  localUri: string;
  path: string; // destination path inside bucket
};

export async function uploadCompressedImage({ localUri, path }: UploadCompressedImageArgs): Promise<string> {
  const manipulated = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1280 } }],
    { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG }
  );

  const res = await fetch(manipulated.uri);
  if (!res.ok) {
    throw new Error(`Failed to read image: ${res.status}`);
  }
  const blob = await res.blob();

  const { error } = await supabase.storage.from(JOB_IMAGES_BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  });

  if (error) throw error;
  return path;
}

