import { useQuery } from '@tanstack/react-query';
import { normalizeRemoteBrand, type RemoteBrand } from '../lib/brands';
import { getFallbackBrands, getLocalBrandImageByHandle } from '../lib/brandsFallback';

const BRANDS_URL = 'https://www.ocd-online.co.il/api/public/brands';

export const REMOTE_BRANDS_QUERY_KEY = ['remote-brands', 'v3'] as const;

function normalizeBrands(brands: RemoteBrand[]): RemoteBrand[] {
  return brands.map((brand) =>
    normalizeRemoteBrand(brand, getLocalBrandImageByHandle(brand.handle)),
  );
}

async function fetchRemoteBrands(): Promise<RemoteBrand[]> {
  try {
    const res = await fetch(BRANDS_URL);
    if (!res.ok) throw new Error(`brands ${res.status}`);
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) throw new Error('brands not json');
    const json = await res.json();
    const brands = json.brands as RemoteBrand[];
    if (!Array.isArray(brands) || !brands.length) throw new Error('brands empty');
    return normalizeBrands(brands);
  } catch {
    return getFallbackBrands();
  }
}

export function useBrands() {
  return useQuery({
    queryKey: REMOTE_BRANDS_QUERY_KEY,
    queryFn: fetchRemoteBrands,
    placeholderData: getFallbackBrands,
    staleTime: 1000 * 60 * 30,
  });
}

export type { RemoteBrand };
