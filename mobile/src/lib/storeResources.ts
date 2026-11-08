import type { QueryClient } from '@tanstack/react-query';
import * as shopify from './shopify';
import { storeCatalogOptions } from './storeCatalog';

export const STORE_RESOURCES_KEY = ['store-resources', 'v1'] as const;
const FRESH_TIME = 60_000;
const RETAIN_TIME = 5 * 60_000;

/** Public storefront reads only. Cart, checkout, orders and account mutations
 * deliberately stay outside this cache. QueryClient coalesces concurrent reads. */
export function createStoreResourceReader(client: QueryClient) {
  function cached<Args extends unknown[], Result>(name: string, fetcher: (...args: Args) => Promise<Result>) {
    return (...args: Args): Promise<Result> => client.fetchQuery({
      queryKey: [...STORE_RESOURCES_KEY, name, ...args],
      queryFn: () => fetcher(...args),
      staleTime: FRESH_TIME,
      gcTime: RETAIN_TIME,
      retry: false,
    });
  }
  const limitedProducts = cached('products', shopify.fetchProducts);
  return {
    fetchProducts: (limit?: number) => limit === undefined
      ? client.fetchQuery(storeCatalogOptions(client))
      : limitedProducts(limit),
    fetchCollectionProducts: cached('collection-products', shopify.fetchCollectionProducts),
    fetchCollections: cached('collections', shopify.fetchCollections),
    fetchCollectionImage: cached('collection-image', shopify.fetchCollectionImage),
    fetchNewestProducts: cached('new-products', shopify.fetchNewestProducts),
    fetchProductByHandle: cached('product', shopify.fetchProductByHandle),
    fetchProductBundleTiers: cached('bundle-tiers', shopify.fetchProductBundleTiers),
    fetchCartRecommendations: cached('recommendations', shopify.fetchCartRecommendations),
    readProduct: (handle: string) => client.getQueryData<shopify.ShopifyProduct | null>([...STORE_RESOURCES_KEY, 'product', handle]),
    refresh: () => client.invalidateQueries({ queryKey: STORE_RESOURCES_KEY, refetchType: 'none' }),
  };
}
