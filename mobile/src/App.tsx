import React, { useEffect } from 'react';
import { Image, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootNavigator } from './navigation/RootNavigator';
import { AuthProvider, useAuth } from './state/AuthContext';
import { CartProvider } from './state/CartContext';
import { FavoritesProvider } from './state/FavoritesContext';
import { LoadingOverlay } from './components/LoadingOverlay';
import { ToastProvider } from './components/toast/Toast';
import { LoadingProvider, useLoading } from './state/LoadingContext';
import { registerForPushNotifications } from './lib/pushNotifications';
import { safeNavigate } from './navigation/navigationRef';
import { STORE_CATALOG_KEY, STORE_CATALOG_PREVIEW_KEY, storeCatalogOptions } from './lib/storeCatalog';
import { type ShopifyProduct } from './lib/shopify';

const queryClient = new QueryClient();

function AppShell() {
  const { isLoading } = useLoading();
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;
    let imagesStarted = false;
    const warmImages = () => {
      if (imagesStarted) return;
      const products = queryClient.getQueryData<ShopifyProduct[]>(STORE_CATALOG_KEY)
        ?? queryClient.getQueryData<ShopifyProduct[]>(STORE_CATALOG_PREVIEW_KEY);
      if (!products?.length) return;
      imagesStarted = true;
      const urls = [...new Set(products.slice(0, 6).map(product => product.imageUrl).filter((url): url is string => !!url))];
      // Only the first visible cards, with two downloads at a time.
      const worker = async () => {
        while (!cancelled && urls.length) {
          const url = urls.shift()!;
          try { await Image.prefetch(url); } catch { /* Rendering can retry a failed image. */ }
        }
      };
      void Promise.all([worker(), worker()]);
    };
    const unsubscribe = queryClient.getQueryCache().subscribe(warmImages);
    warmImages();
    // Start after mounting; never block the app or show the global loading overlay.
    const timer = setTimeout(() => { void queryClient.prefetchQuery(storeCatalogOptions(queryClient)); }, 250);
    return () => { cancelled = true; clearTimeout(timer); unsubscribe(); };
  }, []);

  useEffect(() => {
    registerForPushNotifications({ userId: user?.id ?? null, role: user?.role ?? null }).catch(() => {});
  }, [user?.id, user?.role]);

  useEffect(() => {
    const navigateFromResponse = (response: Notifications.NotificationResponse | null | undefined) => {
      const data = (response?.notification?.request?.content?.data ?? {}) as any;
      const handle = data?.productHandle ?? data?.handle ?? null;
      if (typeof handle === 'string' && handle.trim()) {
        safeNavigate('Product', { handle: handle.trim() });
      }
    };

    Notifications.getLastNotificationResponseAsync()
      .then((resp) => navigateFromResponse(resp))
      .catch(() => {});

    const sub = Notifications.addNotificationResponseReceivedListener((resp) => navigateFromResponse(resp));
    return () => sub.remove();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <RootNavigator />
      <LoadingOverlay visible={isLoading} />
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ToastProvider>
          <QueryClientProvider client={queryClient}>
            <LoadingProvider>
              <AuthProvider>
                <FavoritesProvider>
                  <CartProvider>
                    <AppShell />
                  </CartProvider>
                </FavoritesProvider>
              </AuthProvider>
            </LoadingProvider>
          </QueryClientProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
