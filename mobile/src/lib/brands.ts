export interface RemoteBrand {
  handle: string;
  label: string;
  short: string;
  tone: string;
  image: string | null;
  keywords: string[];
  tags: string[];
  hiddenFromCarousel: boolean;
}

/** API sometimes returns `https://domain/data:image/...` — React Native needs `data:image/...` */
export function normalizeBrandImageUrl(image: string | null | undefined): string | null {
  if (!image?.trim()) return null;
  const url = image.trim();
  if (url.startsWith('data:image/')) return url;

  const domainDataPrefix = 'https://www.ocd-online.co.il/data:';
  if (url.startsWith(domainDataPrefix)) {
    return url.slice('https://www.ocd-online.co.il/'.length);
  }

  const dataIdx = url.indexOf('/data:image/');
  if (dataIdx >= 0) return url.slice(dataIdx + 1);

  return url;
}

export function resolveBrandTone(tone: string | undefined): string {
  const value = tone?.trim();
  if (!value) return '#374151';
  if (value.startsWith('#')) {
    const lower = value.toLowerCase();
    if (lower === '#fff' || lower === '#ffffff') return '#374151';
    return value;
  }
  const gradientColor = value.match(/#[0-9a-fA-F]{3,8}/);
  if (gradientColor) return gradientColor[0];
  return '#374151';
}

export function normalizeRemoteBrand(brand: RemoteBrand, localImage?: string | null): RemoteBrand {
  return {
    ...brand,
    image: normalizeBrandImageUrl(brand.image) ?? localImage ?? null,
  };
}

/** Normalize Hebrew punctuation / spacing so "טאצ׳" matches "טאצ'" / "טאצ". */
export function normalizeBrandText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/['’`׳״"]/g, '')
    .replace(/[-_/.,()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokens that identify a brand (Shopify tag / brand collection handle / title). */
function brandTagMatchers(brand: RemoteBrand): string[] {
  const raw = [
    brand.label,
    brand.short,
    brand.handle,
    ...brand.keywords,
    ...brand.tags,
    // handle fragments: "סנו-1" → "סנו", "מוצרי-tnx" → "tnx"
    ...brand.handle.split(/[-_]/g),
  ];

  const tokens = new Set<string>();
  for (const item of raw) {
    const normalized = normalizeBrandText(String(item ?? ''));
    if (normalized.length < 2) continue;
    tokens.add(normalized);
    tokens.add(normalized.replace(/\s+/g, ''));
  }
  return [...tokens];
}

function collectProductBrandKeys(product: {
  tags?: string[];
  collectionHandles?: string[];
  collectionTitles?: string[];
}): string[] {
  const raw = [
    ...(product.tags ?? []),
    ...(product.collectionHandles ?? []),
    ...(product.collectionTitles ?? []),
  ];
  return [...new Set(raw.map((t) => normalizeBrandText(t)).filter((t) => t.length >= 2))];
}

/**
 * Resolve brand badge from Shopify product tags and brand collections.
 * Examples:
 * - tags=["סנו"] → סנו
 * - collectionHandles=["סוסיטסא"] → Sucitesa (even when tags are empty)
 * Does not use vendor or product title.
 */
export function findProductBrand(
  product: {
    tags?: string[];
    collectionHandles?: string[];
    collectionTitles?: string[];
  },
  brands: RemoteBrand[],
): RemoteBrand | undefined {
  if (!brands.length) return undefined;

  const productKeys = collectProductBrandKeys(product);
  if (!productKeys.length) return undefined;

  let best: { brand: RemoteBrand; score: number } | null = null;

  for (const brand of brands) {
    const matchers = brandTagMatchers(brand);
    if (!matchers.length) continue;

    for (const key of productKeys) {
      for (const matcher of matchers) {
        const exact = key === matcher;
        const compact =
          matcher.length >= 3 &&
          (key.replace(/\s+/g, '') === matcher.replace(/\s+/g, '') ||
            key.includes(matcher) ||
            matcher.includes(key));
        if (!exact && !compact) continue;

        const score = exact ? matcher.length + 100 : matcher.length;
        if (!best || score > best.score) best = { brand, score };
      }
    }
  }

  return best?.brand;
}
