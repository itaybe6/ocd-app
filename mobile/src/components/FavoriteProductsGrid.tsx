import React, { useMemo } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FavoriteToggleButton } from './FavoriteToggleButton';
import { formatFavoritePrice } from '../lib/favorites';
import type { ProductFavoriteRow } from '../types/database';

/** Matches store category grid cards (`StoreCategoryScreen`). */
const storeProductCardShadowStyle = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.12,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 8,
};

const CARD_IMAGE_HEIGHT = 160;
const ROW_GAP = 12;

type FavoriteProductsGridProps = {
  favorites: ProductFavoriteRow[];
  isFavoritePending: (productId: string) => boolean;
  onOpenProduct: (handle: string) => void;
  onRemoveFavorite: (productId: string) => void;
};

function chunkPairs<T>(items: T[]): [T, T | undefined][] {
  const rows: [T, T | undefined][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push([items[i]!, items[i + 1]]);
  }
  return rows;
}

function FavoriteProductCard({
  favorite,
  isFavoritePending,
  onOpenProduct,
  onRemoveFavorite,
}: {
  favorite: ProductFavoriteRow;
  isFavoritePending: (productId: string) => boolean;
  onOpenProduct: (handle: string) => void;
  onRemoveFavorite: (productId: string) => void;
}) {
  return (
    <Pressable
      onPress={() => onOpenProduct(favorite.product_handle)}
      style={({ pressed }) => ({
        flex: 1,
        width: '100%',
        borderRadius: 18,
        ...storeProductCardShadowStyle,
        opacity: pressed ? 0.96 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      <View
        style={{
          flex: 1,
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
          width: '100%',
        }}
      >
        <View style={{ height: CARD_IMAGE_HEIGHT, backgroundColor: '#F4F6FA', overflow: 'hidden' }}>
          {favorite.image_url ? (
            <Image
              source={{ uri: favorite.image_url }}
              resizeMode="cover"
              accessibilityLabel={favorite.image_alt_text ?? favorite.product_title}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="image-outline" size={28} color="#94A3B8" />
            </View>
          )}

          <View style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }} pointerEvents="box-none">
            <FavoriteToggleButton
              active
              loading={isFavoritePending(favorite.product_id)}
              onPress={(event) => {
                event?.stopPropagation();
                void onRemoveFavorite(favorite.product_id);
              }}
              size={32}
            />
          </View>
        </View>

        <View
          style={{
            flex: 1,
            paddingHorizontal: 12,
            paddingTop: 10,
            paddingBottom: 12,
            justifyContent: 'flex-start',
          }}
        >
          <Text style={{ color: '#111827', fontSize: 16, fontWeight: '900', textAlign: 'right' }}>
            {formatFavoritePrice(favorite.price, favorite.currency_code)}
          </Text>
          <Text
            numberOfLines={2}
            style={{
              color: '#111827',
              fontSize: 13,
              lineHeight: 18,
              fontWeight: '700',
              textAlign: 'right',
              marginTop: 3,
            }}
          >
            {favorite.product_title}
          </Text>
          {!!favorite.product_type?.trim() ? (
            <Text
              numberOfLines={1}
              style={{ color: '#9AA3B2', fontSize: 10, textAlign: 'right', marginTop: 2 }}
            >
              {favorite.product_type.trim()}
            </Text>
          ) : (
            <View style={{ marginTop: 2, height: 14 }} />
          )}
        </View>
      </View>
    </Pressable>
  );
}

export function FavoriteProductsGrid({
  favorites,
  isFavoritePending,
  onOpenProduct,
  onRemoveFavorite,
}: FavoriteProductsGridProps) {
  const rows = useMemo(() => chunkPairs(favorites), [favorites]);

  return (
    <View style={{ width: '100%', alignSelf: 'stretch' }}>
      {rows.map((pair, rowIndex) => (
        <View
          key={`fav-row-${pair[0].id}-${pair[1]?.id ?? 'x'}`}
          style={{
            width: '100%',
            flexDirection: 'row-reverse',
            alignItems: 'stretch',
            marginBottom: rowIndex < rows.length - 1 ? ROW_GAP : 0,
            gap: ROW_GAP,
          }}
        >
          {pair.map((favorite, slotIndex) => (
            <View
              key={favorite?.id ?? `empty-${rowIndex}-${slotIndex}`}
              style={{
                flex: 1,
                minWidth: 0,
              }}
            >
              {favorite ? (
                <FavoriteProductCard
                  favorite={favorite}
                  isFavoritePending={isFavoritePending}
                  onOpenProduct={onOpenProduct}
                  onRemoveFavorite={onRemoveFavorite}
                />
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
