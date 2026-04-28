import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchProducts } from '../../lib/shopify';
import {
  getStoreBottomBarMetrics,
  ProductImage,
  StoreFloatingTabBar,
  toStoreProduct,
  type StoreBottomTabId,
  type StoreProduct,
} from './StoreHomeScreen';

export function StoreSearchScreen({
  onBack: _onBack,
  onOpenCart: _onOpenCart,
  onOpenProduct,
  onTabPress,
}: {
  onBack: () => void;
  onOpenCart?: () => void;
  onOpenProduct?: (product: StoreProduct) => void;
  onTabPress: (tabId: StoreBottomTabId) => void;
}) {
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const { width: windowWidth } = useWindowDimensions();
  const tileSize = Math.floor(windowWidth / 3) - 1;

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const doLoad = useCallback(async (isRefresh = false) => {
    console.log('[StoreSearch] doLoad start, isRefresh=', isRefresh);
    try {
      if (isRefresh) setRefreshing(true);
      setError(null);
      const raw = await fetchProducts(30);
      console.log('[StoreSearch] fetchProducts returned', raw.length, 'products');
      const mapped = raw
        .map((p, i) => toStoreProduct(p, i))
        .sort(() => Math.random() - 0.5);
      setProducts(mapped);
    } catch (e) {
      console.log('[StoreSearch] fetchProducts ERROR:', e);
      setError(e instanceof Error ? e.message : 'שגיאה בטעינת מוצרים');
    } finally {
      setInitialLoading(false);
      if (isRefresh) setRefreshing(false);
      console.log('[StoreSearch] doLoad done');
    }
  }, []);

  useEffect(() => {
    void doLoad();
  }, [doLoad]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [query, products]);

  console.log('[StoreSearch] render — initialLoading:', initialLoading, 'products:', products.length, 'filtered:', filtered.length);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
      {/* Search bar */}
      <View style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FAFAFA' }}>
        <View
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            backgroundColor: '#EFEFEF',
            borderRadius: 12,
            paddingHorizontal: 12,
            height: 40,
          }}
        >
          <Ionicons name="search" size={16} color="#8E8E93" style={{ marginLeft: 6 }} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="חיפוש..."
            placeholderTextColor="#AEAEB2"
            returnKeyType="search"
            style={{ flex: 1, color: '#111827', textAlign: 'right', fontSize: 15, padding: 0 }}
          />
        </View>
      </View>

      {/* Initial loading spinner — only before first data arrives */}
      {initialLoading && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#555" />
        </View>
      )}

      {/* Error (shown only after load attempted and still no data) */}
      {!initialLoading && !!error && filtered.length === 0 && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Ionicons name="alert-circle-outline" size={40} color="#DC2626" />
          <Text style={{ color: '#991B1B', fontWeight: '700', textAlign: 'center', marginTop: 12, marginBottom: 20 }}>
            {error}
          </Text>
          <Pressable
            onPress={() => void doLoad()}
            style={({ pressed }) => ({
              backgroundColor: '#111827',
              paddingHorizontal: 24,
              paddingVertical: 10,
              borderRadius: 10,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>נסה שנית</Text>
          </Pressable>
        </View>
      )}

      {/* Empty state */}
      {!initialLoading && !error && filtered.length === 0 && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="search-outline" size={48} color="#C7C7CC" />
          <Text style={{ color: '#8E8E93', fontWeight: '700', marginTop: 12, fontSize: 16 }}>
            {query ? 'לא נמצאו תוצאות' : 'לא נמצאו מוצרים'}
          </Text>
        </View>
      )}

      {/* Grid — FlatList with numColumns for reliable 3-column layout */}
      {!initialLoading && filtered.length > 0 && (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={3}
          style={{ flex: 1, backgroundColor: 'red' }}
          contentContainerStyle={{ paddingBottom: contentPaddingBottom }}
          columnWrapperStyle={{ gap: 2 }}
          ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onLayout={(e) =>
            console.log('[StoreSearch] FlatList layout:', JSON.stringify(e.nativeEvent.layout))
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void doLoad(true)}
              tintColor="#555"
              colors={['#555']}
            />
          }
          renderItem={({ item: product, index }) => {
            if (index < 3) console.log('[StoreSearch] renderItem', index, product.id, product.imageUrl?.slice(0, 60));
            return (
              <Pressable
                onPress={() => onOpenProduct?.(product)}
                style={({ pressed }) => ({
                  flex: 1,
                  aspectRatio: 1,
                  backgroundColor: '#D1D5DB',
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                {product.imageUrl ? (
                  <Image
                    source={{ uri: product.imageUrl }}
                    resizeMode="cover"
                    style={{ width: '100%', height: '100%' }}
                  />
                ) : (
                  <ProductImage product={product} height={tileSize} />
                )}
              </Pressable>
            );
          }}
        />
      )}

      <StoreFloatingTabBar activeTab="search" onTabPress={onTabPress} />
    </SafeAreaView>
  );
}
