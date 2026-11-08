import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../state/AuthContext';
import { recordProductView } from '../lib/productViewHistory';
import type { ViewedProduct } from '../lib/homeRecommendations';

export function useProductViewTracking(product: ViewedProduct | null) {
  const { user } = useAuth();
  const latest = useRef(product);
  latest.current = product;
  const productId = product?.id;
  useFocusEffect(useCallback(() => {
    if (!productId) return;
    // An accidental tap or a product that never loaded is not an interest signal.
    const timer = setTimeout(() => {
      if (latest.current?.id === productId) void recordProductView(user?.id, latest.current);
    }, 2000);
    return () => clearTimeout(timer);
  }, [user?.id, productId]));
}
