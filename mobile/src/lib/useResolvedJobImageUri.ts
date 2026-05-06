import { useEffect, useState } from 'react';
import { jobImageDisplayUri, resolveJobImageUriForDisplay } from './storage';

/**
 * Local file preview wins; otherwise resolves storage path to a display URL (signed when needed).
 */
export function useResolvedJobImageUri(
  storagePath: string | null | undefined,
  localUri: string | null | undefined,
): string | null {
  const [resolved, setResolved] = useState<string | null>(() => localUri ?? jobImageDisplayUri(storagePath) ?? null);

  useEffect(() => {
    if (localUri) {
      setResolved(localUri);
      return;
    }
    const path = storagePath?.trim();
    if (!path) {
      setResolved(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const u = await resolveJobImageUriForDisplay(path);
      if (!cancelled) setResolved(u);
    })();
    return () => {
      cancelled = true;
    };
  }, [storagePath, localUri]);

  return resolved;
}
