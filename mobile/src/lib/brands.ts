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

export function findProductBrand(
  product: { title?: string; tags?: string[] },
  brands: RemoteBrand[],
): RemoteBrand | undefined {
  const title = (product.title ?? '').toLowerCase();
  const tags = (product.tags ?? []).map((t) => t.toLowerCase());
  const byTag = brands.find((b) => b.tags.some((t) => tags.includes(t.toLowerCase())));
  if (byTag) return byTag;
  return brands.find((b) => b.keywords.some((k) => title.includes(k.toLowerCase())));
}
