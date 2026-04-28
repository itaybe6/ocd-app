import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { fetchProducts, searchProducts } from '../../lib/shopify';
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

  const TILE_GAP = 2;
  const tileWidth = Math.floor((windowWidth - TILE_GAP * 2) / 3);

  const [browsing, setBrowsing] = useState<StoreProduct[]>([]);
  const [results, setResults] = useState<StoreProduct[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Displayed list: search results when query exists, else browse grid
  const displayed = query.trim() ? results : browsing;

  const doLoad = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      setError(null);
      const raw = await fetchProducts(30);
      const mapped = raw
        .map((p, i) => toStoreProduct(p, i))
        .sort(() => Math.random() - 0.5);
      setBrowsing(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בטעינת מוצרים');
    } finally {
      setInitialLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void doLoad();
  }, [doLoad]);

  // Live search with 400ms debounce
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const raw = await searchProducts(q, 40);
        setResults(raw.map((p, i) => toStoreProduct(p, i)));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
      {/* Search bar */}
      <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 14, backgroundColor: '#FAFAFA' }}>
        <View
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            backgroundColor: '#EFEFEF',
            borderRadius: 14,
            paddingHorizontal: 12,
            height: 42,
          }}
        >
          {searching ? (
            <ActivityIndicator size="small" color="#8E8E93" style={{ marginLeft: 6 }} />
          ) : (
            <Ionicons name="search" size={16} color="#8E8E93" style={{ marginLeft: 6 }} />
          )}
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="חיפוש מוצרים..."
            placeholderTextColor="#AEAEB2"
            returnKeyType="search"
            style={{ flex: 1, color: '#111827', textAlign: 'right', fontSize: 15, padding: 0 }}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color="#AEAEB2" style={{ marginRight: 4 }} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Initial loading spinner — only before first data arrives */}
      {initialLoading && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#555" />
        </View>
      )}

      {/* Error (shown only after load attempted and still no data) */}
      {!initialLoading && !!error && displayed.length === 0 && (
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
      {!initialLoading && !searching && !error && displayed.length === 0 && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="search-outline" size={48} color="#C7C7CC" />
          <Text style={{ color: '#8E8E93', fontWeight: '700', marginTop: 12, fontSize: 16 }}>
            {query.trim() ? 'לא נמצאו תוצאות' : 'לא נמצאו מוצרים'}
          </Text>
        </View>
      )}

      {/* Grid — FlatList with numColumns for reliable 3-column layout */}
      {!initialLoading && displayed.length > 0 && (
        <FlatList
          data={displayed}
          keyExtractor={(item) => item.id}
          numColumns={3}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: contentPaddingBottom }}
          columnWrapperStyle={{ gap: TILE_GAP }}
          ItemSeparatorComponent={() => <View style={{ height: TILE_GAP }} />}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void doLoad(true)}
              tintColor="#555"
              colors={['#555']}
            />
          }
          renderItem={({ item: product }) => (
            <Pressable
              onPress={() => onOpenProduct?.(product)}
              style={({ pressed }) => ({
                width: tileWidth,
                height: tileWidth,
                backgroundColor: '#D1D5DB',
                opacity: pressed ? 0.82 : 1,
                overflow: 'hidden',
              })}
            >
              {product.imageUrl ? (
                <Image
                  source={{ uri: product.imageUrl }}
                  resizeMode="cover"
                  style={{ width: tileWidth, height: tileWidth }}
                />
              ) : (
                <ProductImage product={product} height={tileWidth} />
              )}

              {/* Name overlay */}
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  paddingHorizontal: 6,
                  paddingTop: 18,
                  paddingBottom: 6,
                  backgroundColor: 'rgba(0,0,0,0.38)',
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: '#FFFFFF',
                    fontSize: 10,
                    fontWeight: '700',
                    textAlign: 'right',
                    letterSpacing: 0.1,
                    textShadowColor: 'rgba(0,0,0,0.5)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                  }}
                >
                  {product.name}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}

      <StoreFloatingTabBar activeTab="search" onTabPress={onTabPress} />
    </SafeAreaView>
  );
}
