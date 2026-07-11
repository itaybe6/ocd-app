import React, { useMemo } from 'react';
import { Text, View, Pressable } from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItem,
  type DrawerContentComponentProps,
  type DrawerScreenProps,
} from '@react-navigation/drawer';
import { Heart, Receipt, ShoppingBag, User, Wrench } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../state/AuthContext';
import { useOcdPlusMembership } from '../state/useOcdPlusMembership';
import { CustomerProfileScreen } from '../screens/customer/ProfileScreen';
import { CustomerServicesScreen } from '../screens/customer/ServicesScreen';
import { CustomerFavoritesScreen } from '../screens/customer/FavoritesScreen';
import { CustomerOrdersScreen } from '../screens/customer/OrdersScreen';
import { CustomerOrderDetailScreen } from '../screens/customer/OrderDetailScreen';
import { CustomerAddressesScreen } from '../screens/customer/AddressesScreen';
import { CustomerOcdPlusScreen } from '../screens/customer/OcdPlusScreen';
import { safeNavigate } from './navigationRef';
import { StoreHomeScreen, type StoreBottomTabId, type StoreMainTabId } from '../screens/store/StoreHomeScreen';

export type CustomerDrawerParamList = {
  Store:
    | {
        initialTab?: StoreMainTabId;
        initialTabRequestId?: number;
      }
    | undefined;
  Profile: undefined;
  Orders: undefined;
  OrderDetail: { orderId: string; returnTo: 'Profile' | 'Orders' };
  Addresses: undefined;
  OcdPlus: undefined;
  Services: undefined;
  Favorites: undefined;
};

const Drawer = createDrawerNavigator<CustomerDrawerParamList>();

type CustomerDrawerProps = {
  initialRouteName?: keyof CustomerDrawerParamList;
};

function handleCustomerTabPress(
  navigation: DrawerScreenProps<CustomerDrawerParamList, 'Store'>['navigation'],
  tabId: StoreBottomTabId
) {
  if (tabId === 'home') {
    navigation.navigate('Store', { initialTab: 'home', initialTabRequestId: Date.now() });
    return;
  }

  if (tabId === 'ocdPlus') {
    safeNavigate('StoreOcdPlus');
    return;
  }

  if (tabId === 'search') {
    safeNavigate('StoreSearch');
    return;
  }

  if (tabId === 'favorites') {
    navigation.navigate('Favorites');
    return;
  }

  if (tabId === 'profile') {
    navigation.navigate('Profile');
    return;
  }
}

function CustomerStoreScreen({ navigation, route }: DrawerScreenProps<CustomerDrawerParamList, 'Store'>) {
  const { isActiveMember } = useOcdPlusMembership();

  return (
    <StoreHomeScreen
      onProfilePress={() => navigation.navigate('Profile')}
      onFavoritesPress={() => navigation.navigate('Favorites')}
      isOcdPlusSubscriber={isActiveMember}
      onSearchPress={() => safeNavigate('StoreSearch')}
      onProductPress={(handle) => safeNavigate('Product', { handle })}
      onOpenCart={() => safeNavigate('StoreCart')}
      onOpenProduct={(product) => safeNavigate('Product', { handle: product.handle })}
      onOpenCategory={(category) =>
        safeNavigate('StoreCategory', {
          categoryId: category.id,
          categoryTitle: category.title,
          categoryDescription: category.description,
          parentTitle: category.parentTitle,
          subcategories: category.subcategories,
        })
      }
      initialTab={route.params?.initialTab}
      initialTabRequestId={route.params?.initialTabRequestId}
    />
  );
}

function CustomerProfileRoute({ navigation }: DrawerScreenProps<CustomerDrawerParamList, 'Profile'>) {
  return (
    <CustomerProfileScreen
      onOpenOrders={() => navigation.navigate('Orders')}
      onOpenOrder={(orderId) => navigation.navigate('OrderDetail', { orderId, returnTo: 'Profile' })}
      onOpenAddresses={() => navigation.navigate('Addresses')}
      onOpenOcdPlus={() => navigation.navigate('OcdPlus')}
      onTabPress={(tabId) => handleCustomerTabPress(navigation as any, tabId)}
    />
  );
}

function CustomerOcdPlusRoute({ navigation }: DrawerScreenProps<CustomerDrawerParamList, 'OcdPlus'>) {
  return (
    <CustomerOcdPlusScreen
      onBack={() => navigation.navigate('Profile')}
      onTabPress={(tabId) => handleCustomerTabPress(navigation as any, tabId)}
    />
  );
}

function CustomerOrdersRoute({ navigation }: DrawerScreenProps<CustomerDrawerParamList, 'Orders'>) {
  return (
    <CustomerOrdersScreen
      onBack={() => navigation.navigate('Profile')}
      onOpenOrder={(orderId) => navigation.navigate('OrderDetail', { orderId, returnTo: 'Orders' })}
      onTabPress={(tabId) => handleCustomerTabPress(navigation as any, tabId)}
    />
  );
}

function CustomerOrderDetailRoute({
  navigation,
  route,
}: DrawerScreenProps<CustomerDrawerParamList, 'OrderDetail'>) {
  return (
    <CustomerOrderDetailScreen
      orderId={route.params.orderId}
      onBack={() => navigation.navigate(route.params.returnTo)}
      onTabPress={(tabId) => handleCustomerTabPress(navigation as any, tabId)}
    />
  );
}

function CustomerAddressesRoute({ navigation }: DrawerScreenProps<CustomerDrawerParamList, 'Addresses'>) {
  return (
    <CustomerAddressesScreen
      onBack={() => navigation.navigate('Profile')}
      onTabPress={(tabId) => handleCustomerTabPress(navigation as any, tabId)}
    />
  );
}

function CustomerFavoritesRoute({ navigation }: DrawerScreenProps<CustomerDrawerParamList, 'Favorites'>) {
  return (
    <CustomerFavoritesScreen onTabPress={(tabId) => handleCustomerTabPress(navigation as any, tabId)} />
  );
}

function CustomerDrawerContent(props: DrawerContentComponentProps) {
  const { signOut } = useAuth();
  const items = useMemo(
    () => [
      { key: 'Store' as const, label: 'חנות', icon: <ShoppingBag size={18} color={colors.text} /> },
      { key: 'Profile' as const, label: 'פרופיל', icon: <User size={18} color={colors.text} /> },
      { key: 'Orders' as const, label: 'רכישות', icon: <Receipt size={18} color={colors.text} /> },
      { key: 'Favorites' as const, label: 'אהבתי', icon: <Heart size={18} color={colors.text} /> },
      { key: 'Services' as const, label: 'שירותים', icon: <Wrench size={18} color={colors.text} /> },
    ],
    []
  );

  return (
    <DrawerContentScrollView {...props} style={{ backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 14, paddingTop: 10 }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>Customer</Text>
        <Text style={{ color: colors.muted, marginTop: 2, textAlign: 'right' }}>מערכת לקוח</Text>
      </View>
      <View style={{ paddingHorizontal: 8 }}>
        {items.map((it) => (
          <DrawerItem
            key={it.key}
            label={it.label}
            icon={() => it.icon}
            onPress={() => props.navigation.navigate(it.key as any)}
            labelStyle={{ color: colors.text, textAlign: 'right', fontWeight: '700' }}
            style={{ borderRadius: 14, marginHorizontal: 4 }}
          />
        ))}
      </View>
      <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
        <Pressable
          onPress={() => signOut()}
          style={{ borderRadius: 16, paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated }}
        >
          <Text style={{ color: colors.text, fontWeight: '800', textAlign: 'right' }}>התנתקות</Text>
        </Pressable>
      </View>
    </DrawerContentScrollView>
  );
}

export function CustomerDrawer({ initialRouteName = 'Store' }: CustomerDrawerProps) {
  return (
    <Drawer.Navigator
      initialRouteName={initialRouteName}
      drawerContent={(p) => <CustomerDrawerContent {...p} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '900' },
        sceneStyle: { backgroundColor: colors.bg },
        drawerPosition: 'right',
        drawerType: 'front',
        // The customer area uses the in-app bottom navigation; keep the side
        // drawer locked so it cannot appear from an accidental edge swipe.
        swipeEnabled: false,
      }}
    >
      <Drawer.Screen name="Store" options={{ title: 'חנות', headerShown: false }} component={CustomerStoreScreen} />
      <Drawer.Screen name="Profile" options={{ title: 'פרופיל', headerShown: false }} component={CustomerProfileRoute} />
      <Drawer.Screen name="Orders" options={{ title: 'רכישות', headerShown: false }} component={CustomerOrdersRoute} />
      <Drawer.Screen
        name="OrderDetail"
        options={{ title: 'פרטי הזמנה', headerShown: false }}
        component={CustomerOrderDetailRoute}
      />
      <Drawer.Screen name="Addresses" options={{ title: 'כתובות', headerShown: false }} component={CustomerAddressesRoute} />
      <Drawer.Screen name="OcdPlus" options={{ title: 'מנוי OCD+', headerShown: false }} component={CustomerOcdPlusRoute} />
      <Drawer.Screen name="Favorites" options={{ title: 'אהבתי', headerShown: false }} component={CustomerFavoritesRoute} />
      <Drawer.Screen name="Services" options={{ title: 'שירותים' }} component={CustomerServicesScreen} />
    </Drawer.Navigator>
  );
}

