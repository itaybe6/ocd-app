import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
import { buildMobileAppCartOptions } from '../services/shopify';

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
  addItem: (product: CartProduct, quantity?: number) => Promise<void>;
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

  // Optimistic quantity overrides: productId → desired qty (shown instantly)
  const [optimisticQuantities, setOptimisticQuantities] = useState<Record<string, number>>({});
  // Refs for debounced API calls (avoid stale closures in timers)
  const cartRef = useRef<ShopifyCart | null>(null);
  const pendingUpdatesRef = useRef<Record<string, number>>({});
  const updateTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Keep cartRef current so debounce timers always see the latest cart
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

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

  const itemCount = useMemo(() => {
    const base = cart?.totalQuantity ?? items.reduce((sum, item) => sum + item.quantity, 0);
    let delta = 0;
    for (const [productId, optimisticQty] of Object.entries(optimisticQuantities)) {
      const realQty = items.find((i) => i.product.id === productId)?.quantity ?? 0;
      delta += optimisticQty - realQty;
    }
    return Math.max(0, base + delta);
  }, [cart?.totalQuantity, items, optimisticQuantities]);

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
    async (product: CartProduct, quantity = 1) => {
      if (!product.variantId) {
        Toast.show({
          type: 'error',
          text1: 'לא ניתן להוסיף את המוצר לעגלה',
          text2: 'לא נמצאה וריאציה זמינה למוצר הזה',
        });
        return;
      }

      const qty = Math.max(1, Math.round(quantity));

      // Optimistic: show qty immediately
      setOptimisticQuantities((prev) => ({ ...prev, [product.id]: qty }));

      try {
        const nextCart = await runCartMutation(async () => {
          const currentCart = cartRef.current;
          if (currentCart?.id) {
            return addCartLines(currentCart.id, [{ merchandiseId: product.variantId, quantity: qty }]);
          }

          return createCart(
            [{ merchandiseId: product.variantId, quantity: qty }],
            buildMobileAppCartOptions(),
          );
        });

        setOptimisticQuantities((prev) => { const n = { ...prev }; delete n[product.id]; return n; });
        await syncCart(nextCart);
      } catch (error: any) {
        setOptimisticQuantities((prev) => { const n = { ...prev }; delete n[product.id]; return n; });
        Toast.show({
          type: 'error',
          text1: 'ההוספה לעגלה נכשלה',
          text2: error?.message ?? 'נסה שוב בעוד רגע',
        });
      }
    },
    [runCartMutation, syncCart]
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
    (productId: string, quantity: number): Promise<void> => {
      // Show new quantity instantly
      setOptimisticQuantities((prev) => {
        if (quantity <= 0) {
          const n = { ...prev };
          delete n[productId];
          return n;
        }
        return { ...prev, [productId]: quantity };
      });

      pendingUpdatesRef.current[productId] = quantity;

      // Debounce: wait 350ms after the last press before hitting the API
      if (updateTimersRef.current[productId]) {
        clearTimeout(updateTimersRef.current[productId]);
      }

      updateTimersRef.current[productId] = setTimeout(async () => {
        delete updateTimersRef.current[productId];
        const targetQty = pendingUpdatesRef.current[productId];
        delete pendingUpdatesRef.current[productId];
        if (targetQty === undefined) return;

        const currentCart = cartRef.current;
        const currentItems = currentCart?.lines ?? [];
        const line = currentItems.find((item) => item.product.id === productId) ?? null;

        const clearOptimistic = () =>
          setOptimisticQuantities((prev) => { const n = { ...prev }; delete n[productId]; return n; });

        try {
          let nextCart: ShopifyCart | null;
          if (targetQty <= 0) {
            if (!currentCart?.id || !line) { clearOptimistic(); return; }
            nextCart = await removeCartLines(currentCart.id, [line.id]);
          } else {
            if (!currentCart?.id || !line) { clearOptimistic(); return; }
            nextCart = await updateCartLines(currentCart.id, [{ id: line.id, quantity: targetQty }]);
          }
          clearOptimistic();
          await syncCart(nextCart);
        } catch (error: any) {
          clearOptimistic();
          Toast.show({
            type: 'error',
            text1: 'עדכון הכמות נכשל',
            text2: error?.message ?? 'נסה שוב בעוד רגע',
          });
        }
      }, 350);

      return Promise.resolve();
    },
    [syncCart]
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
    (productId: string) => {
      if (productId in optimisticQuantities) return optimisticQuantities[productId];
      return items.find((item) => item.product.id === productId)?.quantity ?? 0;
    },
    [items, optimisticQuantities]
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
