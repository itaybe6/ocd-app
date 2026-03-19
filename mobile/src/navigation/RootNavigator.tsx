import React, { useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme, type Theme } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { Screen } from '../components/Screen';
import { useAuth } from '../state/AuthContext';
import { StoreHomeScreen } from '../screens/store/StoreHomeScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { ProductScreen } from '../screens/store/ProductScreen';
import { flushPendingNavigation, navigationRef } from './navigationRef';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function AdminEntryScreen() {
  const AdminDrawer = require('./AdminDrawer').AdminDrawer as React.ComponentType;
  return <AdminDrawer />;
}

function WorkerEntryScreen() {
  const WorkerDrawer = require('./WorkerDrawer').WorkerDrawer as React.ComponentType;
  return <WorkerDrawer />;
}

function CustomerEntryScreen() {
  const CustomerDrawer = require('./CustomerDrawer').CustomerDrawer as React.ComponentType;
  return <CustomerDrawer />;
}

function MainEntryScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Main'>) {
  const { user } = useAuth();

  if (!user) {
    return (
      <StoreHomeScreen
        onAdminPress={() => navigation.navigate('Login')}
        onProductPress={(handle) => navigation.navigate('Product', { handle })}
      />
    );
  }

  if (user.role === 'admin') return <AdminEntryScreen />;
  if (user.role === 'worker') return <WorkerEntryScreen />;
  return <CustomerEntryScreen />;
}

function LoginRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'Login'>) {
  return <LoginScreen onBackToStore={() => navigation.navigate('Main')} />;
}

export function RootNavigator() {
  const { user, isBootstrapping } = useAuth();

  const navTheme = useMemo<Theme>(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: colors.bg,
        card: colors.card,
        border: colors.border,
        text: colors.text,
        primary: colors.primary,
      },
    }),
    []
  );

  if (isBootstrapping) {
    return (
      <Screen padded={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <NavigationContainer
      theme={navTheme}
      ref={navigationRef}
      onReady={() => flushPendingNavigation()}
    >
      <Stack.Navigator
        key={user ? `role:${user.role}` : 'anon'}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Main" component={MainEntryScreen} />
        <Stack.Screen name="Login" component={LoginRoute} />
        <Stack.Screen
          name="Product"
          component={ProductScreen}
          options={{
            headerShown: true,
            headerTitle: 'מוצר',
            headerTitleStyle: { fontWeight: '900' },
            headerTintColor: colors.text,
            headerStyle: { backgroundColor: colors.card },
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

