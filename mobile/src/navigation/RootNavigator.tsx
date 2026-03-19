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

type RootStackParamList = {
  Store: undefined;
  Login: undefined;
  Admin: undefined;
  Worker: undefined;
  Customer: undefined;
};

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

function PublicStoreScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Store'>) {
  return <StoreHomeScreen onAdminPress={() => navigation.navigate('Login')} />;
}

function LoginRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'Login'>) {
  return <LoginScreen onBackToStore={() => navigation.navigate('Store')} />;
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
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        key={user ? `role:${user.role}` : 'anon'}
        screenOptions={{ headerShown: false }}
      >
        {!user ? (
          <>
            <Stack.Screen name="Store" component={PublicStoreScreen} />
            <Stack.Screen name="Login" component={LoginRoute} />
          </>
        ) : user.role === 'admin' ? (
          <Stack.Screen name="Admin" component={AdminEntryScreen} />
        ) : user.role === 'worker' ? (
          <Stack.Screen name="Worker" component={WorkerEntryScreen} />
        ) : (
          <Stack.Screen name="Customer" component={CustomerEntryScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

