import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Toast from '../components/toast/Toast';
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
  /** Replace local cart state with a Shopify cart payload (e.g. after discount apply). */
  setCartSnapshot: (cart: ShopifyCart | null) => Promise<void>;
  getQuantity: (productId: string) => number;
};

const CartContext = createContext<CartContextValue | null>(null);

function getCurrencyCode(cart: ShopifyCart | null, items: CartItem[]) {
  return cart?.cost.currencyCode ?? items[0]?.product.currencyCode ?? 'ILS';
}

function isCartConflictError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.toLowerCase().includes('conflict');
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<ShopifyCart | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isMutating, setIsMutating] = useState(false);

  // Optimistic quantity overrides: productId → desired qty (shown instantly)
  const [optimisticQuantities, setOptimisticQuantities] = useState<Record<string, number>>({});
  // Lines hidden optimistically while their remove API call is still in flight
  const [removingProductIds, setRemovingProductIds] = useState<string[]>([]);
  // Refs for debounced API calls (avoid stale closures in timers)
  const cartRef = useRef<ShopifyCart | null>(null);
  const pendingUpdatesRef = useRef<Record<string, number>>({});
  const updateTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const mutationQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const activeMutationsRef = useRef(0);

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

  const items = useMemo(() => {
    const lines = cart?.lines ?? [];
    if (!removingProductIds.length) return lines;
    return lines.filter((item) => !removingProductIds.includes(item.product.id));
  }, [cart?.lines, removingProductIds]);

  const itemCount = useMemo(() => {
    const base = removingProductIds.length
      ? items.reduce((sum, item) => sum + item.quantity, 0)
      : cart?.totalQuantity ?? items.reduce((sum, item) => sum + item.quantity, 0);
    let delta = 0;
    for (const [productId, optimisticQty] of Object.entries(optimisticQuantities)) {
      const realQty = items.find((i) => i.product.id === productId)?.quantity ?? 0;
      delta += optimisticQty - realQty;
    }
    return Math.max(0, base + delta);
  }, [cart?.totalQuantity, items, optimisticQuantities, removingProductIds.length]);

  const subtotal = removingProductIds.length
    ? items.reduce((sum, item) => sum + item.cost.totalAmount, 0)
    : cart?.cost.subtotalAmount ?? items.reduce((sum, item) => sum + item.cost.totalAmount, 0);
  const currencyCode = getCurrencyCode(cart, items);

  const enqueueCartMutation = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    activeMutationsRef.current += 1;
    setIsMutating(true);

    const run = mutationQueueRef.current
      .catch(() => undefined)
      .then(task);

    mutationQueueRef.current = run.then(
      () => undefined,
      () => undefined,
    );

    return run.finally(() => {
      activeMutationsRef.current = Math.max(0, activeMutationsRef.current - 1);
      if (activeMutationsRef.current === 0) {
        setIsMutating(false);
      }
    });
  }, []);

  const runCartMutation = useCallback(
    async (mutate: () => Promise<ShopifyCart | null>) => enqueueCartMutation(mutate),
    [enqueueCartMutation],
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

  const setCartSnapshot = useCallback(
    async (nextCart: ShopifyCart | null) => {
      await syncCart(nextCart);
    },
    [syncCart],
  );

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
      const currentCart = cartRef.current;
      const line = currentCart?.lines.find((item) => item.product.id === productId) ?? null;
      if (!currentCart?.id || !line) return;

      // Optimistic: hide the line immediately; the API call completes in the background
      setRemovingProductIds((prev) => [...prev, productId]);

      try {
        const nextCart = await runCartMutation(() => removeCartLines(currentCart.id, [line.id]));
        await syncCart(nextCart);
      } catch (error: any) {
        Toast.show({
          type: 'error',
          text1: 'לא הצלחנו להסיר את המוצר',
          text2: error?.message ?? 'נסה שוב בעוד רגע',
        });
      } finally {
        setRemovingProductIds((prev) => prev.filter((id) => id !== productId));
      }
    },
    [runCartMutation, syncCart]
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

      updateTimersRef.current[productId] = setTimeout(() => {
        delete updateTimersRef.current[productId];
        const targetQty = pendingUpdatesRef.current[productId];
        delete pendingUpdatesRef.current[productId];
        if (targetQty === undefined) return;

        const clearOptimistic = () =>
          setOptimisticQuantities((prev) => { const n = { ...prev }; delete n[productId]; return n; });

        void enqueueCartMutation(async () => {
          const applyUpdate = async () => {
            const currentCart = cartRef.current;
            const currentItems = currentCart?.lines ?? [];
            const line = currentItems.find((item) => item.product.id === productId) ?? null;

            if (targetQty <= 0) {
              if (!currentCart?.id || !line) return null;
              return removeCartLines(currentCart.id, [line.id]);
            }

            if (!currentCart?.id || !line) return null;
            return updateCartLines(currentCart.id, [{ id: line.id, quantity: targetQty }]);
          };

          try {
            let nextCart = await applyUpdate();
            if (!nextCart) {
              clearOptimistic();
              return;
            }

            clearOptimistic();
            await syncCart(nextCart);
          } catch (error: unknown) {
            if (isCartConflictError(error) && cartRef.current?.id) {
              try {
                const refreshedCart = await fetchCart(cartRef.current.id);
                if (refreshedCart) {
                  cartRef.current = refreshedCart;
                  setCart(refreshedCart);
                }
                await delay(180);
                const nextCart = await applyUpdate();
                if (nextCart) {
                  clearOptimistic();
                  await syncCart(nextCart);
                  return;
                }
              } catch {
                // fall through to error toast below
              }
            }

            clearOptimistic();
            const message = error instanceof Error ? error.message : 'נסה שוב בעוד רגע';
            Toast.show({
              type: 'error',
              text1: 'עדכון הכמות נכשל',
              text2: message,
            });
          }
        });
      }, 350);

      return Promise.resolve();
    },
    [enqueueCartMutation, syncCart]
  );

  const clearCart = useCallback(async () => {
    const currentCart = cartRef.current;
    const lineIds = currentCart?.lines.map((item) => item.id) ?? [];

    // Always drop local cart first — after checkout the Shopify cart is completed
    // and can no longer be mutated, so API cleanup is best-effort only.
    setOptimisticQuantities({});
    setCart(null);
    await persistCartId(null);

    if (!currentCart?.id || !lineIds.length) return;

    try {
      await removeCartLines(currentCart.id, lineIds);
    } catch {
      // Completed / expired carts fail here; local discard above is enough.
    }
  }, [persistCartId]);

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
      setCartSnapshot,
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
      setCartSnapshot,
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
