import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { colors } from '../../theme/colors';
import { fetchProductByHandle, type ShopifyProduct } from '../../lib/shopify';
import type { RootStackParamList } from '../../navigation/types';
import {
  getStoreBottomBarMetrics,
  StoreFloatingTabBar,
  type StoreBottomTabId,
} from './StoreHomeScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'Product'>;

function formatPrice(price: number, currencyCode: string) {
  if (currencyCode === 'ILS') return `₪${price.toLocaleString('he-IL')}.00`;
  return `${price.toLocaleString('he-IL')} ${currencyCode}`;
}

export function ProductScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const handle = route.params.handle;
  const [reloadSeq, setReloadSeq] = useState(0);
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<ShopifyProduct | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBottomTabPress = (tabId: StoreBottomTabId) => {
    const mainParams =
      tabId === 'categories'
        ? { initialTab: 'categories' as const, initialTabRequestId: Date.now() }
        : tabId === 'search'
          ? { initialTab: 'search' as const, initialTabRequestId: Date.now() }
          : { initialTab: 'home' as const, initialTabRequestId: Date.now() };

    if (tabId === 'ocdPlus') {
      navigation.navigate('StoreOcdPlus');
      return;
    }

    if (tabId === 'profile') {
      navigation.navigate('Login');
      return;
    }

    navigation.navigate('Main', mainParams);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const p = await fetchProductByHandle(handle);
        if (!alive) return;
        setProduct(p);
        if (!p) setError('המוצר לא נמצא');
      } catch (e: any) {
        if (!alive) return;
        setProduct(null);
        setError(e?.message ?? 'שגיאה בטעינת המוצר');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [handle, reloadSeq]);

  const title = useMemo(() => product?.title ?? 'מוצר', [product?.title]);

  if (loading) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 12, color: colors.muted, fontWeight: '700' }}>טוען מוצר…</Text>
        </View>
      </Screen>
    );
  }

  if (!product) {
    return (
      <Screen>
        <Card>
          <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', fontSize: 18 }}>לא הצלחנו להציג את המוצר</Text>
          {!!error && <Text style={{ color: colors.muted, marginTop: 8, textAlign: 'right' }}>{error}</Text>}
          <Pressable
            onPress={() => {
              setReloadSeq((x) => x + 1);
            }}
            style={({ pressed }) => ({
              marginTop: 12,
              borderRadius: 14,
              paddingVertical: 12,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: pressed ? 'rgba(37, 99, 235, 0.08)' : colors.elevated,
            })}
          >
            <Text style={{ color: colors.primary, fontWeight: '900' }}>רענן</Text>
          </Pressable>
        </Card>
      </Screen>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, paddingBottom: contentPaddingBottom, gap: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {!!product.imageUrl && (
            <Image
              source={{ uri: product.imageUrl }}
              resizeMode="cover"
              accessibilityLabel={product.imageAltText ?? product.title}
              style={{ width: '100%', height: 280, borderRadius: 24, backgroundColor: 'rgba(15,23,42,0.05)' }}
            />
          )}

          <Card>
            <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', fontSize: 22 }}>{title}</Text>
            <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'right' }}>{product.productType}</Text>
            <Text style={{ color: colors.text, fontWeight: '900', marginTop: 12, textAlign: 'right', fontSize: 20 }}>
              {formatPrice(product.price, product.currencyCode)}
            </Text>
          </Card>

          <Card>
            <Text style={{ color: colors.text, fontWeight: '900', textAlign: 'right', marginBottom: 8 }}>תיאור</Text>
            <Text style={{ color: colors.text, textAlign: 'right', lineHeight: 20 }}>
              {product.description?.trim() ? product.description : 'אין תיאור למוצר הזה.'}
            </Text>
          </Card>
        </ScrollView>
        <StoreFloatingTabBar activeTab="home" onTabPress={handleBottomTabPress} />
      </View>
    </SafeAreaView>
  );
}

