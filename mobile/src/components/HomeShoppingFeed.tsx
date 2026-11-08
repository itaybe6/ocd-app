import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronDown, SlidersHorizontal, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModalSheet } from './ModalSheet';
import { HomeCategoryIcon } from './HomeCategoryIcon';
import { HomePromotionBanner } from './HomePromotionBanner';
import type { StoreProduct } from '../screens/store/StoreHomeScreen';
import { HOME_FEED_PAGE_SIZE, selectHomeFeedProducts, type HomeFeedMode } from '../lib/homeShoppingFeed';
import { storeAccent } from '../theme/storeAccent';
import { radii } from '../theme/radii';

type Collection = { id: string; title: string; products: StoreProduct[] };
export type HomeFeedCategory = { id: string; title: string; imageUrl?: string | null };
type Props = {
  catalog: StoreProduct[];
  sale: Collection;
  popular: Collection;
  newest: Collection;
  categories: HomeFeedCategory[];
  loading: boolean;
  error?: string | null;
  onRetry: () => void;
  onOpenProduct: (product: StoreProduct) => void;
  onOpenCollection: (id: string, title: string) => void;
  renderProduct: (product: StoreProduct, onOpen: () => void) => React.ReactNode;
};
const PAGE_SIZE = HOME_FEED_PAGE_SIZE;
const feedTitles: Record<HomeFeedMode, string> = {
  all: 'כל המוצרים', sale: 'המבצעים שלנו', popular: 'הכי נמכרים', new: 'חדש אצלנו',
};

export function HomeShoppingFeed({ catalog, sale, popular, newest, categories, loading, error, onRetry, onOpenProduct, onOpenCollection, renderProduct }: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<HomeFeedMode>('popular');
  const [filterOpen, setFilterOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const products = useMemo(() => selectHomeFeedProducts(mode, catalog, sale.products, popular.products, newest.products), [mode, catalog, sale.products, popular.products, newest.products]);
  const shown = products.slice(0, limit);
  const rows = Array.from({ length: Math.ceil(shown.length / 2) }, (_, i) => shown.slice(i * 2, i * 2 + 2));
  const filterOptions: { id: HomeFeedMode; title: string }[] = [
    { id: 'all', title: 'הכל' }, { id: 'sale', title: 'מבצעים' },
    { id: 'popular', title: 'הכי נמכרים' },
    { id: 'new', title: 'חדש אצלנו' },
  ];

  return (
    <View style={styles.container}>
      <HomePromotionBanner />
      {categories.length ? <FlatList
        horizontal inverted data={categories} keyExtractor={category => category.id}
        showsHorizontalScrollIndicator={false} initialNumToRender={6}
        style={styles.categories} contentContainerStyle={styles.categoryContent}
        renderItem={({ item }) => (
          <Pressable onPress={() => onOpenCollection(item.id, item.title)} style={styles.category} accessibilityRole="button" accessibilityLabel={`קטגוריית ${item.title}`}>
            <View style={styles.categoryIcon}>
              <HomeCategoryIcon id={item.id} title={item.title} />
            </View>
            <Text style={styles.categoryText} numberOfLines={2} ellipsizeMode="tail">{item.title}</Text>
          </Pressable>
        )}
      /> : null}
      <View style={styles.feedToolbar}>
        <Text style={styles.feedTitle} accessibilityRole="header">{feedTitles[mode]}</Text>
        <Pressable onPress={() => setFilterOpen(true)} accessibilityRole="button" accessibilityLabel="מיון וסינון" accessibilityState={{ expanded: filterOpen }} accessibilityValue={{ text: feedTitles[mode] }} style={styles.filterButton}>
          {({ pressed }) => <View style={[styles.filterButtonContent, pressed && styles.pressed]}>
            <SlidersHorizontal size={14} color={storeAccent.ink} strokeWidth={1.4} />
            <Text style={styles.filterButtonText} numberOfLines={1}>מיון וסינון</Text>
          </View>}
        </Pressable>
      </View>
      <ModalSheet visible={filterOpen} onClose={() => setFilterOpen(false)} containerStyle={{ maxHeight: '80%', paddingBottom: Math.max(insets.bottom, 16) }}>
        <View style={styles.filterSheetHeader}>
          <Text style={styles.filterSheetTitle} accessibilityRole="header">מיון וסינון</Text>
          <Pressable onPress={() => setFilterOpen(false)} accessibilityRole="button" accessibilityLabel="סגירת מיון וסינון" style={styles.closeFilter}>
            <View style={styles.closeFilterDisc}><X size={17} color="#555555" strokeWidth={1.7} /></View>
          </Pressable>
        </View>
        <ScrollView style={styles.filterList} contentContainerStyle={styles.filterListContent}>
          {filterOptions.map(option => <Pressable key={option.id} onPress={() => { setMode(option.id); setLimit(PAGE_SIZE); setFilterOpen(false); }} accessibilityRole="radio" accessibilityLabel={option.title} accessibilityState={{ checked: mode === option.id }}>
            {({ pressed }) => <View style={[styles.filterOption, mode === option.id && styles.selectedFilter, pressed && styles.pressed]}>
              <View style={[styles.filterRadio, mode === option.id && styles.filterRadioSelected]}>
                {mode === option.id ? <Check size={12} color={storeAccent.onPrimary} strokeWidth={2.3} /> : null}
              </View>
              <Text style={[styles.filterOptionText, mode === option.id && styles.selectedFilterText]}>{option.title}</Text>
            </View>}
          </Pressable>)}
        </ScrollView>
      </ModalSheet>
      <View style={styles.grid}>
        {rows.map(row => <View key={row[0].id} style={styles.row}>
          {row.map(product => <View key={product.id} style={styles.productSlot}>{renderProduct(product, () => onOpenProduct(product))}</View>)}
          {row.length === 1 ? <View style={styles.spacer} /> : null}
        </View>)}
        {loading && !shown.length ? <View style={styles.notice}><ActivityIndicator color="#202020" /><Text style={styles.noticeText}>טוענים מוצרים...</Text></View> : null}
        {!loading && !shown.length ? <View style={styles.notice}>
          <Text style={styles.noticeText}>{error ? 'לא הצלחנו לטעון מוצרים' : mode === 'sale' ? 'אין כרגע מוצרים במבצע' : 'אין כרגע מוצרים להצגה'}</Text>
          <Pressable onPress={error ? onRetry : () => { setMode('all'); setLimit(PAGE_SIZE); }} style={styles.more} accessibilityRole="button"><Text style={styles.moreText}>{error ? 'ניסיון נוסף' : 'לכל המוצרים'}</Text></Pressable>
        </View> : null}
        {shown.length < products.length ? <Pressable onPress={() => setLimit(value => value + PAGE_SIZE)} style={styles.loadMoreTouch} accessibilityRole="button" accessibilityLabel="עוד מוצרים" accessibilityHint="מציג עד שמונה מוצרים נוספים">
          {({ pressed }) => <View style={[styles.loadMoreButton, pressed && styles.pressed]}>
            <Text style={styles.loadMoreText}>עוד מוצרים</Text>
            <ChevronDown size={16} color={storeAccent.ink} strokeWidth={1.6} />
          </View>}
        </Pressable> : null}
        {mode === 'new' && shown.length > 0 && shown.length === products.length ? <Pressable onPress={() => onOpenCollection(newest.id, newest.title)} style={styles.more} accessibilityRole="button"><Text style={styles.moreText}>לכל החדשים בחנות</Text></Pressable> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#FFFFFF', paddingBottom: 18 },
  categories: { direction: 'ltr', marginTop: 16 },
  categoryContent: { paddingHorizontal: 10, gap: 4 },
  category: { width: 74, flexShrink: 0, alignItems: 'center', gap: 6 },
  categoryIcon: { width: 60, height: 60, borderRadius: radii.pill, backgroundColor: storeAccent.soft, alignItems: 'center', justifyContent: 'center' },
  categoryText: { width: 74, maxWidth: 74, minHeight: 28, color: '#505050', fontSize: 10, lineHeight: 14, fontWeight: '500', textAlign: 'center', writingDirection: 'rtl' },
  feedToolbar: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingHorizontal: 14, marginTop: 8, marginBottom: 8 },
  feedTitle: { flex: 1, fontSize: 20, lineHeight: 26, fontWeight: '800', color: '#202020', textAlign: 'right', writingDirection: 'rtl' },
  filterButton: { flexShrink: 0, minHeight: 44, justifyContent: 'center' },
  filterButtonContent: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 36, paddingHorizontal: 4, paddingVertical: 7 },
  filterButtonText: { flexShrink: 0, fontSize: 12, lineHeight: 18, fontWeight: '400', color: storeAccent.ink, textAlign: 'right', writingDirection: 'rtl' },
  filterSheetHeader: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 },
  filterSheetTitle: { flex: 1, fontSize: 20, lineHeight: 28, fontWeight: '700', color: '#202020', textAlign: 'right', writingDirection: 'rtl' },
  closeFilter: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeFilterDisc: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F3F3F3', alignItems: 'center', justifyContent: 'center' },
  filterList: { flexShrink: 1 },
  filterListContent: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  filterOption: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 15, borderRadius: radii.compact },
  selectedFilter: { backgroundColor: storeAccent.soft },
  filterRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#D0D0D0', alignItems: 'center', justifyContent: 'center' },
  filterRadioSelected: { borderColor: storeAccent.primary, backgroundColor: storeAccent.primary },
  filterOptionText: { flex: 1, fontSize: 15, lineHeight: 22, color: '#555555', textAlign: 'right', writingDirection: 'rtl' },
  selectedFilterText: { color: storeAccent.ink, fontWeight: '600' },
  grid: { paddingHorizontal: 16, gap: 12 },
  row: { flexDirection: 'row-reverse', gap: 10, alignItems: 'stretch' },
  productSlot: { flex: 1, minWidth: 0 },
  spacer: { flex: 1 },
  pressed: { opacity: 0.65 },
  notice: { padding: 24, gap: 12, alignItems: 'center' },
  noticeText: { fontSize: 13, lineHeight: 19, color: '#777777', textAlign: 'center' },
  more: { minHeight: 44, backgroundColor: '#F3F3F3', borderRadius: radii.compact, padding: 12, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 13, fontWeight: '600', color: '#333333' },
  loadMoreTouch: { alignSelf: 'center', marginTop: 6, minHeight: 48, justifyContent: 'center' },
  loadMoreButton: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 42, minWidth: 148, paddingHorizontal: 22, paddingVertical: 10, borderWidth: 1, borderColor: storeAccent.border, borderRadius: radii.pill, backgroundColor: '#FFFFFF' },
  loadMoreText: { color: storeAccent.ink, fontSize: 13, lineHeight: 20, fontWeight: '500', writingDirection: 'rtl' },
});
