import { radii } from '../../theme/radii';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Keyboard, Pressable, RefreshControl,
  StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchProducts } from '../../lib/shopify';
import { normalizeBrandImageUrl, type RemoteBrand } from '../../lib/brands';
import { indexCatalog, normalizeSearchQuery, searchCatalog } from '../../lib/catalogSearch';
import { favoriteInputFromStoreProduct } from '../../lib/favorites';
import { useBrands } from '../../hooks/useBrands';
import { useStoreCatalog } from '../../hooks/useStoreCatalog';
import { useDiscoveryProducts } from '../../hooks/useDiscoveryProducts';
import { useCart } from '../../state/CartContext';
import { useFavorites } from '../../state/FavoritesContext';
import { useOcdPlusMembership } from '../../state/useOcdPlusMembership';
import { useOcdPlusSubscribeSheet } from '../../context/OcdPlusSubscribeSheetContext';
import {
  getStoreBottomBarMetrics, HomeHighlightRailCard, StoreFloatingTabBar, toStoreProduct,
  type StoreBottomTabId, type StoreProduct, type StoreSubcategory,
} from './StoreHomeScreen';

// These logos include a solid square background intended to fill the circular crop.
const FULL_BLEED_BRAND_LOGOS = new Set(['יעקבי', 'יעקובי', 'פינל-1', 'פינל', 'סנו-1', 'סנו', 'shiny', 'שייני']);

function SearchBrandChip({ brand, onPress }: { brand: RemoteBrand; onPress: () => void }) {
  const uri = normalizeBrandImageUrl(brand.image);
  const fillCircle = FULL_BLEED_BRAND_LOGOS.has(brand.handle) || FULL_BLEED_BRAND_LOGOS.has(brand.label.trim().toLowerCase());
  const [failedUri, setFailedUri] = useState<string | null>(null);
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`חיפוש ${brand.label}`} style={styles.brandChip}>
    <View style={styles.brandLogoCircle}>
      {uri && uri !== failedUri
        ? <Image source={{ uri }} resizeMode={fillCircle ? 'cover' : 'contain'} style={fillCircle ? styles.brandLogoFullBleed : styles.brandLogo} accessible={false} onError={() => setFailedUri(uri)} />
        : <Text style={styles.brandInitial} accessible={false}>{(brand.short || brand.label).slice(0, 1)}</Text>}
    </View>
    <Text style={styles.brandText}>{brand.label}</Text>
  </Pressable>;
}

export function StoreSearchScreen({ onBack, onOpenCart, onOpenProduct, onTabPress }: {
  onBack: () => void;
  onOpenCart?: () => void;
  onOpenProduct?: (product: StoreProduct) => void;
  onOpenCategory?: (category: { id: string; title: string; description?: string; parentTitle?: string; subcategories?: StoreSubcategory[] }) => void;
  onTabPress: (tabId: StoreBottomTabId) => void;
}) {
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const { width } = useWindowDimensions();
  const tileWidth = (width - 28) / 4;
  const cardWidth = (width - 42) / 2;
  const { data: brands = [] } = useBrands();
  const catalog = useStoreCatalog();
  const { isFavorite, isFavoritePending, toggleFavorite } = useFavorites();
  const { isActiveMember } = useOcdPlusMembership();
  const { openOcdPlusSubscribeSheet } = useOcdPlusSubscribeSheet();
  const [query, setQuery] = useState('');
  const [brandQuery, setBrandQuery] = useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [discoveryRound, setDiscoveryRound] = useState(0);
  const listRef = useRef<FlatList<StoreProduct>>(null);
  const needle = normalizeSearchQuery(query);
  const columns = needle ? 2 : 4;
  const searchScope = brandQuery === needle ? 'catalog' : 'name';
  const hasQuery = !!needle;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(needle), 300);
    return () => clearTimeout(timer);
  }, [needle]);

  const browsing = useMemo(() => catalog.products.map((product, i) => toStoreProduct(product, i)), [catalog.products]);
  const discovery = useDiscoveryProducts(browsing, discoveryRound);
  // Opening discovery must never build a full text/brand index. Typed searches
  // need only names; metadata is indexed only when selecting a brand chip.
  const index = useMemo(() => hasQuery ? indexCatalog(browsing, brands, searchScope) : [], [browsing, brands, hasQuery, searchScope]);
  const remote = useQuery({
    queryKey: ['store-search', debouncedQuery],
    queryFn: async () => (await searchProducts(debouncedQuery, 48)).map((product, i) => toStoreProduct(product, i)),
    enabled: !!needle && needle === debouncedQuery,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
  const remoteIndex = useMemo(() => hasQuery ? indexCatalog(remote.data ?? [], brands, searchScope) : [], [remote.data, brands, hasQuery, searchScope]);
  // A late response belongs only to its own query; never show it for new/cleared input.
  const displayed = useMemo(() => needle
    ? searchCatalog([...index, ...(needle === debouncedQuery ? remoteIndex : [])], needle, searchScope)
    : discovery, [needle, debouncedQuery, index, remoteIndex, searchScope, discovery]);
  const searching = !!needle && (needle !== debouncedQuery || remote.isFetching);
  const loading = searching || catalog.isFetching;
  const suggestions = brands.filter(brand => !brand.hiddenFromCarousel);

  function changeQuery(value: string, fromBrand = false) {
    setQuery(value);
    setBrandQuery(fromBrand ? normalizeSearchQuery(value) : null);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

  function shuffleDiscovery() {
    setDiscoveryRound(round => round + 1);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

  async function refresh() {
    setRefreshing(true);
    try {
      await Promise.all([catalog.refetch({ cancelRefetch: false }),
        ...(needle && needle === debouncedQuery ? [remote.refetch({ cancelRefetch: false })] : [])]);
    } finally { setRefreshing(false); }
  }

  const error = (!catalog.isFetching && catalog.isError) || (!!needle && needle === debouncedQuery && remote.isError && !remote.isFetching);

  return <SafeAreaView edges={['top']} style={styles.page}>
    <View style={styles.header}>
      <View style={styles.topRow}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="חזרה" style={styles.roundButton}><Ionicons name="arrow-forward" size={21} color="#202124" /></Pressable>
        <Text style={styles.pageLabel}>חיפוש מוצרים</Text>
        {onOpenCart ? <SearchCartButton onOpenCart={onOpenCart} /> : <View style={{ width: 44 }} />}
      </View>
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={21} color="#75787C" />
        <TextInput value={query} onChangeText={changeQuery} placeholder="שם מוצר או חלק מהשם" placeholderTextColor="#96999D" accessibilityLabel="חיפוש לפי שם מוצר" returnKeyType="search" autoCorrect={false} autoCapitalize="none" onSubmitEditing={Keyboard.dismiss} style={styles.input} />
        {query ? <Pressable onPress={() => changeQuery('')} accessibilityRole="button" accessibilityLabel="ניקוי החיפוש" style={styles.clearButton}><Ionicons name="close" size={18} color="#75787C" /></Pressable> : null}
      </View>
    </View>
    <FlatList
      ref={listRef} key={columns} data={displayed} numColumns={columns} keyExtractor={product => product.id}
      contentContainerStyle={{ paddingBottom: contentPaddingBottom, flexGrow: 1 }}
      columnWrapperStyle={{ direction: 'ltr', flexDirection: 'row-reverse', gap: needle ? 10 : 4, paddingHorizontal: needle ? 16 : 8 }}
      ItemSeparatorComponent={() => <View style={{ height: needle ? 14 : 4 }} />}
      initialNumToRender={needle ? 3 : 6} maxToRenderPerBatch={needle ? 3 : 4} windowSize={5}
      showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor="#202124" />}
      ListHeaderComponent={<View>
        {!needle && suggestions.length ? <FlatList
          horizontal inverted data={suggestions} keyExtractor={brand => brand.handle}
          showsHorizontalScrollIndicator={false} style={styles.brandRail}
          contentContainerStyle={styles.brandRailContent} keyboardShouldPersistTaps="handled"
          renderItem={({ item: brand }) => <SearchBrandChip brand={brand} onPress={() => changeQuery(brand.label, true)} />}
        /> : null}
        <View style={styles.resultsHeading}>
          <Text style={styles.sectionTitle}>{needle ? 'תוצאות החיפוש' : 'לגלות משהו חדש'}</Text>
          <View style={styles.resultStatus}>{loading ? <ActivityIndicator size="small" color="#8A8D91" /> : null}{needle ? <Text style={styles.muted}>{`${displayed.length} מוצרים${loading ? ' בינתיים' : ''}`}</Text> : <Pressable onPress={shuffleDiscovery} accessibilityRole="button" accessibilityLabel="ערבוב סדר המוצרים" style={styles.shuffleButton}><Ionicons name="shuffle-outline" size={16} color="#777A7E" /><Text style={styles.muted}>ערבוב</Text></Pressable>}</View>
        </View>
        {error && displayed.length > 0 ? <Pressable onPress={() => void refresh()} accessibilityRole="button" style={styles.notice}><Text style={styles.muted}>לא הצלחנו לעדכן את כל התוצאות · לניסיון נוסף</Text></Pressable> : null}
      </View>}
      renderItem={({ item: product }) => needle ? <HomeHighlightRailCard
        product={product} cardWidth={cardWidth} remoteBrands={brands} isOcdPlusSubscriber={isActiveMember}
        favorite={isFavorite(product.id)} favoritePending={isFavoritePending(product.id)}
        onPress={() => { Keyboard.dismiss(); onOpenProduct?.(product); }}
        onToggleFavorite={() => { void toggleFavorite(favoriteInputFromStoreProduct(product)); }}
        onOpenOcdPlusSheet={openOcdPlusSubscribeSheet}
      /> : <Pressable
        accessibilityRole="button" accessibilityLabel={product.name} accessibilityHint="פתיחת פרטי המוצר"
        style={[styles.productTile, { width: tileWidth, height: tileWidth }]}
        android_ripple={{ color: '#E8E8E8' }}
        onPress={() => { Keyboard.dismiss(); onOpenProduct?.(product); }}
      >{product.imageUrl ? <Image source={{ uri: product.imageUrl }} resizeMode="contain" style={styles.productImage} accessible={false} /> : <Ionicons name="image-outline" size={26} color="#C5C7CA" />}</Pressable>}
      ListEmptyComponent={loading && !needle ? <View accessibilityLabel="טוען מוצרים" style={styles.skeletonGrid}>
        {Array.from({ length: 24 }, (_, i) => <View key={i} style={[styles.skeletonTile, { width: tileWidth, height: tileWidth }]} />)}
      </View> : <View style={styles.empty}>
        <View style={styles.emptyIcon}><Ionicons name={error ? 'cloud-offline-outline' : 'search-outline'} size={28} color="#84878B" /></View>
        <Text style={styles.emptyTitle}>{loading ? 'מחפשים את המוצר שלכם…' : error ? 'החיפוש לא התעדכן כרגע' : needle ? 'לא מצאנו התאמה הפעם' : 'המוצרים יופיעו כאן בקרוב'}</Text>
        <Text style={styles.emptyText}>{loading ? 'התוצאות יופיעו כאן ברגע שיגיעו.' : error ? 'אפשר לנסות שוב בעוד רגע.' : needle ? 'נסו שם קצר יותר, סוג מוצר או מותג.' : 'אפשר לרענן ולנסות שוב.'}</Text>
        {!loading ? <Pressable accessibilityRole="button" onPress={() => error || !needle ? void refresh() : changeQuery('')} style={styles.emptyButton}><Text style={styles.brandText}>{error || !needle ? 'ניסיון נוסף' : 'לכל המוצרים'}</Text></Pressable> : null}
      </View>}
    />
    <StoreFloatingTabBar activeTab="search" onTabPress={onTabPress} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 },
  topRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 18 },
  roundButton: { width: 44, height: 44, borderRadius: radii.pill, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  pageLabel: { flex: 1, textAlign: 'right', fontSize: 22, lineHeight: 30, fontWeight: '700', color: '#202124' },
  cartBadge: { position: 'absolute', top: -2, left: -2, minWidth: 18, height: 18, borderRadius: radii.compact, paddingHorizontal: 3, backgroundColor: '#202124', alignItems: 'center', justifyContent: 'center' },
  cartCount: { color: '#FFFFFF', fontSize: 10, fontWeight: '600' },
  searchBox: { flexDirection: 'row-reverse', alignItems: 'center', paddingRight: 14, paddingLeft: 4, gap: 9, borderRadius: radii.surface, backgroundColor: '#F5F5F5', minHeight: 50, borderWidth: 1, borderColor: '#EEEEEE' },
  input: { flex: 1, textAlign: 'right', writingDirection: 'rtl', fontSize: 14, color: '#202124', paddingVertical: 13 },
  clearButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  brandRail: { direction: 'ltr', marginBottom: 6 },
  brandRailContent: { direction: 'ltr', flexDirection: 'row', gap: 8, flexGrow: 1, paddingHorizontal: 16 },
  brandChip: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', gap: 8, minHeight: 44, paddingRight: 6, paddingLeft: 14, paddingVertical: 5, borderRadius: radii.pill, borderWidth: 1, borderColor: '#ECEDEE', backgroundColor: '#FAFAFA' },
  brandLogoCircle: { width: 30, height: 30, borderRadius: radii.pill, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECEDEE', alignItems: 'center', justifyContent: 'center' },
  brandLogo: { width: 26, height: 26 },
  brandLogoFullBleed: { width: '100%', height: '100%' },
  brandInitial: { fontSize: 13, fontWeight: '600', color: '#777A7E' },
  brandText: { fontSize: 13, fontWeight: '500', color: '#343639', textAlign: 'center' },
  resultsHeading: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 6, flexWrap: 'wrap', minHeight: 48 },
  shuffleButton: { flexDirection: 'row-reverse', gap: 5, alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingLeft: 4, paddingRight: 8 },
  sectionTitle: { fontSize: 17, lineHeight: 24, fontWeight: '600', color: '#202124', textAlign: 'right' },
  resultStatus: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  muted: { fontSize: 12, lineHeight: 19, color: '#8A8D91', textAlign: 'right' },
  notice: { padding: 12, borderRadius: radii.surface, backgroundColor: '#F6F6F6', marginHorizontal: 16, marginBottom: 12 },
  empty: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 40, gap: 10 },
  emptyIcon: { width: 64, height: 64, borderRadius: radii.pill, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#202124', textAlign: 'center' },
  emptyText: { fontSize: 14, lineHeight: 22, color: '#8A8D91', textAlign: 'center' },
  emptyButton: { paddingHorizontal: 22, paddingVertical: 13, borderRadius: radii.surface, backgroundColor: '#F3F3F3', marginTop: 8 },
  productTile: { alignItems: 'center', justifyContent: 'center', borderRadius: radii.compact, backgroundColor: '#F7F7F7', overflow: 'hidden', padding: 5 },
  productImage: { width: '100%', height: '100%' },
  skeletonGrid: { direction: 'ltr', flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4, paddingHorizontal: 8 },
  skeletonTile: { borderRadius: radii.compact, backgroundColor: '#F5F5F5' },
});

function SearchCartButton({ onOpenCart }: { onOpenCart: () => void }) {
  const { itemCount } = useCart();
  return (
    <Pressable onPress={onOpenCart} accessibilityRole="button" accessibilityLabel={`עגלת קניות, ${itemCount} פריטים`} style={styles.roundButton}>
      <Ionicons name="bag-outline" size={20} color="#202124" />
      {itemCount > 0 ? <View style={styles.cartBadge}><Text style={styles.cartCount}>{itemCount > 99 ? '99+' : itemCount}</Text></View> : null}
    </Pressable>
  );
}
