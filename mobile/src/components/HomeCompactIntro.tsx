import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Package, Sparkles, TrendingUp } from 'lucide-react-native';
import type { StoreProduct } from '../screens/store/StoreHomeScreen';
import { radii } from '../theme/radii';

type CollectionPreview = { id: string; title: string; products: StoreProduct[] };
type Props = {
  sale: CollectionPreview;
  popular: CollectionPreview;
  newest: CollectionPreview;
  fallbackProducts: StoreProduct[];
  loading: boolean;
  onOpenProduct: (product: StoreProduct) => void;
  onOpenCollection: (id: string, title: string) => void;
};

function priceLabel(product: StoreProduct, amount = product.price) {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency', currency: product.currencyCode || 'ILS',
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(amount);
}

export function productDiscount(product: StoreProduct) {
  const before = product.compareAtPrice;
  return before != null && Number.isFinite(before) && Number.isFinite(product.price) && product.price > 0 && before > product.price
    ? Math.floor(((before - product.price) * 100) / before + 1e-9)
    : 0;
}

// Prefer real reductions and usable photos; keep collection order within each group.
export function selectEntryProducts(sale: StoreProduct[], catalog: StoreProduct[]) {
  const seen = new Set<string>();
  return [...sale, ...catalog].filter(product => {
    if (seen.has(product.id) || !product.availableForSale || !Number.isFinite(product.price) || product.price <= 0) return false;
    seen.add(product.id);
    return true;
  }).sort((a, b) => {
    const score = (product: StoreProduct) => (productDiscount(product) > 0 ? 2 : 0) + (product.imageUrl ? 1 : 0);
    return score(b) - score(a);
  }).slice(0, 2);
}

function OfferCard({ product, onPress }: { product: StoreProduct; onPress: () => void }) {
  const discount = productDiscount(product);
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${priceLabel(product)}${discount ? `, ${discount}% הנחה` : ''}`}
      style={styles.productTouch}>
      {({ pressed }) => (
        <View style={[styles.product, pressed && styles.pressed]}>
          <View style={styles.photo}>
            {product.imageUrl ? (
              <Image source={{ uri: product.imageUrl }} resizeMode="contain" style={styles.image} accessible={false} />
            ) : <Package size={42} color="#A5A5A5" strokeWidth={1.3} />}
            {discount > 0 ? <View style={styles.discount}><Text style={styles.discountText}>{discount}% הנחה</Text></View> : null}
          </View>
          <View style={styles.productBody}>
            <View style={styles.priceRow}>
              <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit>{priceLabel(product)}</Text>
              {discount > 0 ? <Text style={styles.oldPrice} numberOfLines={1}>{priceLabel(product, product.compareAtPrice!)}</Text> : null}
            </View>
            <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
            <View style={styles.productCta}>
              <Text style={styles.productCtaText}>לפרטי המוצר</Text>
              <ArrowLeft size={16} color="#FFFFFF" strokeWidth={1.7} />
            </View>
          </View>
        </View>
      )}
    </Pressable>
  );
}

export function HomeCompactIntro({ sale, popular, newest, fallbackProducts, loading, onOpenProduct, onOpenCollection }: Props) {
  const products = selectEntryProducts(sale.products, fallbackProducts);
  const hasDiscounts = products.some(product => productDiscount(product) > 0);
  const saleReady = sale.products.some(product => product.availableForSale);
  const openCollection = () => onOpenCollection(saleReady ? sale.id : 'all', saleReady ? sale.title : 'כל המוצרים');

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>{hasDiscounts ? 'המוצרים לבית. המחיר שעושה חשק.' : 'ניקיון · בישום · טיפוח הבית'}</Text>
          <Text style={styles.title}>{hasDiscounts ? 'שווה להכניס לסל' : 'הבחירות שלנו לבית'}</Text>
        </View>
        <Pressable onPress={openCollection} style={styles.allLink} accessibilityRole="button" accessibilityLabel={saleReady ? 'לכל המבצעים' : 'לכל המוצרים'}>
          <ArrowLeft size={21} color="#181818" strokeWidth={1.6} />
        </Pressable>
      </View>
      <View style={styles.products}>
        {products.map(product => <OfferCard key={product.id} product={product} onPress={() => onOpenProduct(product)} />)}
        {!products.length && loading ? [0, 1].map(key => (
          <View key={key} style={styles.skeletonCard} accessible={false}>
            <View style={styles.skeletonPhoto} /><View style={styles.skeletonPrice} /><View style={styles.skeletonLine} />
          </View>
        )) : null}
        {!products.length && !loading ? (
          <Pressable onPress={openCollection} style={styles.empty} accessibilityRole="button" accessibilityLabel="לכל המוצרים">
            <Package size={32} color="#6C6C6C" strokeWidth={1.4} />
            <Text style={styles.emptyTitle}>כל מה שהבית צריך</Text>
            <Text style={styles.emptyLink}>לכל המוצרים ←</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.shortcuts}>
        <Pressable onPress={() => onOpenCollection(popular.id, popular.title)} style={styles.shortcutTouch} accessibilityRole="button" accessibilityLabel={popular.title}>
          {({ pressed }) => (
            <View style={[styles.shortcut, pressed && styles.pressed]}>
              <TrendingUp size={19} color="#292929" strokeWidth={1.6} />
              <Text style={styles.shortcutText}>{popular.title}</Text>
              <ArrowLeft size={15} color="#777777" strokeWidth={1.5} />
            </View>
          )}
        </Pressable>
        <Pressable onPress={() => onOpenCollection(newest.id, newest.title)} style={styles.shortcutTouch} accessibilityRole="button" accessibilityLabel={newest.title}>
          {({ pressed }) => (
            <View style={[styles.shortcut, pressed && styles.pressed]}>
              <Sparkles size={19} color="#292929" strokeWidth={1.6} />
              <Text style={styles.shortcutText}>{newest.title}</Text>
              <ArrowLeft size={15} color="#777777" strokeWidth={1.5} />
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 14, paddingTop: 18, paddingBottom: 16, gap: 14, backgroundColor: '#FFFFFF' },
  heading: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  headingCopy: { flex: 1, minWidth: 0, alignItems: 'flex-end' },
  eyebrow: { fontSize: 11, lineHeight: 17, color: '#777777', textAlign: 'right', writingDirection: 'rtl' },
  title: { fontSize: 26, lineHeight: 34, fontWeight: '800', color: '#141414', textAlign: 'right', writingDirection: 'rtl' },
  allLink: { width: 44, height: 44, borderRadius: radii.pill, backgroundColor: '#F3F3F3', alignItems: 'center', justifyContent: 'center' },
  products: { flexDirection: 'row-reverse', gap: 12, alignItems: 'stretch' },
  productTouch: { flex: 1, minWidth: 0 },
  product: { flex: 1, borderRadius: radii.nested, borderWidth: 1, borderColor: '#EAEAEA', overflow: 'hidden', backgroundColor: '#FFFFFF' },
  photo: { width: '100%', height: 158, alignItems: 'center', justifyContent: 'center', paddingTop: 28, paddingBottom: 6, paddingHorizontal: 10 },
  image: { width: '100%', height: '100%' },
  discount: { position: 'absolute', top: 10, right: 10, borderRadius: 6, backgroundColor: '#F3D98B', paddingHorizontal: 8, paddingVertical: 4 },
  discountText: { color: '#29220E', fontSize: 11, lineHeight: 15, fontWeight: '700', writingDirection: 'rtl' },
  productBody: { paddingHorizontal: 10, paddingBottom: 10, gap: 8 },
  priceRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6 },
  price: { fontSize: 26, lineHeight: 32, fontWeight: '800', color: '#161616', writingDirection: 'ltr', flexShrink: 1 },
  oldPrice: { fontSize: 12, lineHeight: 17, color: '#8C8C8C', textDecorationLine: 'line-through', writingDirection: 'ltr' },
  name: { fontSize: 12, lineHeight: 18, height: 36, color: '#545454', textAlign: 'right', writingDirection: 'rtl' },
  productCta: { minHeight: 36, borderRadius: 8, backgroundColor: '#171717', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
  productCtaText: { color: '#FFFFFF', fontSize: 11, lineHeight: 16, fontWeight: '600', flexShrink: 1 },
  shortcuts: { flexDirection: 'row-reverse', gap: 10 },
  shortcutTouch: { flex: 1, minWidth: 0 },
  shortcut: { minHeight: 48, backgroundColor: '#F5F5F5', borderRadius: radii.compact, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  shortcutText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600', textAlign: 'right', color: '#292929' },
  pressed: { opacity: 0.75 },
  skeletonCard: { flex: 1, padding: 12, gap: 12, borderRadius: radii.nested, backgroundColor: '#F7F7F7' },
  skeletonPhoto: { height: 140, backgroundColor: '#EEEEEE', borderRadius: radii.compact },
  skeletonPrice: { height: 26, width: '60%', backgroundColor: '#E8E8E8', alignSelf: 'flex-end', borderRadius: 6 },
  skeletonLine: { height: 32, backgroundColor: '#EEEEEE', borderRadius: 6 },
  empty: { flex: 1, padding: 26, gap: 12, alignItems: 'center', backgroundColor: '#F7F7F7', borderRadius: radii.nested },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#292929' },
  emptyLink: { fontSize: 14, color: '#555555' },
});
