import { Image } from 'react-native';
import { SELECTED_BRANDS_NAV } from './collections';
import type { RemoteBrand } from './brands';

const LOCAL_BRAND_IMAGES: Record<string, number> = {
  'סנו-1': require('../../assets/brands/newbrands/sano3.png'),
  'טאצ': require('../../assets/brands/newbrands/touchll.png'),
  'פינל-1': require('../../assets/brands/newbrands/finallll.png'),
  'יעקבי': require('../../assets/brands/newbrands/yakobilll.png'),
  'סאג': require('../../assets/brands/newbrands/saglll.png'),
  'סוסיטסא': require('../../assets/brands/newbrands/suslll.png'),
  'מוצרי-tnx': require('../../assets/brands/TNX.png'),
  'מארזי-ניקיון-משתלמים-copy-1': require('../../assets/brands/newbrands/greencarelll.png'),
  voluspa: require('../../assets/brands/voluspa.webp'),
  דקרודו: require('../../assets/brands/decorado.webp'),
  דפינול: require('../../assets/brands/dafinol.webp'),
  mari: require('../../assets/brands/mari.webp'),
};

const LOCAL_BRAND_META: Record<
  string,
  Pick<RemoteBrand, 'short' | 'tone' | 'tags' | 'keywords'>
> = {
  'סנו-1': { short: 'סנו', tone: '#E11D48', tags: ['sano', 'סנו'], keywords: ['סנו', 'sano'] },
  'טאצ': {
    short: 'טאצ',
    tone: '#7C3AED',
    tags: ['touch', 'טאצ', "טאץ'", 'טאצ׳'],
    keywords: ['טאצ', "טאץ'", 'טאצ׳', 'touch'],
  },
  'פינל-1': { short: 'פינל', tone: '#2563EB', tags: ['final', 'פינל'], keywords: ['פינל', 'final'] },
  'יעקבי': {
    short: 'יעקבי',
    tone: '#059669',
    tags: ['yaakoby', 'יעקבי', 'יעקובי'],
    keywords: ['יעקבי', 'יעקובי', 'yaakoby', 'yaacoby'],
  },
  'סאג': { short: 'סאג', tone: '#0EA5E9', tags: ['sag', 'סאג'], keywords: ['סאג', 'sag'] },
  'סוסיטסא': {
    short: 'סוס',
    tone: '#F97316',
    tags: ['sucitesa', 'סוסיטסא', 'סוסייטא'],
    keywords: ['סוסיטסא', 'סוסייטא', 'sucitesa'],
  },
  'מוצרי-tnx': { short: 'TNX', tone: '#111827', tags: ['tnx'], keywords: ['tnx'] },
  'מארזי-ניקיון-משתלמים-copy-1': {
    short: 'TGC',
    tone: '#16A34A',
    tags: ['green care', 'tana', 'greencare'],
    keywords: ['green care', 'greencare', 'tana', 'טנה'],
  },
  barbantia: {
    short: 'Bra',
    tone: '#111827',
    tags: ['brabantia', 'barbantia'],
    keywords: ['brabantia', 'barbantia'],
  },
  shiny: { short: 'Sh', tone: '#0EA5E9', tags: ['shiny', 'שייני'], keywords: ['shiny', 'שייני'] },
  טירולר: { short: 'טי', tone: '#7C3AED', tags: ['טירולר', 'tyroler'], keywords: ['טירולר', 'tyroler'] },
  'מוצרי-פרפיוםכביסכל': {
    short: 'כב',
    tone: '#DB2777',
    tags: ['כביסכל', 'פרפיום'],
    keywords: ['כביסכל', 'פרפיום'],
  },
  ocd: { short: 'OCD', tone: '#111827', tags: ['ocd'], keywords: ['ocd'] },
  // Website includes these as hiddenFromCarousel brands — not always in /api/public/brands
  voluspa: {
    short: 'Vo',
    tone: '#000000',
    // Shopify product tag is "ולאספא"; website keywords use וולוספא/וולוספה
    tags: ['voluspa', 'ולאספא', 'וולוספא', 'וולוספה'],
    keywords: ['voluspa', 'ולאספא', 'וולוספא', 'וולוספה'],
  },
  דקרודו: {
    short: 'De',
    tone: '#000000',
    tags: ['decorado', 'דקרודו'],
    keywords: ['decorado', 'דקרודו'],
  },
  דפינול: {
    short: 'דפ',
    tone: '#86c34a',
    tags: ['דפינול', 'depinol'],
    keywords: ['דפינול', 'depinol'],
  },
  mari: {
    short: 'Ma',
    tone: '#7ec1ea',
    tags: ['mari', 'מארי'],
    keywords: ['mari', 'מארי'],
  },
};

/** Extra keywords to merge onto remote brands when API returns empty/partial lists. */
export function getExtraBrandKeywords(handle: string): string[] {
  return LOCAL_BRAND_META[handle]?.keywords ?? [];
}

export function getExtraBrandTags(handle: string): string[] {
  return LOCAL_BRAND_META[handle]?.tags ?? [];
}

function resolveLocalBrandImage(handle: string): string | null {
  const bundled = LOCAL_BRAND_IMAGES[handle];
  if (!bundled) return null;
  return Image.resolveAssetSource(bundled)?.uri ?? null;
}

export function getLocalBrandImageByHandle(handle: string): string | null {
  return resolveLocalBrandImage(handle);
}

/** Local fallback when /api/public/brands is unavailable — mirrors SELECTED_BRANDS_NAV + bundled logos. */
export function getFallbackBrands(): RemoteBrand[] {
  return (SELECTED_BRANDS_NAV.children ?? []).map((child) => {
    const meta = LOCAL_BRAND_META[child.handle] ?? {
      short: child.label.slice(0, 3),
      tone: '#374151',
      tags: [child.handle],
      keywords: [child.label.toLowerCase()],
    };

    return {
      handle: child.handle,
      label: child.label,
      short: meta.short,
      tone: meta.tone,
      image: resolveLocalBrandImage(child.handle),
      keywords: meta.keywords,
      tags: meta.tags,
      hiddenFromCarousel: false,
    };
  });
}

/**
 * Brands that appear on product cards on the website but are often missing from
 * `/api/public/brands` (hiddenFromCarousel there): Voluspa, Decorado, etc.
 */
export function getSupplementalBrands(): RemoteBrand[] {
  return [
    {
      handle: 'voluspa',
      label: 'Voluspa',
      short: 'Vo',
      tone: '#000000',
      image: resolveLocalBrandImage('voluspa'),
      keywords: LOCAL_BRAND_META.voluspa.keywords,
      tags: LOCAL_BRAND_META.voluspa.tags,
      hiddenFromCarousel: true,
    },
    {
      handle: 'דקרודו',
      label: 'Decorado',
      short: 'De',
      tone: '#000000',
      image: resolveLocalBrandImage('דקרודו'),
      keywords: LOCAL_BRAND_META['דקרודו'].keywords,
      tags: LOCAL_BRAND_META['דקרודו'].tags,
      hiddenFromCarousel: true,
    },
    {
      handle: 'דפינול',
      label: 'דפינול',
      short: 'דפ',
      tone: '#86c34a',
      image: resolveLocalBrandImage('דפינול'),
      keywords: LOCAL_BRAND_META['דפינול'].keywords,
      tags: LOCAL_BRAND_META['דפינול'].tags,
      hiddenFromCarousel: true,
    },
    {
      handle: 'mari',
      label: 'Mari',
      short: 'Ma',
      tone: '#7ec1ea',
      image: resolveLocalBrandImage('mari'),
      keywords: LOCAL_BRAND_META.mari.keywords,
      tags: LOCAL_BRAND_META.mari.tags,
      hiddenFromCarousel: true,
    },
  ];
}

/** Merge API brands with supplemental brands (by handle), then enrich matchers. */
export function mergeWithSupplementalBrands(brands: RemoteBrand[]): RemoteBrand[] {
  const byHandle = new Map(brands.map((b) => [b.handle, b]));
  for (const extra of getSupplementalBrands()) {
    if (!byHandle.has(extra.handle)) byHandle.set(extra.handle, extra);
  }
  return [...byHandle.values()].map(enrichBrandMatchers);
}

/** Merge local keyword/tag aliases onto remote brands (API often returns empty tags). */
export function enrichBrandMatchers(brand: RemoteBrand): RemoteBrand {
  const extraKeywords = getExtraBrandKeywords(brand.handle);
  const extraTags = getExtraBrandTags(brand.handle);
  const labelTokens = [brand.label, brand.short, brand.handle].filter(Boolean);
  const keywords = [...new Set([...(brand.keywords ?? []), ...extraKeywords, ...labelTokens])];
  const tags = [...new Set([...(brand.tags ?? []), ...extraTags])];
  return { ...brand, keywords, tags };
}
