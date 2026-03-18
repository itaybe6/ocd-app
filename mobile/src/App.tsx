import React, { useEffect } from 'react';
import { I18nManager, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { AuthProvider } from './state/AuthContext';
import { LoadingProvider, useLoading } from './state/LoadingContext';
import { RootNavigator } from './navigation/RootNavigator';
import { LoadingOverlay } from './components/LoadingOverlay';
import { colors } from './theme/colors';

function AppInner() {
  const { isLoading } = useLoading();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <RootNavigator />
      <LoadingOverlay visible={isLoading} />
      <Toast />
    </View>
  );
}

export default function App() {
  useEffect(() => {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <LoadingProvider>
            <AppInner />
          </LoadingProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

