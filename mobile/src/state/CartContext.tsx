import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Toast from 'react-native-toast-message';
import {
  addCartLines,
  createCart,
  fetchCart,
  removeCartLines,
  type ShopifyCart,
  type ShopifyCartLine,
  type ShopifyCartProduct,
  updateCartLines,
} from '../lib/shopify';

const STORAGE_KEY = 'shopify-storefront-cart-id';

export type CartProduct = ShopifyCartProduct;

export type CartItem = ShopifyCartLine;

type CartContextValue = {
  cartId: string | null;
  checkoutUrl: string | null;
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  currencyCode: string;
  isBootstrapping: boolean;
  isMutating: boolean;
  addItem: (product: CartProduct) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  getQuantity: (productId: string) => number;
};

const CartContext = createContext<CartContextValue | null>(null);

function getCurrencyCode(cart: ShopifyCart | null, items: CartItem[]) {
  return cart?.cost.currencyCode ?? items[0]?.product.currencyCode ?? 'ILS';
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<ShopifyCart | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isMutating, setIsMutating] = useState(false);

  const persistCartId = useCallback(async (nextCartId: string | null) => {
    if (nextCartId) {
      await AsyncStorage.setItem(STORAGE_KEY, nextCartId);
      return;
    }

    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const syncCart = useCallback(
    async (nextCart: ShopifyCart | null) => {
      setCart(nextCart);
      await persistCartId(nextCart?.id ?? null);
    },
    [persistCartId]
  );

  useEffect(() => {
    let alive = true;

    const bootstrap = async () => {
      try {
        const storedCartId = await AsyncStorage.getItem(STORAGE_KEY);
        if (!storedCartId) return;

        const restoredCart = await fetchCart(storedCartId);
        if (!alive) return;

        if (!restoredCart || !restoredCart.lines.length) {
          await syncCart(restoredCart);
          return;
        }

        setCart(restoredCart);
      } catch {
        if (!alive) return;
        setCart(null);
        await AsyncStorage.removeItem(STORAGE_KEY);
      } finally {
        if (alive) {
          setIsBootstrapping(false);
        }
      }
    };

    bootstrap().catch(async () => {
      if (!alive) return;
      setCart(null);
      setIsBootstrapping(false);
      await AsyncStorage.removeItem(STORAGE_KEY);
    });

    return () => {
      alive = false;
    };
  }, [syncCart]);

  const items = cart?.lines ?? [];
  const itemCount = cart?.totalQuantity ?? items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart?.cost.subtotalAmount ?? items.reduce((sum, item) => sum + item.cost.totalAmount, 0);
  const currencyCode = getCurrencyCode(cart, items);

  const findLineByProductId = useCallback(
    (productId: string) => items.find((item) => item.product.id === productId) ?? null,
    [items]
  );

  const runCartMutation = useCallback(
    async (mutate: () => Promise<ShopifyCart | null>) => {
      setIsMutating(true);
      try {
        return await mutate();
      } finally {
        setIsMutating(false);
      }
    },
    []
  );

  const refreshCart = useCallback(async () => {
    if (!cart?.id) return;

    try {
      const latestCart = await runCartMutation(() => fetchCart(cart.id));
      await syncCart(latestCart);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'לא הצלחנו לרענן את העגלה',
        text2: error?.message ?? 'נסה שוב בעוד רגע',
      });
    }
  }, [cart?.id, runCartMutation, syncCart]);

  const addItem = useCallback(
    async (product: CartProduct) => {
      if (!product.variantId) {
        Toast.show({
          type: 'error',
          text1: 'לא ניתן להוסיף את המוצר לעגלה',
          text2: 'לא נמצאה וריאציה זמינה למוצר הזה',
        });
        return;
      }

      try {
        const nextCart = await runCartMutation(async () => {
          if (cart?.id) {
            return addCartLines(cart.id, [{ merchandiseId: product.variantId, quantity: 1 }]);
          }

          return createCart([{ merchandiseId: product.variantId, quantity: 1 }]);
        });

        await syncCart(nextCart);
        Toast.show({
          type: 'success',
          text1: 'המוצר נוסף לעגלה',
          text2: product.name,
        });
      } catch (error: any) {
        Toast.show({
          type: 'error',
          text1: 'ההוספה לעגלה נכשלה',
          text2: error?.message ?? 'נסה שוב בעוד רגע',
        });
      }
    },
    [cart?.id, runCartMutation, syncCart]
  );

  const removeItem = useCallback(
    async (productId: string) => {
      const line = findLineByProductId(productId);
      if (!cart?.id || !line) return;

      try {
        const nextCart = await runCartMutation(() => removeCartLines(cart.id, [line.id]));
        await syncCart(nextCart);
      } catch (error: any) {
        Toast.show({
          type: 'error',
          text1: 'לא הצלחנו להסיר את המוצר',
          text2: error?.message ?? 'נסה שוב בעוד רגע',
        });
      }
    },
    [cart?.id, findLineByProductId, runCartMutation, syncCart]
  );

  const updateQuantity = useCallback(
    async (productId: string, quantity: number) => {
      const line = findLineByProductId(productId);
      if (!cart?.id || !line) return;

      if (quantity <= 0) {
        await removeItem(productId);
        return;
      }

      try {
        const nextCart = await runCartMutation(() => updateCartLines(cart.id, [{ id: line.id, quantity }]));
        await syncCart(nextCart);
      } catch (error: any) {
        Toast.show({
          type: 'error',
          text1: 'עדכון הכמות נכשל',
          text2: error?.message ?? 'נסה שוב בעוד רגע',
        });
      }
    },
    [cart?.id, findLineByProductId, removeItem, runCartMutation, syncCart]
  );

  const clearCart = useCallback(async () => {
    if (!cart?.id || !items.length) return;

    try {
      const nextCart = await runCartMutation(() => removeCartLines(cart.id, items.map((item) => item.id)));
      await syncCart(nextCart);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'ניקוי העגלה נכשל',
        text2: error?.message ?? 'נסה שוב בעוד רגע',
      });
    }
  }, [cart?.id, items, runCartMutation, syncCart]);

  const getQuantity = useCallback(
    (productId: string) => items.find((item) => item.product.id === productId)?.quantity ?? 0,
    [items]
  );

  const value = useMemo<CartContextValue>(
    () => ({
      cartId: cart?.id ?? null,
      checkoutUrl: cart?.checkoutUrl ?? null,
      items,
      itemCount,
      subtotal,
      currencyCode,
      isBootstrapping,
      isMutating,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      refreshCart,
      getQuantity,
    }),
    [
      addItem,
      cart?.checkoutUrl,
      cart?.id,
      clearCart,
      currencyCode,
      getQuantity,
      isBootstrapping,
      isMutating,
      itemCount,
      items,
      refreshCart,
      removeItem,
      subtotal,
      updateQuantity,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
