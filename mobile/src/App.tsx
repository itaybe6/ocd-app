import React, { useEffect } from 'react';
import { View } from 'react-native';
import Toast from 'react-native-toast-message';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './navigation/RootNavigator';
<<<<<<< HEAD
import { AuthProvider } from './state/AuthContext';
import { CartProvider } from './state/CartContext';
=======
import { AuthProvider, useAuth } from './state/AuthContext';
>>>>>>> af24cf11d3ac0d893e2219d348190785a26f113d
import { LoadingOverlay } from './components/LoadingOverlay';
import { LoadingProvider, useLoading } from './state/LoadingContext';
import { registerForPushNotifications } from './lib/pushNotifications';
import { safeNavigate } from './navigation/navigationRef';

function AppShell() {
  const { isLoading } = useLoading();
  const { user } = useAuth();

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
      <Toast />
    </View>
  );
}

export default function App() {
  return (
<<<<<<< HEAD
    <LoadingProvider>
      <AuthProvider>
        <CartProvider>
          <AppShell />
        </CartProvider>
      </AuthProvider>
    </LoadingProvider>
=======
    <SafeAreaProvider>
      <LoadingProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </LoadingProvider>
    </SafeAreaProvider>
>>>>>>> af24cf11d3ac0d893e2219d348190785a26f113d
  );
}

