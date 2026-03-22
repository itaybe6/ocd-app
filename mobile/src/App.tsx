import React from 'react';
import { View } from 'react-native';
import Toast from 'react-native-toast-message';
import { RootNavigator } from './navigation/RootNavigator';
import { AuthProvider } from './state/AuthContext';
import { CartProvider } from './state/CartContext';
import { LoadingOverlay } from './components/LoadingOverlay';
import { LoadingProvider, useLoading } from './state/LoadingContext';

function AppShell() {
  const { isLoading } = useLoading();
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
    <LoadingProvider>
      <AuthProvider>
        <CartProvider>
          <AppShell />
        </CartProvider>
      </AuthProvider>
    </LoadingProvider>
  );
}

