import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme, type Theme, useFocusEffect } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { Screen } from '../components/Screen';
import { useAuth, type AuthUser } from '../state/AuthContext';
import { useCart } from '../state/CartContext';
import { StoreCategoryScreen, StoreHomeScreen, type StoreBottomTabId } from '../screens/store/StoreHomeScreen';
import { StoreSearchScreen } from '../screens/store/StoreSearchScreen';
import { StoreCartScreen } from '../screens/store/StoreCartScreen';
import { CheckoutScreen } from '../screens/store/CheckoutScreen';
import { OrderSuccessScreen } from '../screens/store/OrderSuccessScreen';
import { StoreFavoritesScreen } from '../screens/store/StoreFavoritesScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ProductScreen } from '../screens/store/ProductScreen';
import { StoreOcdPlusScreen } from '../screens/store/StoreOcdPlusScreen';
import { OcdPlusMark } from '../components/OcdPlusMark';
import { OcdPlusSubscribeSheetProvider } from '../context/OcdPlusSubscribeSheetContext';
import { placeCustomerOrder } from '../lib/orders';
import { applyOcdPlusMemberCheckout, prepareMemberCart } from '../services/shopify';
import { useOcdPlusMembership } from '../state/useOcdPlusMembership';
import { flushPendingNavigation, navigationRef } from './navigationRef';
import type { CustomerDrawerParamList } from './CustomerDrawer';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function handleStoreTabNavigation(
  navigation: Pick<NativeStackScreenProps<RootStackParamList>['navigation'], 'navigate'>,
  tabId: StoreBottomTabId,
  user: AuthUser | null
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
    if (!user) {
      navigation.navigate('Login');
      return;
    }
    if (user.role === 'customer') {
      navigation.navigate('Main', { initialCustomerProfile: true });
      return;
    }
    navigation.navigate('Main');
    return;
  }

  if (tabId === 'ocdPlus') {
    navigation.navigate('StoreOcdPlus');
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
  const customerInitialDrawer: keyof CustomerDrawerParamList =
    user?.role === 'customer' && route.params?.initialCustomerOcdPlus === true
      ? 'OcdPlus'
      : user?.role === 'customer' && route.params?.initialCustomerProfile === true
        ? 'Profile'
        : 'Store';

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
        initialTab={route.params?.initialTab}
        initialTabRequestId={route.params?.initialTabRequestId}
      />
    );
  }

  if (user.role === 'admin') return <AdminEntryScreen />;
  if (user.role === 'worker') return <WorkerEntryScreen />;
  return (
    <CustomerEntryScreen
      key={
        route.params?.initialCustomerOcdPlus === true
          ? `customer-ocdplus:${user.id}`
          : route.params?.initialCustomerProfile === true
            ? `customer-profile:${user.id}`
            : `customer:${user.id}`
      }
      initialDrawerRoute={customerInitialDrawer}
    />
  );
}

function StoreOcdPlusRoute(props: NativeStackScreenProps<RootStackParamList, 'StoreOcdPlus'>) {
  const { user } = useAuth();
  return (
    <StoreOcdPlusScreen
      {...props}
      onBottomTabPress={(tabId) => handleStoreTabNavigation(props.navigation, tabId, user)}
    />
  );
}

function StoreFavoritesRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'StoreFavorites'>) {
  const { user } = useAuth();
  return (
    <StoreFavoritesScreen
      onOpenProduct={(handle) => navigation.navigate('Product', { handle })}
      onLoginPress={() => navigation.navigate('Login')}
      onTabPress={(tabId) => handleStoreTabNavigation(navigation, tabId, user)}
    />
  );
}

function StoreSearchRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'StoreSearch'>) {
  const { user } = useAuth();
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
        handleStoreTabNavigation(navigation, tabId, user);
      }}
    />
  );
}

function LoginRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'Login'>) {
  const { user } = useAuth();
  return (
    <LoginScreen
      onGoToRegister={() => navigation.navigate('Register')}
      onTabPress={(tabId) => handleStoreTabNavigation(navigation, tabId, user)}
    />
  );
}

function RegisterRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'Register'>) {
  const { user } = useAuth();
  return (
    <RegisterScreen
      onGoToLogin={() => navigation.navigate('Login')}
      onTabPress={(tabId) => handleStoreTabNavigation(navigation, tabId, user)}
    />
  );
}

function StoreCategoryRoute({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'StoreCategory'>) {
  const { user } = useAuth();
  const { isActiveMember } = useOcdPlusMembership();
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
      onTabPress={(tabId) => handleStoreTabNavigation(navigation, tabId, user)}
      isOcdPlusSubscriber={isActiveMember}
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
  const { isActiveMember } = useOcdPlusMembership();
  const { cartId, itemCount, isMutating, setCartSnapshot } = useCart();
  const itemCountRef = useRef(itemCount);
  const isMutatingRef = useRef(isMutating);

  useEffect(() => {
    itemCountRef.current = itemCount;
  }, [itemCount]);

  useEffect(() => {
    isMutatingRef.current = isMutating;
  }, [isMutating]);

  const syncMemberDiscount = useCallback(() => {
    if (!isActiveMember || !cartId || itemCountRef.current === 0 || isMutatingRef.current) return;
    void prepareMemberCart({ cartId }).then((cart) => {
      if (cart) void setCartSnapshot(cart);
    });
  }, [cartId, isActiveMember, setCartSnapshot]);

  // Apply member discount once when opening the cart — not on every quantity change.
  useFocusEffect(
    useCallback(() => {
      syncMemberDiscount();
    }, [syncMemberDiscount]),
  );

  const handleOpenCheckout = useCallback(
    async (checkoutUrl: string) => {
      let url = checkoutUrl;
      if (isActiveMember && cartId) {
        url = await applyOcdPlusMemberCheckout({
          cartId,
          fallbackCheckoutUrl: checkoutUrl,
        });
      }
      navigation.navigate('StoreCheckout', { checkoutUrl: url });
    },
    [cartId, isActiveMember, navigation],
  );

  return <StoreCartScreen onBack={() => navigation.goBack()} onOpenCheckout={handleOpenCheckout} />;
}

function StoreCheckoutRoute({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'StoreCheckout'>) {
  const { user } = useAuth();
  const { items, subtotal } = useCart();

  return (
    <CheckoutScreen
      checkoutUrl={route.params.checkoutUrl}
      onBack={() => navigation.goBack()}
      onCheckoutComplete={async (info) => {
        let appOrderNumber = info?.orderNumber;

        // Shopify checkout is external to the app. Mirror the successful
        // purchase into the app's customer order history for logged-in users.
        if (user?.role === 'customer' && items.length > 0) {
          try {
            const order = await placeCustomerOrder({
              userId: user.id,
              items,
              subtotal,
              shopifyOrderNumber: info?.orderNumber,
            });
            appOrderNumber = info?.orderNumber ?? String(order.order_number);
          } catch {
            // The Shopify payment succeeded; still show the success screen.
            // The checkout order number remains available as a fallback.
          }
        }

        navigation.replace('OrderSuccess', { orderNumber: appOrderNumber });
      }}
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
      <OcdPlusSubscribeSheetProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainEntryScreen} />
        {!user && (
          <>
            <Stack.Screen name="Login" component={LoginRoute} />
            <Stack.Screen name="Register" component={RegisterRoute} />
          </>
        )}
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
            animation: 'none',
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
      </OcdPlusSubscribeSheetProvider>
    </NavigationContainer>
  );
}
