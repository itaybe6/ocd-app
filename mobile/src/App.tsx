import React from 'react';
import Toast from 'react-native-toast-message';
import { RootNavigator } from './navigation/RootNavigator';
import { AuthProvider } from './state/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
      <Toast />
    </AuthProvider>
  );
}

