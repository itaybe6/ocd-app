export type CatalogSort = 'recommended' | 'price-asc' | 'price-desc' | 'name';
export type CatalogFilters = {
  minPrice: string;
  maxPrice: string;
  inStock: boolean;
  saleOnly: boolean;
  vendors: string[];
  sort: CatalogSort;
};

export const EMPTY_CATALOG_FILTERS: CatalogFilters = {
  minPrice: '', maxPrice: '', inStock: false, saleOnly: false, vendors: [], sort: 'recommended',
};

type FilterableProduct = {
  name: string; subtitle: string; description: string; price: number;
  compareAtPrice: number | null; availableForSale: boolean; vendor?: string | null;
};

function priceValue(value: string): number | undefined {
  return value.trim() ? Number(value.trim().replace(',', '.')) : undefined;
}

export function catalogPriceError(filters: CatalogFilters): string | null {
  const min = priceValue(filters.minPrice), max = priceValue(filters.maxPrice);
  if ([min, max].some(value => value !== undefined && (!Number.isFinite(value) || value < 0))) return 'יש להזין מחיר תקין, גדול או שווה לאפס';
  if (min !== undefined && max !== undefined && min > max) return 'המחיר המקסימלי צריך להיות גדול או שווה למחיר המינימלי';
  return null;
}

export function countCatalogFilters(filters: CatalogFilters): number {
  return Number(Boolean(filters.minPrice.trim() || filters.maxPrice.trim())) + Number(filters.inStock)
    + Number(filters.saleOnly) + filters.vendors.length + Number(filters.sort !== 'recommended');
}

export function filterCatalogProducts<T extends FilterableProduct>(products: T[], query: string, filters: CatalogFilters): T[] {
  const terms = query.trim().toLocaleLowerCase('he').split(/\s+/).filter(Boolean);
  const min = priceValue(filters.minPrice), max = priceValue(filters.maxPrice);
  const result = products.filter(product => {
    const text = terms.length ? [product.name, product.subtitle, product.description, product.vendor].filter(Boolean).join(' ').toLocaleLowerCase('he') : '';
    return terms.every(term => text.includes(term))
      && (min === undefined || product.price >= min)
      && (max === undefined || product.price <= max)
      && (!filters.inStock || product.availableForSale)
      && (!filters.saleOnly || (product.compareAtPrice != null && product.compareAtPrice > product.price))
      && (!filters.vendors.length || filters.vendors.includes(product.vendor?.trim() ?? ''));
  });
  if (filters.sort === 'price-asc') result.sort((a, b) => a.price - b.price);
  else if (filters.sort === 'price-desc') result.sort((a, b) => b.price - a.price);
  else if (filters.sort === 'name') result.sort((a, b) => a.name.localeCompare(b.name, 'he'));
  return result;
}
