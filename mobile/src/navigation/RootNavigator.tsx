import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme, type Theme } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { Screen } from '../components/Screen';
import { useAuth } from '../state/AuthContext';
import {
  getStoreBottomBarMetrics,
  StoreCategoryScreen,
  StoreFloatingTabBar,
  StoreHomeScreen,
  StoreProductScreen,
  type StoreBottomTabId,
  type StoreProduct,
} from '../screens/store/StoreHomeScreen';
import { StoreCartScreen } from '../screens/store/StoreCartScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { ProductScreen } from '../screens/store/ProductScreen';
import { flushPendingNavigation, navigationRef } from './navigationRef';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function handleStoreTabNavigation(
  navigation: NativeStackNavigationProp<RootStackParamList>,
  tabId: StoreBottomTabId
) {
  if (tabId === 'ocdPlus') {
    navigation.navigate('StoreOcdPlus');
    return;
  }

  if (tabId === 'profile') {
    navigation.navigate('Login');
    return;
  }

  navigation.navigate('Main', {
    initialTab: tabId,
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

function CustomerEntryScreen() {
  const CustomerDrawer = require('./CustomerDrawer').CustomerDrawer as React.ComponentType;
  return <CustomerDrawer />;
}

function MainEntryScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Main'>) {
  const { user } = useAuth();

  if (!user) {
    return (
      <StoreHomeScreen
        onProfilePress={() => navigation.navigate('Login')}
        onOcdPlusPress={() => navigation.navigate('StoreOcdPlus')}
        onProductPress={(handle) => navigation.navigate('Product', { handle })}
        onOpenCart={() => navigation.navigate('StoreCart')}
        onOpenProduct={(product) => navigation.navigate('StoreProduct', { product })}
        onOpenCategory={(category) =>
          navigation.navigate('StoreCategory', {
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

  if (user.role === 'admin') return <AdminEntryScreen />;
  if (user.role === 'worker') return <WorkerEntryScreen />;
  return <CustomerEntryScreen />;
}

function StoreOcdPlusRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'StoreOcdPlus'>) {
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>
        <Screen padded={false}>
          <View
            className="flex-1 items-center justify-center px-6"
            style={{ paddingBottom: contentPaddingBottom }}
          >
            <Text style={{ fontSize: 34, fontWeight: '900', color: colors.text }}>OCD+</Text>
            <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '800', color: colors.text }}>העמוד הזה עדיין בפיתוח</Text>
            <Text style={{ marginTop: 8, fontSize: 14, color: colors.textMuted, textAlign: 'center' }}>
              כאן יופיעו בהמשך תכנים, הטבות או שירותים מיוחדים של OCD+.
            </Text>
          </View>
        </Screen>
        <StoreFloatingTabBar activeTab="ocdPlus" onTabPress={(tabId) => handleStoreTabNavigation(navigation, tabId)} />
      </View>
    </SafeAreaView>
  );
}

function LoginRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'Login'>) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  }, [navigation, user]);

  return <LoginScreen onBackToStore={() => navigation.navigate('Main')} />;
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
      categoryId={route.params.categoryId}
      categoryTitle={route.params.categoryTitle}
      categoryDescription={route.params.categoryDescription}
      parentTitle={route.params.parentTitle}
      subcategories={route.params.subcategories}
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
      onTabPress={(tabId) => handleStoreTabNavigation(navigation, tabId)}
      product={route.params.product}
    />
  );
}

function StoreCartRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'StoreCart'>) {
  return <StoreCartScreen onBack={() => navigation.goBack()} onTabPress={(tabId) => handleStoreTabNavigation(navigation, tabId)} />;
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
          name="StoreOcdPlus"
          component={StoreOcdPlusRoute}
          options={{
            headerShown: true,
            headerTitle: 'OCD+',
            headerTitleStyle: { fontWeight: '900' },
            headerTintColor: colors.text,
            headerStyle: { backgroundColor: colors.card },
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
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
        <Stack.Screen name="StoreCategory" component={StoreCategoryRoute} />
        <Stack.Screen name="StoreProduct" component={StoreProductRoute} />
        <Stack.Screen name="StoreCart" component={StoreCartRoute} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

