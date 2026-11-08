import React from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { ProductFavoriteRow } from '../types/database';
import type { RemoteBrand } from '../lib/brands';
import { fetchProductByHandle, type ShopifyProduct } from '../lib/shopify';
import { STORE_RESOURCES_KEY } from '../lib/storeResources';
import { toStoreProductLike } from '../lib/favorites';
import { isPurchasable, needsVariantSelection } from '../lib/homeShoppingFeed';
import { HomeHighlightRailCard, toStoreProduct } from '../screens/store/StoreHomeScreen';

/** Saved rows are display snapshots, never a source of cart variant IDs or stock. */
export function FavoriteCatalogCard({ favorite, liveProduct, width, brands, isSubscriber, pending, onRemove, onOpenProduct, onOpenMembership }: {
  favorite: ProductFavoriteRow;
  liveProduct?: ShopifyProduct;
  width: number;
  brands: RemoteBrand[];
  isSubscriber: boolean;
  pending: boolean;
  onRemove: () => void;
  onOpenProduct: (handle: string) => void;
  onOpenMembership: () => void;
}) {
  // Shares detail-page cache; only mounted rows missing from the catalog fetch.
  const details = useQuery({
    queryKey: [...STORE_RESOURCES_KEY, 'product', favorite.product_handle],
    queryFn: () => fetchProductByHandle(favorite.product_handle),
    enabled: !liveProduct && !!favorite.product_handle,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });
  const current = liveProduct ?? details.data;
  const product = current ? toStoreProduct(current, 0) : toStoreProductLike(favorite);
  const open = () => { Keyboard.dismiss(); onOpenProduct(product.handle); };
  return <View style={{ width, marginBottom: 14 }}>
    <HomeHighlightRailCard
      product={product} cardWidth={width} remoteBrands={brands}
      isOcdPlusSubscriber={isSubscriber} favorite favoritePending={pending}
      onPress={open} onToggleFavorite={onRemove} onOpenOcdPlusSheet={onOpenMembership}
      onChooseVariant={current && needsVariantSelection(product) ? open : undefined}
      canChooseVariant={!!current && isPurchasable(product)}
    />
    {!current && details.isError ? <Pressable onPress={() => { void details.refetch(); }} accessibilityRole="button" accessibilityLabel={`טעינה מחדש של ${product.name}`} style={styles.retry}><Text style={styles.status}>עדכון פרטי המוצר נכשל · לנסות שוב</Text></Pressable>
      : !current ? <Text style={styles.status}>{details.isPending ? 'מעדכנים מחיר וזמינות…' : 'המוצר אינו זמין כרגע'}</Text>
      : !isPurchasable(product) ? <Text style={styles.status}>אזל מהמלאי</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  status: { color: '#777777', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 6 },
  retry: { minHeight: 44, justifyContent: 'center' },
});
