import type { StoreProduct } from '../screens/store/StoreHomeScreen';

export function selectMarqueeProducts(products: StoreProduct[], excludedIds: string[], limit = 12) {
  const seen = new Set(excludedIds);
  return products.filter(product => {
    if (seen.has(product.id) || !product.availableForSale || !product.imageUrl || !Number.isFinite(product.price) || product.price <= 0) return false;
    seen.add(product.id);
    return true;
  }).slice(0, limit);
}

export function wrapMarqueeOffset(offset: number, segmentWidth: number) {
  'worklet';
  if (segmentWidth <= 0) return 0;
  return segmentWidth + ((offset % segmentWidth) + segmentWidth) % segmentWidth;
}
