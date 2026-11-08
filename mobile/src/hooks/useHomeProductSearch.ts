import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStoreCatalog } from './useStoreCatalog';
import { searchProducts, type ShopifyProduct } from '../lib/shopify';
import { indexCatalog, normalizeSearchQuery, searchCatalog } from '../lib/catalogSearch';
import type { StoreProduct } from '../screens/store/StoreHomeScreen';

/** Local matches update immediately; network requests wait for a typing pause. */
export function useHomeProductSearch(query: string, mapProduct: (product: ShopifyProduct, index: number) => StoreProduct) {
  const catalog = useStoreCatalog();
  const needle = normalizeSearchQuery(query);
  const [settledQuery, setSettledQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSettledQuery(needle), 300);
    return () => clearTimeout(timer);
  }, [needle]);
  const active = !!needle;
  const localIndex = useMemo(() => active
    ? indexCatalog(catalog.products.map((product, index) => mapProduct(product, index)), [], 'name') : [], [catalog.products, mapProduct, active]);
  const remote = useQuery({
    queryKey: ['store-search', settledQuery],
    queryFn: async () => (await searchProducts(settledQuery, 48)).map((product, index) => mapProduct(product, index)),
    enabled: active && needle === settledQuery,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
  const remoteIndex = useMemo(() => active
    ? indexCatalog(remote.data ?? [], [], 'name') : [], [remote.data, active]);
  const products = useMemo(() => active
    ? searchCatalog([...localIndex, ...(needle === settledQuery ? remoteIndex : [])], needle, 'name')
    : [], [active, localIndex, remoteIndex, needle, settledQuery]);
  return {
    needle,
    products,
    loading: active && (catalog.isPending || needle !== settledQuery || remote.isFetching),
    error: active && (catalog.isError || (needle === settledQuery && remote.isError)),
    retry: () => Promise.all([catalog.refetch(), ...(active && needle === settledQuery ? [remote.refetch()] : [])]),
  };
}
