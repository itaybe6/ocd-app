import type { StoreProduct } from '../screens/store/StoreHomeScreen';

export type HomeFeedMode = 'all' | 'sale' | 'popular' | 'new';
export const HOME_FEED_PAGE_SIZE = 8;
export function needsVariantSelection(product: StoreProduct) {
  // Unknown variant metadata must never silently add the first option.
  return product.variantCount !== 1;
}
export function isPurchasable(product: StoreProduct) {
  return product.hasAvailableVariant ?? product.availableForSale;
}
export function selectHomeFeedProducts(mode: HomeFeedMode, catalog: StoreProduct[], sale: StoreProduct[], popular: StoreProduct[], newest: StoreProduct[]) {
  const reduced = (p: StoreProduct) => p.compareAtPrice != null && p.compareAtPrice > p.price;
  const source = mode === 'new' ? newest
    : mode === 'popular' ? [...popular, ...catalog]
    : mode === 'sale' ? [...sale, ...catalog.filter(reduced)]
    : [...sale, ...catalog.filter(reduced), ...catalog];
  const seen = new Set<string>();
  const products = source.filter(product => {
    if (seen.has(product.id) || !Number.isFinite(product.price) || product.price <= 0) return false;
    seen.add(product.id);
    return true;
  });
  // Keep the provider's ranking intact in the explicit sales/newest modes.
  return mode === 'all' || mode === 'sale'
    ? products.sort((a, b) => Number(isPurchasable(b)) - Number(isPurchasable(a)))
    : products;
}
