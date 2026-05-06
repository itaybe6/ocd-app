import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fetchCollectionProducts,
  fetchCollections,
  fetchMenuItems,
  fetchProducts,
  searchProducts,
  type ShopifyCollection,
  type ShopifyMenuItem,
} from '../../lib/shopify';
import {
  CATEGORY_STORY_PRODUCT_OVERRIDES,
  flattenMenuCategories,
  getCategoryAvatarLabel,
  getStoreBottomBarMetrics,
  getTopLevelCategoryChildrenMap,
  getTopLevelMenuCategories,
  ProductImage,
  StoreFloatingTabBar,
  toStoreProduct,
  type StoreBottomTabId,
  type StoreCategory,
  type StoreProduct,
  type StoreSubcategory,
} from './StoreHomeScreen';

/** Tighter strip; more fit on screen (RTL horizontal scroll). Collapses on vertical scroll. */
const CATEGORY_CIRCLE_SIZE = 62;
const CATEGORY_CIRCLE_COLLAPSED = 32;
const CATEGORY_ITEM_WIDTH = 68;
const CATEGORY_ROW_GAP = 6;
const CATEGORY_COLLAPSE_SCROLL_RANGE = 96;
const CATEGORY_STRIP_HEIGHT_EXPANDED = 112;
const CATEGORY_STRIP_HEIGHT_COLLAPSED = 46;

function SearchCategoryChip({
  category,
  storyImageUrl,
  scrollY,
  onPress,
}: {
  category: StoreCategory;
  storyImageUrl: string | null | undefined;
  scrollY: SharedValue<number>;
  onPress: () => void;
}) {
  const ringStyle = useAnimatedStyle(() => {
    const dim = interpolate(
      scrollY.value,
      [0, CATEGORY_COLLAPSE_SCROLL_RANGE],
      [CATEGORY_CIRCLE_SIZE, CATEGORY_CIRCLE_COLLAPSED],
      Extrapolation.CLAMP
    );
    const pad = interpolate(
      scrollY.value,
      [0, CATEGORY_COLLAPSE_SCROLL_RANGE],
      [2, 1],
      Extrapolation.CLAMP
    );
    return {
      width: dim,
      height: dim,
      borderRadius: dim / 2,
      padding: pad,
    };
  });

  const innerClipStyle = useAnimatedStyle(() => {
    const dim = interpolate(
      scrollY.value,
      [0, CATEGORY_COLLAPSE_SCROLL_RANGE],
      [CATEGORY_CIRCLE_SIZE, CATEGORY_CIRCLE_COLLAPSED],
      Extrapolation.CLAMP
    );
    const pad = interpolate(
      scrollY.value,
      [0, CATEGORY_COLLAPSE_SCROLL_RANGE],
      [2, 1],
      Extrapolation.CLAMP
    );
    const innerR = Math.max(4, dim / 2 - pad - 2);
    return { borderRadius: innerR };
  });

  const labelWrapStyle = useAnimatedStyle(() => {
    const hidden = interpolate(
      scrollY.value,
      [0, CATEGORY_COLLAPSE_SCROLL_RANGE * 0.55],
      [36, 0],
      Extrapolation.CLAMP
    );
    return {
      maxHeight: hidden,
      opacity: interpolate(
        scrollY.value,
        [0, CATEGORY_COLLAPSE_SCROLL_RANGE * 0.35, CATEGORY_COLLAPSE_SCROLL_RANGE * 0.65],
        [1, 0.35, 0],
        Extrapolation.CLAMP
      ),
      overflow: 'hidden',
    };
  });

  return (
    <View style={{ transform: [{ scaleX: -1 }] }}>
      <Pressable onPress={onPress}>
        <View style={{ alignItems: 'center', gap: 4, width: CATEGORY_ITEM_WIDTH }}>
          <Animated.View
            style={[
              {
                backgroundColor: 'transparent',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: '#E2E8F0',
              },
              ringStyle,
            ]}
          >
            <Animated.View
              style={[
                {
                  flex: 1,
                  overflow: 'hidden',
                  backgroundColor: '#F4F6FA',
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                innerClipStyle,
              ]}
            >
              {storyImageUrl ? (
                <Image
                  source={{ uri: storyImageUrl }}
                  resizeMode="cover"
                  accessibilityLabel={category.name}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <Text style={{ color: '#6B7280', fontSize: 15, fontWeight: '800' }}>
                  {getCategoryAvatarLabel(category.name)}
                </Text>
              )}
            </Animated.View>
          </Animated.View>
          <Animated.View style={labelWrapStyle}>
            <Text
              numberOfLines={2}
              style={{
                color: '#9CA3AF',
                fontWeight: '600',
                fontSize: 11,
                lineHeight: 14,
                textAlign: 'center',
              }}
            >
              {category.name}
            </Text>
          </Animated.View>
        </View>
      </Pressable>
    </View>
  );
}

export function StoreSearchScreen({
  onBack: _onBack,
  onOpenCart: _onOpenCart,
  onOpenProduct,
  onOpenCategory,
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

  const [categories, setCategories] = useState<StoreCategory[]>([{ id: 'all', name: 'כל המוצרים' }]);
  const [menuItems, setMenuItems] = useState<ShopifyMenuItem[]>([]);
  const [categoryStoryImages, setCategoryStoryImages] = useState<Record<string, string>>({});

  const topLevelCategories = useMemo(
    () => (menuItems.length ? getTopLevelMenuCategories(menuItems) : categories.filter((c) => c.id !== 'all')),
    [categories, menuItems]
  );

  const topLevelCategoryChildrenMap = useMemo(() => getTopLevelCategoryChildrenMap(menuItems), [menuItems]);

  const displayed = query.trim() ? results : browsing;

  const doLoad = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      setError(null);
      const raw = await fetchProducts();
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

  useEffect(() => {
    let isMounted = true;

    const loadCategoryMeta = async () => {
      try {
        const liveCollections = await fetchCollections();
        let liveMenuItems: ShopifyMenuItem[] = [];
        try {
          liveMenuItems = await fetchMenuItems();
        } catch {
          liveMenuItems = [];
        }
        if (!isMounted) return;

        const mappedCollections: StoreCategory[] = liveMenuItems.length
          ? flattenMenuCategories(liveMenuItems)
          : [
              { id: 'all', name: 'כל המוצרים' },
              ...liveCollections.map((collection: ShopifyCollection) => ({
                id: collection.handle,
                name: collection.title,
                subtitle: collection.description,
                imageUrl: collection.imageUrl,
              })),
            ];

        setCategories(mappedCollections);
        setMenuItems(liveMenuItems);
      } catch {
        if (!isMounted) return;
        setCategories([{ id: 'all', name: 'כל המוצרים' }]);
        setMenuItems([]);
      }
    };

    void loadCategoryMeta();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadCategoryStoryImages = async () => {
      if (!topLevelCategories.length) return;

      try {
        const imageEntries = await Promise.all(
          topLevelCategories.map(async (category) => {
            try {
              const categoryProducts = await fetchCollectionProducts(category.id, 8);
              const productsWithImages = categoryProducts.filter((product) => !!product.imageUrl);
              const preferredTitleFragments = CATEGORY_STORY_PRODUCT_OVERRIDES[category.name] ?? [];

              if (!productsWithImages.length) {
                return [category.id, category.imageUrl ?? ''] as const;
              }

              const preferredProduct = preferredTitleFragments.length
                ? productsWithImages.find((product) =>
                    preferredTitleFragments.some((fragment) => product.title.includes(fragment))
                  )
                : undefined;

              if (preferredProduct?.imageUrl) {
                return [category.id, preferredProduct.imageUrl] as const;
              }

              const randomProduct = productsWithImages[Math.floor(Math.random() * productsWithImages.length)];
              return [category.id, randomProduct.imageUrl ?? category.imageUrl ?? ''] as const;
            } catch {
              return [category.id, category.imageUrl ?? ''] as const;
            }
          })
        );

        if (!isMounted) return;

        setCategoryStoryImages(
          imageEntries.reduce<Record<string, string>>((acc, [categoryId, imageUrl]) => {
            if (imageUrl) {
              acc[categoryId] = imageUrl;
            }
            return acc;
          }, {})
        );
      } catch {
        if (!isMounted) return;
        setCategoryStoryImages({});
      }
    };

    void loadCategoryStoryImages();

    return () => {
      isMounted = false;
    };
  }, [topLevelCategories]);

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
        const raw = await searchProducts(q);
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

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const categoryStripAnimatedStyle = useAnimatedStyle(() => {
    const h = interpolate(
      scrollY.value,
      [0, CATEGORY_COLLAPSE_SCROLL_RANGE],
      [CATEGORY_STRIP_HEIGHT_EXPANDED, CATEGORY_STRIP_HEIGHT_COLLAPSED],
      Extrapolation.CLAMP
    );
    return {
      height: h,
      overflow: 'hidden',
    };
  });

  const renderListEmpty = useCallback(() => {
    if (searching) {
      return (
        <View style={{ paddingVertical: 36, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#555" />
        </View>
      );
    }
    return (
      <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 }}>
        <Ionicons name="search-outline" size={48} color="#C7C7CC" />
        <Text style={{ color: '#8E8E93', fontWeight: '700', marginTop: 12, fontSize: 16 }}>
          {query.trim() ? 'לא נמצאו תוצאות' : 'לא נמצאו מוצרים'}
        </Text>
      </View>
    );
  }, [searching, query]);

  const showMainList = !initialLoading && !(error && displayed.length === 0);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
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

      {/* Sticky below search: collapses on grid scroll, stays pinned */}
      {topLevelCategories.length > 0 && !!onOpenCategory && showMainList && (
        <Animated.View
          style={[
            {
              zIndex: 2,
              backgroundColor: '#FAFAFA',
              paddingBottom: 4,
            },
            categoryStripAnimatedStyle,
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ transform: [{ scaleX: -1 }] }}
            contentContainerStyle={{
              flexDirection: 'row-reverse',
              justifyContent: 'flex-start',
              alignItems: 'center',
              gap: CATEGORY_ROW_GAP,
              paddingHorizontal: 12,
              paddingVertical: 2,
            }}
          >
            {topLevelCategories.map((category) => {
              const storyImageUrl = categoryStoryImages[category.id] || category.imageUrl;
              return (
                <SearchCategoryChip
                  key={category.id}
                  category={category}
                  storyImageUrl={storyImageUrl}
                  scrollY={scrollY}
                  onPress={() =>
                    onOpenCategory({
                      id: category.id,
                      title: category.name,
                      description: category.subtitle,
                      subcategories: topLevelCategoryChildrenMap[category.id] ?? [],
                    })
                  }
                />
              );
            })}
          </ScrollView>
        </Animated.View>
      )}

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
        <Animated.FlatList
          data={displayed}
          keyExtractor={(item) => item.id}
          numColumns={3}
          style={{ flex: 1, zIndex: 0 }}
          contentContainerStyle={
            displayed.length === 0 ? { flexGrow: 1, paddingBottom: contentPaddingBottom } : { paddingBottom: contentPaddingBottom }
          }
          columnWrapperStyle={displayed.length > 0 ? { gap: TILE_GAP } : undefined}
          ItemSeparatorComponent={displayed.length > 0 ? () => <View style={{ height: TILE_GAP }} /> : undefined}
          ListEmptyComponent={renderListEmpty}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onScroll={scrollHandler}
          scrollEventThrottle={16}
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
            </Pressable>
          )}
        />
      )}

      <StoreFloatingTabBar activeTab="search" onTabPress={onTabPress} />
    </SafeAreaView>
  );
}
