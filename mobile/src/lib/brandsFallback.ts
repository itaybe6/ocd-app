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
};

const LOCAL_BRAND_META: Record<
  string,
  Pick<RemoteBrand, 'short' | 'tone' | 'tags' | 'keywords'>
> = {
  'סנו-1': { short: 'סנו', tone: '#E11D48', tags: ['sano', 'סנו'], keywords: ['סנו', 'sano'] },
  'טאצ': { short: 'טאצ', tone: '#7C3AED', tags: ['touch', 'טאצ'], keywords: ['טאצ', 'touch'] },
  'פינל-1': { short: 'פינל', tone: '#2563EB', tags: ['final', 'פינל'], keywords: ['פינל', 'final'] },
  'יעקבי': { short: 'יעקבי', tone: '#059669', tags: ['yaakoby', 'יעקבי'], keywords: ['יעקבי', 'yaakoby'] },
  'סאג': { short: 'סאג', tone: '#0EA5E9', tags: ['sag', 'סאג'], keywords: ['סאג', 'sag'] },
  'סוסיטסא': { short: 'סוס', tone: '#F97316', tags: ['sucitesa', 'סוסיטסא'], keywords: ['סוסיטסא', 'sucitesa'] },
  'מוצרי-tnx': { short: 'TNX', tone: '#111827', tags: ['tnx'], keywords: ['tnx'] },
  'מארזי-ניקיון-משתלמים-copy-1': {
    short: 'TGC',
    tone: '#16A34A',
    tags: ['green care', 'tana'],
    keywords: ['green care', 'tana'],
  },
};

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
