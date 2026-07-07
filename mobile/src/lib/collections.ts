export interface NavLink {
  label: string;
  handle: string;
  children?: { label: string; handle: string }[];
}

export type FeaturedBanner = {
  image: string;
  mobile: string;
  handle: string;
  label: string;
};

const CDN = 'https://ocdonlinee.myshopify.com/cdn/shop/files';

/** Home category banners — mirrors Lovable web app */
export const FEATURED_BANNERS: FeaturedBanner[] = [
  {
    image: `${CDN}/Banners-05.png?v=1767187655&width=2400`,
    mobile: `${CDN}/Banners-11.jpg?v=1767187663&width=900`,
    handle: 'בישום-חללים',
    label: 'בישום חללים',
  },
  {
    image: `${CDN}/Banners-01.png?v=1767187656&width=2400`,
    mobile: `${CDN}/Banners-08.jpg?v=1767187663&width=900`,
    handle: 'חומרי-ניקיון',
    label: 'חומרי ניקיון',
  },
  {
    image: `${CDN}/Banners-04.png?v=1767187656&width=2400`,
    mobile: `${CDN}/Banners-10.jpg?v=1767187663&width=900`,
    handle: 'מוצרי-פרפיוםכביסכל',
    label: 'פרפיום כביסה',
  },
  {
    image: `${CDN}/Banners-02.png?v=1767187655&width=2400`,
    mobile: `${CDN}/Banners-09.jpg?v=1767187663&width=900`,
    handle: 'סוסיטסא',
    label: 'Sucitesa',
  },
  {
    image: `${CDN}/Banners-06.png?v=1767187656&width=2400`,
    mobile: `${CDN}/Banners-12.jpg?v=1767187663&width=900`,
    handle: 'מומלצים',
    label: 'מומלצים',
  },
];

export const FEATURED_BANNER_BY_HANDLE: Record<string, FeaturedBanner> = Object.fromEntries(
  FEATURED_BANNERS.map((banner) => [banner.handle, banner]),
);

/** Mobile banner URL for a collection handle (handles stay unencoded in config) */
export function getFeaturedBannerMobileUrl(handle: string): string | undefined {
  return FEATURED_BANNER_BY_HANDLE[handle.trim()]?.mobile;
}

/** רצועת «חברות נבחרות» — לא בתפריט העליון */
export const SELECTED_BRANDS_NAV: NavLink = {
  label: 'חברות נבחרות',
  handle: '',
  children: [
    { label: 'סנו', handle: 'סנו-1' },
    { label: 'טאצ', handle: 'טאצ' },
    { label: 'פינל', handle: 'פינל-1' },
    { label: 'יעקובי', handle: 'יעקבי' },
    { label: 'סאג', handle: 'סאג' },
    { label: 'סוסיטסא', handle: 'סוסיטסא' },
    { label: 'מוצרי TNX', handle: 'מוצרי-tnx' },
    { label: 'מוצרי Tana-Green Care', handle: 'מארזי-ניקיון-משתלמים-copy-1' },
  ],
};
