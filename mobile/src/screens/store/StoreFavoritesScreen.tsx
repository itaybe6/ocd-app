import { storeAccent } from '../../theme/storeAccent';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Pressable, RefreshControl, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FavoriteCatalogCard } from '../../components/FavoriteCatalogCard';
import { useFavorites } from '../../state/FavoritesContext';
import { useAuth } from '../../state/AuthContext';
import { useStoreCatalog } from '../../hooks/useStoreCatalog';
import { useBrands } from '../../hooks/useBrands';
import { useOcdPlusMembership } from '../../state/useOcdPlusMembership';
import { useOcdPlusSubscribeSheet } from '../../context/OcdPlusSubscribeSheetContext';
import { normalizeSearchQuery } from '../../lib/catalogSearch';
import { radii } from '../../theme/radii';
import { getStoreBottomBarMetrics, StoreFloatingTabBar, type StoreBottomTabId } from './StoreHomeScreen';

export function StoreFavoritesScreen({ onOpenProduct, onTabPress, onLoginPress }: {
  onOpenProduct: (handle: string) => void;
  onTabPress: (tabId: StoreBottomTabId) => void;
  onLoginPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = (width - 42) / 2;
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const { user } = useAuth();
  const { favorites, isHydrating, isFavoritePending, removeFavorite, refreshFavorites } = useFavorites();
  const catalog = useStoreCatalog();
  const { data: brands = [] } = useBrands();
  const { isActiveMember } = useOcdPlusMembership();
  const { openOcdPlusSubscribeSheet } = useOcdPlusSubscribeSheet();
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const needle = normalizeSearchQuery(query);
  const byId = useMemo(() => new Map(catalog.products.map(product => [product.id, product])), [catalog.products]);
  const byHandle = useMemo(() => new Map(catalog.products.map(product => [product.handle, product])), [catalog.products]);
  const filtered = useMemo(() => {
    const words = needle.split(' ').filter(Boolean);
    return favorites.filter(favorite => {
      const live = byId.get(favorite.product_id) ?? byHandle.get(favorite.product_handle);
      const name = normalizeSearchQuery(live?.title ?? favorite.product_title);
      return words.every(word => name.includes(word));
    });
  }, [favorites, needle, byId, byHandle]);
  const refresh = async () => {
    setRefreshing(true);
    try { await Promise.all([refreshFavorites(), catalog.refetch()]); }
    finally { setRefreshing(false); }
  };
  const goHome = () => { Keyboard.dismiss(); onTabPress('home'); };
  const guest = !user || user.role !== 'customer';
  return <View style={styles.root}>
    <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
      <View style={styles.headingRow}>
        <Pressable onPress={goHome} accessibilityRole="button" accessibilityLabel="חזרה לדף הבית" style={styles.roundButton}><Ionicons name="arrow-forward" size={21} color="#202020" /></Pressable>
        <View style={styles.headingCopy}>
          <Text style={styles.title} accessibilityRole="header">המועדפים שלי</Text>
          <Text style={styles.subtitle}>כל מה שאהבתם, במקום אחד.</Text>
        </View>
      </View>
      {!guest && favorites.length > 0 ? <View style={styles.search}>
        <Ionicons name="search-outline" size={19} color="#888888" />
        <TextInput value={query} onChangeText={setQuery} placeholder="חיפוש במועדפים" placeholderTextColor="#919191" accessibilityLabel="חיפוש במועדפים" style={styles.input} returnKeyType="search" onSubmitEditing={() => Keyboard.dismiss()} autoCorrect={false} />
        {query ? <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="ניקוי החיפוש" style={styles.clear}><Ionicons name="close" size={18} color="#777777" /></Pressable> : null}
      </View> : null}
    </View>
    {guest ? <View style={[styles.empty, { flex: 1, paddingBottom: contentPaddingBottom }]}>
      <View style={styles.heartDisc}><Ionicons name="heart-outline" size={30} color="#535353" /></View>
      <Text style={styles.emptyTitle}>שמרו את מה שאהבתם</Text>
      <Text style={styles.emptyText}>{'התחברו לחשבון כדי לשמור מוצרים\nולחזור אליהם מתי שתרצו.'}</Text>
      <Pressable onPress={onLoginPress} accessibilityRole="button" style={styles.cta}><Text style={styles.ctaText}>כניסה לחשבון</Text></Pressable>
    </View> : <FlatList
      data={isHydrating ? [] : filtered} numColumns={2} keyExtractor={item => item.id}
      initialNumToRender={3} maxToRenderPerBatch={3} windowSize={5}
      columnWrapperStyle={styles.row} style={styles.list}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: contentPaddingBottom + 8, flexGrow: 1 }}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refresh(); }} tintColor="#202020" />}
      ListHeaderComponent={favorites.length > 0 ? <View style={styles.countRow}><Text style={styles.count}>{needle ? `${filtered.length} מתוך ${favorites.length} מוצרים` : `${favorites.length} מוצרים ששמרתם`}</Text></View> : undefined}
      ListEmptyComponent={<View style={styles.empty}>
        {isHydrating ? <><ActivityIndicator color="#202020" /><Text style={styles.emptyText}>טוענים את המועדפים שלכם…</Text></> : <>
          <View style={styles.heartDisc}><Ionicons name={favorites.length ? 'search-outline' : 'heart-outline'} size={30} color="#666666" /></View>
          <Text style={styles.emptyTitle}>{favorites.length ? 'לא מצאנו התאמה' : 'המוצרים שתאהבו יחכו כאן'}</Text>
          <Text style={styles.emptyText}>{favorites.length ? 'נסו שם אחר או חלק משם המוצר.' : 'לחצו על הלב ליד מוצר שאהבתם.\nמכאן תוכלו להוסיף אותו ישר לעגלה.'}</Text>
          <Pressable onPress={favorites.length ? () => setQuery('') : goHome} accessibilityRole="button" style={styles.cta}><Text style={styles.ctaText}>{favorites.length ? 'ניקוי החיפוש' : 'לגלות מוצרים'}</Text></Pressable>
        </>}
      </View>}
      renderItem={({ item }) => <FavoriteCatalogCard
        favorite={item} liveProduct={byId.get(item.product_id) ?? byHandle.get(item.product_handle)} width={cardWidth}
        brands={brands} isSubscriber={isActiveMember} pending={isFavoritePending(item.product_id)}
        onRemove={() => { void removeFavorite(item.product_id); }} onOpenProduct={onOpenProduct} onOpenMembership={openOcdPlusSubscribeSheet}
      />}
    />}
    <StoreFloatingTabBar activeTab="favorites" onTabPress={onTabPress} />
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  list: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 10, backgroundColor: '#FFFFFF', gap: 18 },
  headingRow: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  headingCopy: { flex: 1, gap: 3 },
  title: { fontSize: 23, lineHeight: 31, fontWeight: '700', color: '#202020', textAlign: 'right', writingDirection: 'rtl' },
  subtitle: { fontSize: 12, lineHeight: 19, color: '#818181', textAlign: 'right', writingDirection: 'rtl' },
  roundButton: { width: 44, height: 44, borderRadius: radii.pill, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  search: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', gap: 9, minHeight: 48, paddingRight: 14, paddingLeft: 4, borderRadius: radii.surface, backgroundColor: '#F5F5F5' },
  input: { flex: 1, minWidth: 0, minHeight: 48, paddingVertical: 12, fontSize: 14, textAlign: 'right', writingDirection: 'rtl', color: '#202020' },
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  row: { direction: 'ltr', flexDirection: 'row-reverse', gap: 10 },
  countRow: { paddingTop: 2, paddingBottom: 14 },
  count: { fontSize: 12, lineHeight: 18, color: '#888888', textAlign: 'right' },
  empty: { paddingHorizontal: 24, paddingVertical: 54, alignItems: 'center', justifyContent: 'center', gap: 12 },
  heartDisc: { width: 68, height: 68, borderRadius: radii.pill, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 19, fontWeight: '600', color: '#202020', textAlign: 'center' },
  emptyText: { fontSize: 14, lineHeight: 22, color: '#818181', textAlign: 'center' },
  cta: { minHeight: 48, marginTop: 10, paddingHorizontal: 28, paddingVertical: 13, borderRadius: radii.surface, backgroundColor: storeAccent.primary, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: storeAccent.onPrimary, fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
