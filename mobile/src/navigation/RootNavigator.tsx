import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme, type Theme } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { Screen } from '../components/Screen';
import { useAuth } from '../state/AuthContext';
import { StoreCategoryScreen, StoreHomeScreen, type StoreBottomTabId } from '../screens/store/StoreHomeScreen';
import { StoreSearchScreen } from '../screens/store/StoreSearchScreen';
import { StoreCartScreen } from '../screens/store/StoreCartScreen';
import { CheckoutScreen } from '../screens/store/CheckoutScreen';
import { OrderSuccessScreen } from '../screens/store/OrderSuccessScreen';
import { StoreFavoritesScreen } from '../screens/store/StoreFavoritesScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { ProductScreen } from '../screens/store/ProductScreen';
import { StoreOcdPlusScreen } from '../screens/store/StoreOcdPlusScreen';
import { OcdPlusMark } from '../components/OcdPlusMark';
import { flushPendingNavigation, navigationRef } from './navigationRef';
import type { CustomerDrawerParamList } from './CustomerDrawer';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function handleStoreTabNavigation(
  navigation: Pick<NativeStackScreenProps<RootStackParamList>['navigation'], 'navigate'>,
  tabId: StoreBottomTabId
) {
  if (tabId === 'favorites') {
    navigation.navigate('StoreFavorites');
    return;
  }

  if (tabId === 'search') {
    navigation.navigate('StoreSearch');
    return;
  }

  if (tabId === 'profile') {
    navigation.navigate('Login');
    return;
  }

  if (tabId === 'cart') {
    navigation.navigate('StoreCart');
    return;
  }

  navigation.navigate('Main', {
    initialTab: 'home',
    initialTabRequestId: Date.now(),
  });
}

function AdminEntryScreen() {
  const AdminDrawer = require('./AdminDrawer').AdminDrawer as React.ComponentType;
  return <AdminDrawer />;
}

function WorkerEntryScreen() {
  const WorkerDrawer = require('./WorkerDrawer').WorkerDrawer as React.ComponentType;
  return <WorkerDrawer />;
}

function CustomerEntryScreen({ initialDrawerRoute }: { initialDrawerRoute: keyof CustomerDrawerParamList }) {
  const CustomerDrawer = require('./CustomerDrawer').CustomerDrawer as React.ComponentType<{
    initialRouteName?: keyof CustomerDrawerParamList;
  }>;
  return <CustomerDrawer initialRouteName={initialDrawerRoute} />;
}

function MainEntryScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Main'>) {
  const { user } = useAuth();
  const customerInitialDrawer =
    user?.role === 'customer' && route.params?.initialCustomerProfile === true ? 'Profile' : 'Store';

  if (!user) {
    return (
      <StoreHomeScreen
        onProfilePress={() => navigation.navigate('Login')}
        onFavoritesPress={() => navigation.navigate('StoreFavorites')}
        onSearchPress={() => navigation.navigate('StoreSearch')}
        onProductPress={(handle) => navigation.navigate('Product', { handle })}
        onOpenCart={() => navigation.navigate('StoreCart')}
        onOpenProduct={(product) => navigation.navigate('Product', { handle: product.handle })}
        onOpenCategory={(category) =>
          navigation.navigate('StoreCategory', {
            categoryId: category.id,
            categoryTitle: category.title,
            categoryDescription: category.description,
            parentTitle: category.parentTitle,
            subcategories: category.subcategories,
          })
        }
        isOcdPlusSubscriber={false}
        onOcdPlusSubscribePress={() => navigation.navigate('StoreOcdPlus')}
        initialTab={route.params?.initialTab}
        initialTabRequestId={route.params?.initialTabRequestId}
      />
    );
  }

  if (user.role === 'admin') return <AdminEntryScreen />;
  if (user.role === 'worker') return <WorkerEntryScreen />;
  return (
    <CustomerEntryScreen
      key={route.params?.initialCustomerProfile === true ? `customer-profile:${user.id}` : `customer:${user.id}`}
      initialDrawerRoute={customerInitialDrawer}
    />
  );
}

function StoreOcdPlusRoute(props: NativeStackScreenProps<RootStackParamList, 'StoreOcdPlus'>) {
  return (
    <StoreOcdPlusScreen
      {...props}
      onBottomTabPress={(tabId) => handleStoreTabNavigation(props.navigation, tabId)}
    />
  );
}

function StoreFavoritesRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'StoreFavorites'>) {
  return (
    <StoreFavoritesScreen
      onOpenProduct={(handle) => navigation.navigate('Product', { handle })}
      onLoginPress={() => navigation.navigate('Login')}
      onTabPress={(tabId) => handleStoreTabNavigation(navigation, tabId)}
    />
  );
}

function StoreSearchRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'StoreSearch'>) {
  return (
    <StoreSearchScreen
      onBack={() => navigation.goBack()}
      onOpenCart={() => navigation.navigate('StoreCart')}
      onOpenProduct={(product) => navigation.navigate('Product', { handle: product.handle })}
      onOpenCategory={(category) =>
        navigation.navigate('StoreCategory', {
          categoryId: category.id,
          categoryTitle: category.title,
          categoryDescription: category.description,
          parentTitle: category.parentTitle,
          subcategories: category.subcategories,
        })
      }
      onTabPress={(tabId) => {
        if (tabId === 'home') {
          navigation.goBack();
          return;
        }
        handleStoreTabNavigation(navigation, tabId);
      }}
    />
  );
}

function LoginRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'Login'>) {
  return <LoginScreen onBackToStore={() => navigation.navigate('Main')} />;
}

function StoreCategoryRoute({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'StoreCategory'>) {
  const { user } = useAuth();
  const isOcdPlusSubscriber = user?.role === 'customer' && !!user.ocd_plus_subscriber;
  const params = route.params as RootStackParamList['StoreCategory'] & {
    id?: string;
    title?: string;
    description?: string;
  };
  const categoryId = params.categoryId ?? params.id ?? 'all';
  const categoryTitle = params.categoryTitle ?? params.title ?? 'קטגוריה';
  const categoryDescription = params.categoryDescription ?? params.description;

  return (
    <StoreCategoryScreen
      onBack={() => navigation.goBack()}
      onOpenProduct={(product) => navigation.navigate('Product', { handle: product.handle })}
      onOpenCategory={(category) =>
        navigation.navigate('StoreCategory', {
          categoryId: category.id,
          categoryTitle: category.title,
          categoryDescription: category.description,
          parentTitle: category.parentTitle,
          subcategories: category.subcategories,
        })
      }
      onTabPress={(tabId) => handleStoreTabNavigation(navigation, tabId)}
      isOcdPlusSubscriber={isOcdPlusSubscriber}
      onOcdPlusSubscribePress={() => navigation.navigate('StoreOcdPlus')}
      categoryId={categoryId}
      categoryTitle={categoryTitle}
      categoryDescription={categoryDescription}
      parentTitle={params.parentTitle}
      subcategories={params.subcategories}
    />
  );
}

function StoreProductRoute({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'StoreProduct'>) {
  useEffect(() => {
    navigation.replace('Product', { handle: route.params.product.handle });
  }, [navigation, route.params.product.handle]);

  return (
    <Screen padded={false}>
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    </Screen>
  );
}

function StoreCartRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'StoreCart'>) {
  return (
    <StoreCartScreen
      onBack={() => navigation.goBack()}
      onOpenCheckout={(checkoutUrl) => navigation.navigate('StoreCheckout', { checkoutUrl })}
    />
  );
}

function StoreCheckoutRoute({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'StoreCheckout'>) {
  return (
    <CheckoutScreen
      checkoutUrl={route.params.checkoutUrl}
      onBack={() => navigation.goBack()}
      onCheckoutComplete={() => navigation.replace('OrderSuccess')}
    />
  );
}

function OrderSuccessRoute(props: NativeStackScreenProps<RootStackParamList, 'OrderSuccess'>) {
  return <OrderSuccessScreen {...props} />;
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
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainEntryScreen} />
        {!user && <Stack.Screen name="Login" component={LoginRoute} />}
        <Stack.Screen
          name="StoreCategory"
          component={StoreCategoryRoute}
          options={{ contentStyle: { backgroundColor: '#FFFFFF' } }}
        />
        <Stack.Screen name="StoreProduct" component={StoreProductRoute} />
        <Stack.Screen
          name="StoreCart"
          component={StoreCartRoute}
          options={{
            contentStyle: { backgroundColor: '#FFFFFF' },
            scrollEdgeEffects: { top: 'hidden' },
          }}
        />
        <Stack.Screen
          name="StoreCheckout"
          component={StoreCheckoutRoute}
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="OrderSuccess"
          component={OrderSuccessRoute}
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="StoreOcdPlus"
          component={StoreOcdPlusRoute}
          options={{
            headerShown: true,
            headerTitle: () => (
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <OcdPlusMark size={30} />
              </View>
            ),
            headerTitleStyle: { fontWeight: '900' },
            headerTintColor: colors.text,
            headerStyle: { backgroundColor: colors.card },
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="StoreFavorites"
          component={StoreFavoritesRoute}
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="StoreSearch"
          component={StoreSearchRoute}
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen
          name="Product"
          component={ProductScreen}
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
