import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { findProductBrand, type RemoteBrand } from '../../lib/brands';
import { useBrands } from '../../hooks/useBrands';
import { ProductBrandBadge } from '../../components/ProductBrandBadge';
import {
  getStoreBottomBarMetrics,
  ProductImage,
  StoreFloatingTabBar,
  toStoreProduct,
  type StoreBottomTabId,
  type StoreProduct,
  type StoreSubcategory,
} from './StoreHomeScreen';
import { colors } from '../../theme/colors';

function brandMatchesQuery(brand: RemoteBrand, q: string): boolean {
  const needle = q.toLowerCase();
  if (brand.label.toLowerCase().includes(needle)) return true;
  if (brand.short.toLowerCase().includes(needle)) return true;
  if (brand.handle.toLowerCase().includes(needle)) return true;
  return brand.keywords.some((k) => k.toLowerCase().includes(needle) || needle.includes(k.toLowerCase()));
}

function productMatchesQuery(product: StoreProduct, q: string, brands: RemoteBrand[]): boolean {
  const needle = q.toLowerCase();
  if (product.name.toLowerCase().includes(needle)) return true;
  if (product.subtitle.toLowerCase().includes(needle)) return true;
  if (product.description.toLowerCase().includes(needle)) return true;
  if ((product.tags ?? []).some((t) => t.toLowerCase().includes(needle))) return true;

  const productBrand = findProductBrand(
    {
      tags: product.tags,
      collectionHandles: product.collectionHandles,
      collectionTitles: product.collectionTitles,
    },
    brands,
  );
  if (productBrand && brandMatchesQuery(productBrand, needle)) return true;

  return brands.some(
    (b) =>
      brandMatchesQuery(b, needle) &&
      findProductBrand(
        {
          tags: product.tags,
          collectionHandles: product.collectionHandles,
          collectionTitles: product.collectionTitles,
        },
        [b],
      ),
  );
}

function mergeUniqueProducts(primary: StoreProduct[], secondary: StoreProduct[]): StoreProduct[] {
  const seen = new Set<string>();
  const out: StoreProduct[] = [];
  for (const product of [...primary, ...secondary]) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    out.push(product);
  }
  return out;
}

export function StoreSearchScreen({
  onBack: _onBack,
  onOpenCart: _onOpenCart,
  onOpenProduct,
  onOpenCategory: _onOpenCategory,
  onTabPress,
}: {
  onBack: () => void;
  onOpenCart?: () => void;
  onOpenProduct?: (product: StoreProduct) => void;
  onOpenCategory?: (category: {
    id: string;
    title: string;
    description?: string;
    parentTitle?: string;
    subcategories?: StoreSubcategory[];
  }) => void;
  onTabPress: (tabId: StoreBottomTabId) => void;
}) {
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const { width: windowWidth } = useWindowDimensions();
  const { data: remoteBrands = [] } = useBrands();

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
  const searchGenRef = useRef(0);

  const trimmedQuery = query.trim();
  const isSearchingMode = trimmedQuery.length > 0;
  const displayed = isSearchingMode ? results : browsing;
  const pageBg = isSearchingMode ? '#F3F4F6' : colors.bg;

  const doLoad = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      setError(null);
      const raw = await fetchProducts();
      const mapped = raw.map((p, i) => toStoreProduct(p, i)).sort(() => Math.random() - 0.5);
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

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const gen = ++searchGenRef.current;
    debounceRef.current = setTimeout(async () => {
      const localMatches = browsing.filter((p) => productMatchesQuery(p, q, remoteBrands));

      let remoteMatches: StoreProduct[] = [];
      try {
        const raw = await searchProducts(q, 48);
        remoteMatches = raw.map((p, i) => toStoreProduct(p, i));
      } catch {
        // Keep local matches if Shopify search fails.
      }

      if (searchGenRef.current !== gen) return;

      setResults(mergeUniqueProducts(localMatches, remoteMatches));
      setSearching(false);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, browsing, remoteBrands]);

  const resultsHeader = useMemo(() => {
    if (!isSearchingMode) return null;
    if (searching) return 'מחפש…';
    return `${displayed.length} תוצאות עבור "${trimmedQuery}"`;
  }, [isSearchingMode, searching, displayed.length, trimmedQuery]);

  const renderListEmpty = useCallback(() => {
    if (searching) {
      return (
        <View style={{ paddingVertical: 48, alignItems: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color="#111827" />
          <Text style={{ color: '#8A8F98', fontWeight: '600', fontSize: 14 }}>מחפש מוצרים…</Text>
        </View>
      );
    }
    return (
      <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 28, gap: 10 }}>
        <Ionicons name="search-outline" size={48} color="#C7C7CC" />
        <Text style={{ color: '#111827', fontWeight: '800', fontSize: 16, textAlign: 'center' }}>
          {isSearchingMode ? 'לא נמצאו תוצאות' : 'לא נמצאו מוצרים'}
        </Text>
        {isSearchingMode ? (
          <Text style={{ color: '#8A8F98', fontWeight: '600', fontSize: 14, textAlign: 'center', lineHeight: 21 }}>
            נסה שם מוצר או מותג אחר
          </Text>
        ) : null}
      </View>
    );
  }, [searching, isSearchingMode]);

  const showMainList = !initialLoading && !(error && displayed.length === 0);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: pageBg }}>
      <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12, backgroundColor: pageBg }}>
        <View
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            backgroundColor: isSearchingMode ? '#FFFFFF' : '#EFEFEF',
            borderRadius: 14,
            borderWidth: isSearchingMode ? 1 : 0,
            borderColor: '#E5E7EB',
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
            placeholder="חיפוש לפי שם מוצר או מותג..."
            placeholderTextColor="#AEAEB2"
            returnKeyType="search"
            autoCorrect={false}
            style={{ flex: 1, color: '#111827', textAlign: 'right', fontSize: 15, padding: 0 }}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color="#AEAEB2" style={{ marginRight: 4 }} />
            </Pressable>
          )}
        </View>

        {!!resultsHeader && (
          <Text
            style={{
              marginTop: 12,
              color: '#6B7280',
              fontSize: 13,
              fontWeight: '700',
              textAlign: 'right',
            }}
          >
            {resultsHeader}
          </Text>
        )}
      </View>

      {initialLoading && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#555" />
        </View>
      )}

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

      {showMainList && (
        <FlatList
          data={displayed}
          keyExtractor={(item) => item.id}
          numColumns={3}
          style={{ flex: 1, backgroundColor: pageBg }}
          contentContainerStyle={
            displayed.length === 0
              ? { flexGrow: 1, paddingBottom: contentPaddingBottom }
              : { paddingBottom: contentPaddingBottom }
          }
          columnWrapperStyle={
            displayed.length > 0 ? { flexDirection: 'row-reverse', gap: TILE_GAP } : undefined
          }
          ItemSeparatorComponent={displayed.length > 0 ? () => <View style={{ height: TILE_GAP }} /> : undefined}
          ListEmptyComponent={renderListEmpty}
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
                backgroundColor: isSearchingMode ? '#FFFFFF' : '#D1D5DB',
                opacity: pressed ? 0.82 : 1,
                overflow: 'hidden',
              })}
            >
              <View style={{ width: tileWidth, height: tileWidth }}>
                {product.imageUrl ? (
                  <Image
                    source={{ uri: product.imageUrl }}
                    resizeMode="cover"
                    style={{ width: tileWidth, height: tileWidth }}
                  />
                ) : (
                  <ProductImage product={product} height={tileWidth} />
                )}
                <ProductBrandBadge product={product} brands={remoteBrands} size={28} />
              </View>
            </Pressable>
          )}
        />
      )}

      <StoreFloatingTabBar activeTab="search" onTabPress={onTabPress} />
    </SafeAreaView>
  );
}
