import { storeAccent } from '../theme/storeAccent';
import { radii } from '../theme/radii';
import React, { useEffect, useMemo, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModalSheet, SheetScrollView } from './ModalSheet';
import { catalogPriceError, EMPTY_CATALOG_FILTERS, filterCatalogProducts, type CatalogFilters, type CatalogSort } from '../lib/catalogFilters';
import type { StoreProduct } from '../screens/store/StoreHomeScreen';

const SORTS: { value: CatalogSort; label: string }[] = [
  { value: 'recommended', label: 'סדר מומלץ' }, { value: 'price-asc', label: 'מחיר: מהנמוך לגבוה' },
  { value: 'price-desc', label: 'מחיר: מהגבוה לנמוך' }, { value: 'name', label: 'לפי שם' },
];

export function CatalogFilterSheet({ visible, onClose, filters, onApply, products, query }: {
  visible: boolean; onClose: () => void; filters: CatalogFilters; onApply: (filters: CatalogFilters) => void;
  products: StoreProduct[]; query: string;
}) {
  const [draft, setDraft] = useState(filters);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  useEffect(() => { if (visible) setDraft({ ...filters, vendors: [...filters.vendors] }); }, [visible, filters]);
  const vendors = useMemo(() => [...new Set([...products.map(p => p.vendor?.trim()).filter((v): v is string => Boolean(v)), ...filters.vendors])].sort((a, b) => a.localeCompare(b, 'he')), [products, filters.vendors]);
  const error = catalogPriceError(draft);
  const count = useMemo(() => filterCatalogProducts(products, query, draft).length, [products, query, draft]);
  const close = () => { Keyboard.dismiss(); onClose(); };

  return (
    <ModalSheet visible={visible} onClose={close} dismissOnScroll containerStyle={{ backgroundColor: '#FFFFFF' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ height: height * 0.76 }}>
        <View style={styles.header}>
          <Text style={styles.title}>סינון ומיון</Text>
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="סגירת הסינון" style={styles.iconButton}><Ionicons name="close" size={21} color="#202124" /></Pressable>
        </View>
        <SheetScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.label}>איך להציג את המוצרים?</Text>
          <View style={styles.chips}>
            {SORTS.map(sort => <Pressable key={sort.value} onPress={() => setDraft(d => ({ ...d, sort: sort.value }))} accessibilityRole="radio" accessibilityState={{ checked: draft.sort === sort.value }} style={[styles.chip, draft.sort === sort.value && styles.chipSelected]}><Text style={[styles.chipText, draft.sort === sort.value && styles.chipTextSelected]}>{sort.label}</Text></Pressable>)}
          </View>
          <Text style={styles.label}>טווח מחיר</Text>
          <View style={styles.priceRow}>
            <View style={styles.priceField}><Text style={styles.caption}>ממחיר</Text><TextInput value={draft.minPrice} onChangeText={minPrice => setDraft(d => ({ ...d, minPrice }))} keyboardType="decimal-pad" placeholder="₪ 0" accessibilityLabel="מחיר מינימלי" maxLength={10} style={styles.input} /></View>
            <View style={styles.priceField}><Text style={styles.caption}>עד מחיר</Text><TextInput value={draft.maxPrice} onChangeText={maxPrice => setDraft(d => ({ ...d, maxPrice }))} keyboardType="decimal-pad" placeholder="ללא הגבלה" accessibilityLabel="מחיר מקסימלי" maxLength={10} style={styles.input} /></View>
          </View>
          {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : <Text style={styles.caption}>לפי מחיר המוצר, לפני הנחת המועדון</Text>}
          <View style={styles.toggleRow}><Text style={styles.toggleText}>זמין במלאי בלבד</Text><Switch value={draft.inStock} onValueChange={inStock => setDraft(d => ({ ...d, inStock }))} accessibilityLabel="זמין במלאי בלבד" trackColor={{ false: '#E4E4E4', true: storeAccent.primary }} thumbColor="#FFFFFF" /></View>
          <View style={styles.toggleRow}><Text style={styles.toggleText}>מוצרים במבצע בלבד</Text><Switch value={draft.saleOnly} onValueChange={saleOnly => setDraft(d => ({ ...d, saleOnly }))} accessibilityLabel="מוצרים במבצע בלבד" trackColor={{ false: '#E4E4E4', true: storeAccent.primary }} thumbColor="#FFFFFF" /></View>
          {vendors.length > 1 || draft.vendors.length > 0 ? <>
            <Text style={styles.label}>מותגים</Text>
            <View style={styles.chips}>{vendors.map(vendor => {
              const selected = draft.vendors.includes(vendor);
              return <Pressable key={vendor} onPress={() => setDraft(d => ({ ...d, vendors: selected ? d.vendors.filter(v => v !== vendor) : [...d.vendors, vendor] }))} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{vendor}</Text></Pressable>;
            })}</View>
          </> : null}
        </SheetScrollView>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable onPress={() => setDraft({ ...EMPTY_CATALOG_FILTERS, vendors: [] })} accessibilityRole="button" style={styles.reset}><Text style={styles.resetText}>איפוס</Text></Pressable>
          <Pressable disabled={Boolean(error)} onPress={() => { Keyboard.dismiss(); onApply(draft); }} accessibilityRole="button" accessibilityState={{ disabled: Boolean(error) }} style={[styles.apply, error && { opacity: 0.4 }]}><Text style={styles.applyText}>{error ? 'הצגת מוצרים' : `הצגת ${count} מוצרים`}</Text><Ionicons name="arrow-back" size={18} color={storeAccent.onPrimary} /></Pressable>
        </View>
      </KeyboardAvoidingView>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 22, lineHeight: 30, color: '#202124', fontWeight: '700' },
  iconButton: { width: 44, height: 44, borderRadius: radii.pill, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  label: { fontSize: 15, lineHeight: 22, color: '#202124', textAlign: 'right', fontWeight: '600', marginTop: 8 },
  chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 11, borderRadius: radii.pill, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#EEEEEE', justifyContent: 'center' },
  chipSelected: { backgroundColor: storeAccent.soft, borderColor: storeAccent.primary },
  chipText: { fontSize: 13, color: '#45474A', textAlign: 'center' },
  chipTextSelected: { color: storeAccent.ink },
  priceRow: { flexDirection: 'row-reverse', gap: 12 },
  priceField: { flex: 1, gap: 6 },
  caption: { color: '#85888C', fontSize: 12, lineHeight: 18, textAlign: 'right' },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#E3E3E3', borderRadius: radii.surface, paddingHorizontal: 14, color: '#202124', textAlign: 'right', fontSize: 16 },
  error: { color: '#B83B3B', fontSize: 12, textAlign: 'right', lineHeight: 19 },
  toggleRow: { minHeight: 52, borderBottomWidth: 1, borderBottomColor: '#EEEEEE', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  toggleText: { color: '#303236', fontSize: 14, flex: 1, textAlign: 'right' },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEEEEE', flexDirection: 'row-reverse', alignItems: 'center', gap: 16 },
  reset: { minHeight: 48, paddingHorizontal: 8, justifyContent: 'center' },
  resetText: { fontSize: 14, color: '#737373', textDecorationLine: 'underline' },
  apply: { flex: 1, minHeight: 50, borderRadius: radii.surface, backgroundColor: storeAccent.primary, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 14 },
  applyText: { color: storeAccent.onPrimary, fontWeight: '600', fontSize: 15 },
});
