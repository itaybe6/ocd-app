import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ShopifyProduct } from '../lib/shopify';
import { CATALOG_GC_TIME, STORE_CATALOG_PREVIEW_KEY, storeCatalogOptions } from '../lib/storeCatalog';

const EMPTY_PRODUCTS: ShopifyProduct[] = [];

export function useStoreCatalog() {
  const client = useQueryClient();
  const catalog = useQuery(storeCatalogOptions(client));
  const preview = useQuery<ShopifyProduct[]>({
    queryKey: STORE_CATALOG_PREVIEW_KEY,
    // Cache-only observer: explicitly skip fetching, including on invalidation.
    queryFn: skipToken,
    gcTime: CATALOG_GC_TIME,
  });
  return { ...catalog, products: catalog.data ?? preview.data ?? EMPTY_PRODUCTS };
}
