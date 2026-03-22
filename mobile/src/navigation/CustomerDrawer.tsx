import React, { useMemo } from 'react';
import { Text, View, Pressable } from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItem,
  type DrawerContentComponentProps,
  type DrawerScreenProps,
} from '@react-navigation/drawer';
import { Headset, Heart, Receipt, ShoppingBag, User, Wrench } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../state/AuthContext';
import { CustomerProfileScreen } from '../screens/customer/ProfileScreen';
import { CustomerServicesScreen } from '../screens/customer/ServicesScreen';
import { CustomerSupportScreen } from '../screens/customer/SupportScreen';
import { CustomerFavoritesScreen } from '../screens/customer/FavoritesScreen';
import { CustomerOrdersScreen } from '../screens/customer/OrdersScreen';
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
  Services: undefined;
  Support: undefined;
  Favorites: undefined;
};

const Drawer = createDrawerNavigator<CustomerDrawerParamList>();

function handleCustomerTabPress(
  navigation: DrawerScreenProps<CustomerDrawerParamList, 'Store'>['navigation'],
  tabId: StoreBottomTabId
) {
  if (tabId === 'home') {
    navigation.navigate('Store', { initialTab: 'home', initialTabRequestId: Date.now() });
    return;
  }

  if (tabId === 'categories') {
    navigation.navigate('Store', { initialTab: 'categories', initialTabRequestId: Date.now() });
    return;
  }

  if (tabId === 'search') {
    navigation.navigate('Store', { initialTab: 'search', initialTabRequestId: Date.now() });
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

  safeNavigate('StoreOcdPlus');
}

function CustomerStoreScreen({ navigation, route }: DrawerScreenProps<CustomerDrawerParamList, 'Store'>) {
  return (
    <StoreHomeScreen
      onProfilePress={() => navigation.navigate('Profile')}
      onFavoritesPress={() => navigation.navigate('Favorites')}
      onOcdPlusPress={() => safeNavigate('StoreOcdPlus')}
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
      onOpenFavorites={() => navigation.navigate('Favorites')}
      onOpenSupport={() => navigation.navigate('Support')}
      onOpenServices={() => navigation.navigate('Services')}
      onTabPress={(tabId) => handleCustomerTabPress(navigation as any, tabId)}
    />
  );
}

function CustomerOrdersRoute() {
  return <CustomerOrdersScreen />;
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
      { key: 'Support' as const, label: 'תמיכה טכנית', icon: <Headset size={18} color={colors.text} /> },
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

export function CustomerDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(p) => <CustomerDrawerContent {...p} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '900' },
        sceneStyle: { backgroundColor: colors.bg },
        drawerPosition: 'right',
        drawerType: 'front',
      }}
    >
      <Drawer.Screen name="Store" options={{ title: 'חנות', headerShown: false }} component={CustomerStoreScreen} />
      <Drawer.Screen name="Profile" options={{ title: 'פרופיל', headerShown: false }} component={CustomerProfileRoute} />
      <Drawer.Screen name="Orders" options={{ title: 'רכישות', headerShown: false }} component={CustomerOrdersRoute} />
      <Drawer.Screen name="Favorites" options={{ title: 'אהבתי' }} component={CustomerFavoritesScreen} />
      <Drawer.Screen name="Services" options={{ title: 'שירותים' }} component={CustomerServicesScreen} />
      <Drawer.Screen name="Support" options={{ title: 'תמיכה טכנית' }} component={CustomerSupportScreen} />
    </Drawer.Navigator>
  );
}

