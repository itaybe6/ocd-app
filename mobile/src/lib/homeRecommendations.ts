export type ViewedProduct = {
  id: string;
  productType?: string;
  collectionHandles?: string[];
};
export type ProductView = ViewedProduct & { viewedAt: number };
export const VIEW_HISTORY_TTL = 30 * 24 * 60 * 60 * 1000;
export const VIEW_HISTORY_LIMIT = 60;

const normalize = (value: string) => value.normalize('NFKC').toLowerCase().trim();
const generic = /^(all|all-products|products|מוצרים|כל המוצרים)$/;
const promotional = /sale|discount|best.?sell|recommended|new-arrival|מבצע|הנח|נמכר|חדש|מומלצ/;

export function cleanViewHistory(value: unknown, now = Date.now()): ProductView[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((entry): entry is ProductView => {
    if (!entry || typeof entry.id !== 'string' || typeof entry.viewedAt !== 'number'
      || !Number.isFinite(entry.viewedAt) || entry.viewedAt > now
      || now - entry.viewedAt >= VIEW_HISTORY_TTL || seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  }).slice(0, VIEW_HISTORY_LIMIT).map(entry => ({
    id: entry.id, viewedAt: entry.viewedAt,
    productType: typeof entry.productType === 'string' ? entry.productType : '',
    collectionHandles: Array.isArray(entry.collectionHandles)
      ? entry.collectionHandles.filter((handle): handle is string => typeof handle === 'string').slice(0, 30) : [],
  }));
}

export function rememberProductView(history: ProductView[], product: ViewedProduct, now = Date.now()) {
  return cleanViewHistory([{ ...product, viewedAt: now }, ...history.filter(view => view.id !== product.id)], now);
}

/** Reserve three of every eight positions for discovery, even with a strong viewing history. */
export function recommendHomeProducts<T extends ViewedProduct & { price: number; availableForSale: boolean; hasAvailableVariant?: boolean }>(
  catalog: T[], history: ProductView[], brandHandles: string[] = [], random = Math.random, now = Date.now(),
): T[] {
  const brands = new Set(brandHandles.map(normalize));
  const families = (product: ViewedProduct) => {
    const type = normalize(product.productType ?? '');
    const keys = type && !generic.test(type) ? [`type:${type}`] : [];
    for (const raw of product.collectionHandles ?? []) {
      const handle = normalize(raw);
      if (handle && !brands.has(handle) && !generic.test(handle) && !promotional.test(handle)) keys.push(`collection:${handle}`);
    }
    return [...new Set(keys)];
  };
  const unique = new Map<string, T>();
  for (const product of catalog) if (Number.isFinite(product.price) && product.price > 0) unique.set(product.id, product);
  const products = [...unique.values()];
  const keys = new Map(products.map(product => [product.id, families(product)]));
  const counts = new Map<string, number>();
  for (const values of keys.values()) for (const key of values) counts.set(key, (counts.get(key) ?? 0) + 1);
  const interests = new Map<string, number>();
  const recent = cleanViewHistory(history, now);
  for (const view of recent) {
    const weight = Math.pow(0.5, (now - view.viewedAt) / (7 * 24 * 60 * 60 * 1000));
    for (const key of families(view)) {
      // Broad merchandising collections should not make every item a recommendation.
      if (key.startsWith('collection:') && (counts.get(key) ?? 0) > products.length * 0.65) continue;
      interests.set(key, (interests.get(key) ?? 0) + weight);
    }
  }
  const viewedIds = new Set(recent.map(view => view.id));
  const ranked = products.map(product => {
    const score = Math.max(0, ...(keys.get(product.id) ?? []).map(key => interests.get(key) ?? 0));
    const viewed = viewedIds.has(product.id);
    return { product, related: score > 0 && !viewed,
      available: product.hasAvailableVariant ?? product.availableForSale,
      rank: -Math.log(Math.max(0.000001, random())) / ((1 + Math.min(score, 5)) * (viewed ? 0.2 : 1)) };
  });
  const result: T[] = [];
  for (const available of [true, false]) {
    const pool = ranked.filter(item => item.available === available).sort((a, b) => a.rank - b.rank);
    const related = pool.filter(item => item.related), discovery = pool.filter(item => !item.related);
    let r = 0, d = 0, position = 0;
    while (r < related.length || d < discovery.length) {
      const explore = [2, 4, 6].includes(position % 8);
      const item = (explore && d < discovery.length) || r === related.length ? discovery[d++] : related[r++];
      result.push(item.product);
      position++;
    }
  }
  return result;
}
