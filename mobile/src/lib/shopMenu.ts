import { SELECTED_BRANDS_NAV, type NavLink } from './collections';
import type { ShopifyMenuItem } from './shopify';

export function navLinksToShopifyMenuItems(links: NavLink[]): ShopifyMenuItem[] {
  return links.map((link, index) => ({
    id: `nav:${link.handle || index}`,
    title: link.label,
    collectionHandle: link.handle || undefined,
    children: link.children?.map((child, childIndex) => ({
      id: `nav:${link.handle || index}:${child.handle}:${childIndex}`,
      title: child.label,
      collectionHandle: child.handle,
    })),
  }));
}

/** רצועת «חברות נבחרות» בדף הבית — לא בתפריט העליון */
export function resolveSelectedBrandsMenuItem(): ShopifyMenuItem | null {
  const [item] = navLinksToShopifyMenuItems([SELECTED_BRANDS_NAV]);
  if (!item?.children?.length) return null;
  return item;
}
