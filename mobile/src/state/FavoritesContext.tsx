import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Toast from 'react-native-toast-message';
import { safeNavigate } from '../navigation/navigationRef';
import type { ProductFavoriteRow } from '../types/database';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { FavoriteProductInput } from '../lib/favorites';

type FavoritesContextValue = {
  favorites: ProductFavoriteRow[];
  favoriteCount: number;
  isHydrating: boolean;
  isFavorite: (productId: string) => boolean;
  isFavoritePending: (productId: string) => boolean;
  toggleFavorite: (product: FavoriteProductInput) => Promise<boolean>;
  removeFavorite: (productId: string) => Promise<void>;
  refreshFavorites: () => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<ProductFavoriteRow[]>([]);
  const [isHydrating, setIsHydrating] = useState(false);
  const [pendingProductIds, setPendingProductIds] = useState<string[]>([]);

  const canUseFavorites = user?.role === 'customer';

  const setPending = useCallback((productId: string, next: boolean) => {
    setPendingProductIds((current) => {
      if (next) {
        return current.includes(productId) ? current : current.concat(productId);
      }

      return current.filter((id) => id !== productId);
    });
  }, []);

  const refreshFavorites = useCallback(async () => {
    if (!canUseFavorites || !user?.id) {
      setFavorites([]);
      return;
    }

    setIsHydrating(true);
    try {
      const { data, error } = await supabase
        .from('product_favorites')
        .select(
          'id, user_id, product_id, product_handle, product_title, product_description, product_type, image_url, image_alt_text, price, currency_code, created_at'
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFavorites((data ?? []) as ProductFavoriteRow[]);
    } catch (error: any) {
      setFavorites([]);
      Toast.show({
        type: 'error',
        text1: 'טעינת אהבתי נכשלה',
        text2: error?.message ?? 'Unknown error',
      });
    } finally {
      setIsHydrating(false);
    }
  }, [canUseFavorites, user?.id]);

  useEffect(() => {
    refreshFavorites().catch(() => {});
  }, [refreshFavorites]);

  const ensureCustomerAccess = useCallback(() => {
    if (!user) {
      Toast.show({
        type: 'info',
        text1: 'כדי לשמור מוצרים צריך להתחבר',
        text2: 'התחבר כלקוח כדי להשתמש בעמוד אהבתי',
      });
      safeNavigate('Login');
      return false;
    }

    if (user.role !== 'customer') {
      Toast.show({
        type: 'error',
        text1: 'שמירת מוצרים זמינה רק ללקוחות',
      });
      return false;
    }

    return true;
  }, [user]);

  const isFavorite = useCallback(
    (productId: string) => favorites.some((favorite) => favorite.product_id === productId),
    [favorites]
  );

  const isFavoritePending = useCallback(
    (productId: string) => pendingProductIds.includes(productId),
    [pendingProductIds]
  );

  const removeFavorite = useCallback(
    async (productId: string) => {
      if (!user?.id || user.role !== 'customer') return;
      if (pendingProductIds.includes(productId)) return;

      setPending(productId, true);
      try {
        const { error } = await supabase
          .from('product_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', productId);

        if (error) throw error;

        setFavorites((current) => current.filter((favorite) => favorite.product_id !== productId));
        Toast.show({
          type: 'success',
          text1: 'המוצר הוסר מאהבתי',
        });
      } catch (error: any) {
        Toast.show({
          type: 'error',
          text1: 'הסרת המוצר נכשלה',
          text2: error?.message ?? 'Unknown error',
        });
      } finally {
        setPending(productId, false);
      }
    },
    [pendingProductIds, setPending, user?.id, user?.role]
  );

  const toggleFavorite = useCallback(
    async (product: FavoriteProductInput) => {
      if (!ensureCustomerAccess() || !user?.id) return false;
      if (pendingProductIds.includes(product.product_id)) return isFavorite(product.product_id);

      const currentlyFavorite = isFavorite(product.product_id);
      setPending(product.product_id, true);

      try {
        if (currentlyFavorite) {
          const { error } = await supabase
            .from('product_favorites')
            .delete()
            .eq('user_id', user.id)
            .eq('product_id', product.product_id);

          if (error) throw error;

          setFavorites((current) => current.filter((favorite) => favorite.product_id !== product.product_id));
          Toast.show({
            type: 'success',
            text1: 'המוצר הוסר מאהבתי',
            text2: product.product_title,
          });
          return false;
        }

        const payload = {
          user_id: user.id,
          ...product,
        };

        const { data, error } = await supabase
          .from('product_favorites')
          .upsert(payload, { onConflict: 'user_id,product_id' })
          .select(
            'id, user_id, product_id, product_handle, product_title, product_description, product_type, image_url, image_alt_text, price, currency_code, created_at'
          )
          .single();

        if (error) throw error;

        const nextFavorite = data as ProductFavoriteRow;
        setFavorites((current) => [nextFavorite, ...current.filter((favorite) => favorite.product_id !== product.product_id)]);
        Toast.show({
          type: 'success',
          text1: 'המוצר נשמר באהבתי',
          text2: product.product_title,
        });
        return true;
      } catch (error: any) {
        Toast.show({
          type: 'error',
          text1: 'שמירת המוצר נכשלה',
          text2: error?.message ?? 'Unknown error',
        });
        return currentlyFavorite;
      } finally {
        setPending(product.product_id, false);
      }
    },
    [ensureCustomerAccess, isFavorite, pendingProductIds, setPending, user?.id]
  );

  const value = useMemo<FavoritesContextValue>(
    () => ({
      favorites,
      favoriteCount: favorites.length,
      isHydrating,
      isFavorite,
      isFavoritePending,
      toggleFavorite,
      removeFavorite,
      refreshFavorites,
    }),
    [favorites, isFavorite, isFavoritePending, isHydrating, refreshFavorites, removeFavorite, toggleFavorite]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
}
