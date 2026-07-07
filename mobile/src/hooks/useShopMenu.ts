import { useQuery } from '@tanstack/react-query';
import type { NavLink } from '../lib/collections';

const NAV_URL = 'https://www.ocd-online.co.il/api/public/nav';

/** Bump version when server nav structure changes to bust React Query cache. */
export const SHOP_MENU_QUERY_KEY = ['remote-nav', 'v2'] as const;

export function useShopMenu(): { data: NavLink[]; loading: boolean } {
  const query = useQuery({
    queryKey: SHOP_MENU_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch(NAV_URL);
      if (!res.ok) throw new Error(`nav ${res.status}`);
      const json = await res.json();
      return json.menu as NavLink[];
    },
    staleTime: 1000 * 60 * 10,
  });
  return { data: query.data ?? [], loading: query.isLoading };
}
