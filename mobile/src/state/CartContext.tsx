import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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
import { createCartQuantityStore } from '../lib/cartQuantityStore';

const STORAGE_KEY = 'shopify-storefront-cart-id';

export type CartProduct = ShopifyCartProduct;
export type CartQuantityProduct = CartProduct & { availableForSale: boolean };

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
  updateQuantity: (productId: string, quantity: number, product?: CartQuantityProduct) => Promise<void>;
  adjustQuantity: (productId: string, delta: number) => void;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  /** Replace local cart state with a Shopify cart payload (e.g. after discount apply). */
  setCartSnapshot: (cart: ShopifyCart | null) => Promise<void>;
  getQuantity: (productId: string) => number;
};

const CartContext = createContext<CartContextValue | null>(null);
const CartQuantityContext = createContext<{
  store: ReturnType<typeof createCartQuantityStore>;
  updateQuantity: CartContextValue['updateQuantity'];
} | null>(null);

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
  const [quantityStore] = useState(createCartQuantityStore);

  // Optimistic quantity overrides: productId → desired qty (shown instantly)
  const [optimisticQuantities, setOptimisticQuantities] = useState<Record<string, number>>({});
  // Lines hidden optimistically while their remove API call is still in flight
  const [removingProductIds, setRemovingProductIds] = useState<string[]>([]);
  // Refs for debounced API calls (avoid stale closures in timers)
  const cartRef = useRef<ShopifyCart | null>(null);
  const pendingUpdatesRef = useRef<Record<string, number>>({});
  const quantityVersionsRef = useRef<Record<string, number>>({});
  const optimisticQtyRef = useRef<Record<string, number>>({});
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
    return (cart?.lines ?? []).flatMap((item) => {
      if (removingProductIds.includes(item.product.id)) return [];
      const optimisticQty = optimisticQuantities[item.product.id];
      const quantity = optimisticQty ?? item.quantity;
      if (quantity <= 0) return [];
      if (quantity === item.quantity) return [item];
      const unit = item.cost.amountPerQuantity;
      return [{
        ...item,
        quantity,
        cost: {
          ...item.cost,
          totalAmount: Math.round(unit * quantity * 100) / 100,
        },
      }];
    });
  }, [cart?.lines, optimisticQuantities, removingProductIds]);

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const subtotal = useMemo(() => {
    const lines = cart?.lines ?? [];
    let value = cart?.cost.subtotalAmount ?? lines.reduce((sum, line) => sum + line.cost.totalAmount, 0);
    for (const line of lines) {
      const removed = removingProductIds.includes(line.product.id);
      const quantity = removed ? 0 : (optimisticQuantities[line.product.id] ?? line.quantity);
      if (quantity === line.quantity) continue;
      if (quantity <= 0) value -= line.cost.totalAmount;
      else value += line.cost.amountPerQuantity * (quantity - line.quantity);
    }
    return Math.max(0, Math.round(value * 100) / 100);
  }, [cart, optimisticQuantities, removingProductIds]);
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

      setOptimisticQuantities((prev) => {
        const inCart = cartRef.current?.lines.find((line) => line.product.id === product.id)?.quantity ?? 0;
        const base = product.id in prev ? prev[product.id] : inCart;
        return { ...prev, [product.id]: base + qty };
      });

      try {
        const nextCart = await runCartMutation(async () => {
          const currentCart = cartRef.current;
          const cart = currentCart?.id
            ? await addCartLines(currentCart.id, [{ merchandiseId: product.variantId, quantity: qty }])
            : await createCart(
                [{ merchandiseId: product.variantId, quantity: qty }],
                buildMobileAppCartOptions(),
              );
          if (cart) cartRef.current = cart;
          return cart;
        });

        setOptimisticQuantities((prev) => {
          const serverQty = nextCart?.lines.find((line) => line.product.id === product.id)?.quantity;
          if (serverQty != null && prev[product.id] != null && prev[product.id] > serverQty) return prev;
          const next = { ...prev };
          delete next[product.id];
          return next;
        });
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
    (productId: string, quantity: number, product?: CartQuantityProduct): Promise<void> => {
      const nextQty = Math.max(0, quantity);
      const version = (quantityVersionsRef.current[productId] ?? 0) + 1;
      quantityVersionsRef.current[productId] = version;
      optimisticQtyRef.current = { ...optimisticQtyRef.current, [productId]: nextQty };
      // Show new quantity instantly
      setOptimisticQuantities((prev) => ({ ...prev, [productId]: nextQty }));

      pendingUpdatesRef.current[productId] = nextQty;

      // Debounce: wait 350ms after the last press before hitting the API
      if (updateTimersRef.current[productId]) {
        clearTimeout(updateTimersRef.current[productId]);
      }

      updateTimersRef.current[productId] = setTimeout(() => {
        delete updateTimersRef.current[productId];
        const targetQty = pendingUpdatesRef.current[productId];
        delete pendingUpdatesRef.current[productId];
        if (targetQty === undefined) return;

        const releaseOptimistic = () =>
          setOptimisticQuantities((prev) => {
            if (quantityVersionsRef.current[productId] !== version) return prev;
            if (pendingUpdatesRef.current[productId] != null) return prev;
            if (prev[productId] != null && prev[productId] !== targetQty) return prev;
            const next = { ...prev };
            delete next[productId];
            const refNext = { ...optimisticQtyRef.current };
            delete refNext[productId];
            optimisticQtyRef.current = refNext;
            return next;
          });

        void enqueueCartMutation(async () => {
          // A slow request may leave several edits queued. Send only the newest
          // intent instead of making the user wait for obsolete quantities.
          if (quantityVersionsRef.current[productId] !== version) return;
          const applyUpdate = async () => {
            const currentCart = cartRef.current;
            const currentItems = currentCart?.lines ?? [];
            const line = currentItems.find((item) => item.product.id === productId) ?? null;

            if (targetQty <= 0) {
              if (!currentCart?.id || !line) return null;
              return removeCartLines(currentCart.id, [line.id]);
            }

            if (!line && product?.id === productId && product.availableForSale && product.variantId) {
              const lines = [{ merchandiseId: product.variantId, quantity: targetQty }];
              return currentCart?.id
                ? addCartLines(currentCart.id, lines)
                : createCart(lines, buildMobileAppCartOptions());
            }
            if (!currentCart?.id || !line) return null;
            return updateCartLines(currentCart.id, [{ id: line.id, quantity: targetQty }]);
          };

          try {
            let nextCart = await applyUpdate();
            if (!nextCart) {
              releaseOptimistic();
              return;
            }

            cartRef.current = nextCart;
            await syncCart(nextCart);
            releaseOptimistic();
          } catch (error: unknown) {
            if (isCartConflictError(error) && cartRef.current?.id) {
              try {
                const refreshedCart = await fetchCart(cartRef.current.id);
                if (refreshedCart) {
                  cartRef.current = refreshedCart;
                  setCart(refreshedCart);
                }
                await delay(180);
                if (quantityVersionsRef.current[productId] !== version) return;
                const nextCart = await applyUpdate();
                if (nextCart) {
                  cartRef.current = nextCart;
                  await syncCart(nextCart);
                  releaseOptimistic();
                  return;
                }
              } catch {
                // fall through to error toast below
              }
            }

            releaseOptimistic();
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

  const adjustQuantity = useCallback(
    (productId: string, delta: number) => {
      const inCart = cartRef.current?.lines.find((line) => line.product.id === productId)?.quantity ?? 0;
      const base = productId in optimisticQtyRef.current ? optimisticQtyRef.current[productId] : inCart;
      void updateQuantity(productId, base + delta);
    },
    [updateQuantity],
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
      adjustQuantity,
      clearCart,
      refreshCart,
      setCartSnapshot,
      getQuantity,
    }),
    [
      addItem,
      adjustQuantity,
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

  const quantityContext = useMemo(() => ({ store: quantityStore, updateQuantity }), [quantityStore, updateQuantity]);
  useLayoutEffect(() => {
    const quantities: Record<string, number> = {};
    for (const item of items) quantities[item.product.id] = item.quantity;
    Object.assign(quantities, optimisticQuantities);
    for (const id of removingProductIds) quantities[id] = 0;
    quantityStore.publish(quantities, isBootstrapping);
  }, [quantityStore, items, optimisticQuantities, removingProductIds, isBootstrapping]);

  return <CartContext.Provider value={value}>
    <CartQuantityContext.Provider value={quantityContext}>{children}</CartQuantityContext.Provider>
  </CartContext.Provider>;
}

export function useProductCartQuantity(productId: string) {
  const context = useContext(CartQuantityContext);
  if (!context) throw new Error('useProductCartQuantity must be used within CartProvider');
  const { store, updateQuantity } = context;
  const subscribe = useCallback((listener: () => void) => store.subscribe(productId, listener), [store, productId]);
  const read = useCallback(() => store.read(productId), [store, productId]);
  const snapshot = useSyncExternalStore(subscribe, read, read);
  return { ...snapshot, updateQuantity };
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
