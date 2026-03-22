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
import {
  StoreCategoryScreen,
  StoreHomeScreen,
  StoreProductScreen,
  type StoreProduct,
} from '../screens/store/StoreHomeScreen';
import { StoreCartScreen } from '../screens/store/StoreCartScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';

type RootStackParamList = {
  Store: undefined;
  StoreCategory: {
    categoryId: string;
    categoryTitle: string;
    categoryDescription?: string;
    parentTitle?: string;
  };
  StoreProduct: {
    product: StoreProduct;
  };
  StoreCart: undefined;
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
  return (
    <StoreHomeScreen
      onAdminPress={() => navigation.navigate('Login')}
      onOpenCart={() => navigation.navigate('StoreCart')}
      onOpenProduct={(product) => navigation.navigate('StoreProduct', { product })}
      onOpenCategory={(category) =>
        navigation.navigate('StoreCategory', {
          categoryId: category.id,
          categoryTitle: category.title,
          categoryDescription: category.description,
          parentTitle: category.parentTitle,
        })
      }
    />
  );
}

function LoginRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'Login'>) {
  return <LoginScreen onBackToStore={() => navigation.navigate('Store')} />;
}

function StoreCategoryRoute({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'StoreCategory'>) {
  return (
    <StoreCategoryScreen
      onBack={() => navigation.goBack()}
      onOpenCart={() => navigation.navigate('StoreCart')}
      onOpenProduct={(product) => navigation.navigate('StoreProduct', { product })}
      categoryId={route.params.categoryId}
      categoryTitle={route.params.categoryTitle}
      categoryDescription={route.params.categoryDescription}
      parentTitle={route.params.parentTitle}
    />
  );
}

function StoreProductRoute({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'StoreProduct'>) {
  return (
    <StoreProductScreen
      onBack={() => navigation.goBack()}
      onOpenCart={() => navigation.navigate('StoreCart')}
      product={route.params.product}
    />
  );
}

function StoreCartRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'StoreCart'>) {
  return <StoreCartScreen onBack={() => navigation.goBack()} />;
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
            <Stack.Screen name="StoreCategory" component={StoreCategoryRoute} />
            <Stack.Screen name="StoreProduct" component={StoreProductRoute} />
            <Stack.Screen name="StoreCart" component={StoreCartRoute} />
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

