import { useCallback, useEffect, useState } from 'react';
import { fetchCollectionProducts, type ShopifyProduct } from '../lib/shopify';

const CACHE_MS = 5 * 60 * 1000;
const productCache = new Map<string, { expires: number; products: ShopifyProduct[] }>();

function cacheKey(handle: string, first: number) {
  return `${handle}\0${first}`;
}

export function useCollectionProducts(handle: string | null | undefined, first = 50) {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const reload = useCallback(() => {
    if (handle) {
      productCache.delete(cacheKey(handle, first));
    }
    setRefreshToken((value) => value + 1);
  }, [first, handle]);

  useEffect(() => {
    const normalized = handle?.trim();
    if (!normalized) {
      setProducts([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const key = cacheKey(normalized, first);
    const cached = productCache.get(key);
    if (cached && cached.expires > Date.now()) {
      setProducts(cached.products);
      setLoading(false);
      setError(null);
      return;
    }

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const next = await fetchCollectionProducts(normalized, first);
        if (cancelled) return;
        productCache.set(key, { products: next, expires: Date.now() + CACHE_MS });
        setProducts(next);
      } catch (err) {
        if (cancelled) return;
        setProducts([]);
        setError(err instanceof Error ? err.message : 'שגיאה בטעינת מוצרים');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [first, handle, refreshToken]);

  return { products, loading, error, reload };
}
