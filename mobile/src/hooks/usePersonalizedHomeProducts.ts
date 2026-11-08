import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { StoreProduct } from '../screens/store/StoreHomeScreen';
import type { RemoteBrand } from '../lib/brands';
import { recommendHomeProducts, type ProductView } from '../lib/homeRecommendations';
import { readProductViews } from '../lib/productViewHistory';

export function usePersonalizedHomeProducts(catalog: StoreProduct[], brands: RemoteBrand[], userId?: string) {
  const request = useRef(0);
  const [visit, setVisit] = useState<{ userId?: string; history: ProductView[]; revision: number } | null>(null);
  const refresh = useCallback(async () => {
    const ticket = ++request.current;
    const history = await readProductViews(userId);
    if (ticket === request.current) setVisit(previous => ({ userId, history, revision: (previous?.revision ?? 0) + 1 }));
  }, [userId]);
  useFocusEffect(useCallback(() => {
    void refresh();
    return () => { request.current++; };
  }, [refresh]));

  const [feed, setFeed] = useState<{ visit: typeof visit; source: StoreProduct[]; items: StoreProduct[] }>({ visit: null, source: [], items: [] });
  // Account changes must never expose the previous account's personalized order.
  const ready = visit !== null && visit.userId === userId;
  let products = ready ? feed.items : [];
  if (ready && (feed.visit !== visit || feed.source !== catalog)) {
    const incoming = recommendHomeProducts(catalog, visit.history, brands.map(brand => brand.handle));
    if (feed.visit === visit) {
      // Catalog pages and price updates may arrive during scrolling. Keep the current order.
      const current = new Map(incoming.map(product => [product.id, product]));
      products = feed.items.flatMap(product => {
        const fresh = current.get(product.id);
        current.delete(product.id);
        return fresh ? [fresh] : [];
      });
      products.push(...current.values());
    } else products = incoming;
    setFeed({ visit, source: catalog, items: products });
  }
  return { products, refresh, revision: visit?.revision ?? 0 };
}
