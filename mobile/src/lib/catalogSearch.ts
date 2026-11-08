import { createProductBrandResolver, type RemoteBrand } from './brands';
import { type StoreProduct } from '../screens/store/StoreHomeScreen';

export const normalizeSearchQuery = (value: string) => value.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');

/** Build once per catalog/brand update, not on every keystroke. */
export function indexCatalog(products: StoreProduct[], brands: RemoteBrand[], scope: 'name' | 'catalog' = 'catalog') {
  if (scope === 'name') return products.map(product => ({ product, name: normalizeSearchQuery(product.name), text: '' }));
  const resolveBrand = createProductBrandResolver(brands);
  return products.map(product => {
    const brand = resolveBrand(product);
    const text = [product.name, product.subtitle, product.description, product.vendor,
      ...(product.tags ?? []), ...(product.collectionHandles ?? []), ...(product.collectionTitles ?? []),
      brand?.label, brand?.short, brand?.handle, ...(brand?.keywords ?? [])].filter(Boolean).join(' ');
    return { product, name: normalizeSearchQuery(product.name), text: normalizeSearchQuery(text) };
  });
}

export function searchCatalog(index: ReturnType<typeof indexCatalog>, query: string, scope: 'name' | 'catalog' = 'name'): StoreProduct[] {
  const needle = normalizeSearchQuery(query);
  const words = needle.split(' ').filter(Boolean);
  const score = (name: string) => name === needle ? 0 : name.startsWith(needle) ? 1 : name.includes(needle) ? 2 : 3;
  const seen = new Set<string>();
  return index
    .filter(entry => words.every(word => (scope === 'name' ? entry.name : entry.text).includes(word)))
    .sort((a, b) => score(a.name) - score(b.name))
    .filter(entry => {
      if (seen.has(entry.product.id)) return false;
      seen.add(entry.product.id);
      return true;
    })
    .map(entry => entry.product);
}

export function mergeSearchProducts(local: StoreProduct[], remote: StoreProduct[]): StoreProduct[] {
  const seen = new Set<string>();
  return [...local, ...remote].filter(product => {
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  });
}
