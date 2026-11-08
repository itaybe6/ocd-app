import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StoreProduct } from '../screens/store/StoreHomeScreen';
import { radii } from '../theme/radii';

const PAGE_SIZE = 8;
export function HomeSearchResults({ query, products, loading, error, onRetry, onClear, renderProduct }: {
  query: string;
  products: StoreProduct[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onClear: () => void;
  renderProduct: (product: StoreProduct) => React.ReactNode;
}) {
  const [page, setPage] = useState({ query, limit: PAGE_SIZE });
  const limit = page.query === query ? page.limit : PAGE_SIZE;
  useEffect(() => setPage({ query, limit: PAGE_SIZE }), [query]);
  const shown = products.slice(0, limit);
  const rows = Array.from({ length: Math.ceil(shown.length / 2) }, (_, i) => shown.slice(i * 2, i * 2 + 2));
  return <View style={styles.container}>
    <View style={styles.heading}>
      <Text style={styles.title} accessibilityRole="header">תוצאות החיפוש</Text>
      {loading ? <ActivityIndicator size="small" color="#777777" /> : null}
      <Text style={styles.muted}>{products.length} מוצרים{loading ? ' בינתיים' : ''}</Text>
    </View>
    {error && products.length > 0 ? <Pressable onPress={onRetry} accessibilityRole="button" style={styles.notice}><Text style={styles.muted}>לא הצלחנו לעדכן את כל התוצאות · לניסיון נוסף</Text></Pressable> : null}
    {rows.map(row => <View key={row[0].id} style={styles.row}>
      {row.map(product => <View key={product.id} style={styles.slot}>{renderProduct(product)}</View>)}
      {row.length === 1 ? <View style={styles.slot} /> : null}
    </View>)}
    {!shown.length ? <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{loading ? 'מחפשים את המוצר שלכם…' : error ? 'לא הצלחנו לעדכן את החיפוש' : 'לא מצאנו מוצרים מתאימים'}</Text>
      <Text style={styles.muted}>{loading ? 'התוצאות יופיעו כאן ברגע שיגיעו.' : error ? 'אפשר לנסות שוב בעוד רגע.' : 'נסו שם מוצר אחר או חלק מהשם.'}</Text>
      {!loading ? <Pressable onPress={error ? onRetry : onClear} accessibilityRole="button" style={styles.button}><Text>{error ? 'ניסיון נוסף' : 'ניקוי החיפוש'}</Text></Pressable> : null}
    </View> : null}
    {shown.length < products.length ? <Pressable onPress={() => setPage({ query, limit: limit + PAGE_SIZE })} accessibilityRole="button" accessibilityLabel="עוד תוצאות" style={styles.button}><Text>עוד תוצאות</Text></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  heading: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingTop: 18, paddingBottom: 6 },
  title: { flex: 1, fontSize: 18, fontWeight: '600', color: '#202020', textAlign: 'right' },
  muted: { fontSize: 12, lineHeight: 20, color: '#818181', textAlign: 'center' },
  row: { direction: 'ltr', flexDirection: 'row-reverse', gap: 10 },
  slot: { flex: 1, minWidth: 0 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#343434', textAlign: 'center' },
  notice: { padding: 12, borderRadius: radii.compact, backgroundColor: '#F7F7F7' },
  button: { alignSelf: 'center', minHeight: 44, paddingHorizontal: 24, paddingVertical: 12, borderRadius: radii.pill, borderWidth: 1, borderColor: '#E7E7E7', backgroundColor: '#FFFFFF' },
});
