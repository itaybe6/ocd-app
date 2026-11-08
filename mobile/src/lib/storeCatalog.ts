import { type QueryClient } from '@tanstack/react-query';
import { fetchProducts, type ShopifyProduct } from './shopify';

export const STORE_CATALOG_KEY = ['store-catalog', 'v1'] as const;
export const STORE_CATALOG_PREVIEW_KEY = ['store-catalog-preview', 'v1'] as const;
export const CATALOG_GC_TIME = 30 * 60 * 1000;

/** Home, startup and search share one request; partial pages never mark the full catalog fresh. */
export function storeCatalogOptions(client: QueryClient) {
  return {
    queryKey: STORE_CATALOG_KEY,
    staleTime: 5 * 60 * 1000,
    gcTime: CATALOG_GC_TIME,
    retry: 1,
    queryFn: async () => {
      const products = await fetchProducts(undefined, {
        firstPageSize: 40,
        onPage: products => {
          client.setQueryData<ShopifyProduct[]>(STORE_CATALOG_PREVIEW_KEY, previous =>
            previous && previous.length > products.length ? previous : products);
        },
      });
      client.setQueryData(STORE_CATALOG_PREVIEW_KEY, products);
      return products;
    },
  };
}
