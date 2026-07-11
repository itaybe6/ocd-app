import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FavoriteToggleButton } from './FavoriteToggleButton';
import { formatFavoritePrice } from '../lib/favorites';
import type { ProductFavoriteRow } from '../types/database';
import { STORE_GRID_CARD_BODY_HEIGHT } from '../theme/storeProductCardLayout';

/** Matches store category grid cards (`StoreCategoryScreen`). */
const storeProductCardShadowStyle = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.12,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 8,
};

type FavoriteProductsGridProps = {
  favorites: ProductFavoriteRow[];
  isFavoritePending: (productId: string) => boolean;
  onOpenProduct: (handle: string) => void;
  onRemoveFavorite: (productId: string) => void;
};

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
    <View
      style={{
        width: '48%',
        alignSelf: 'stretch',
        marginBottom: 18,
        borderRadius: 18,
        ...storeProductCardShadowStyle,
      }}
    >
      <View
        style={{
          flex: 1,
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
        }}
      >
        <Pressable onPress={() => onOpenProduct(favorite.product_handle)}>
          <View style={{ height: 160, backgroundColor: '#F4F6FA', overflow: 'hidden' }}>
            {favorite.image_url ? (
              <Image
                source={{ uri: favorite.image_url }}
                resizeMode="cover"
                accessibilityLabel={favorite.image_alt_text ?? favorite.product_title}
                style={{
                  width: '100%',
                  height: 160,
                  borderTopLeftRadius: 18,
                  borderTopRightRadius: 18,
                }}
              />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="image-outline" size={28} color="#94A3B8" />
              </View>
            )}

            <View style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
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
        </Pressable>

        <Pressable onPress={() => onOpenProduct(favorite.product_handle)}>
          <View
            style={{
              height: STORE_GRID_CARD_BODY_HEIGHT,
              paddingHorizontal: 12,
              paddingTop: 10,
              paddingBottom: 14,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: '#111827',
                fontSize: 16,
                fontWeight: '900',
                textAlign: 'right',
                height: 20,
              }}
            >
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
                marginTop: 4,
                height: 36,
              }}
            >
              {favorite.product_title}
            </Text>
            {!!favorite.product_type?.trim() ? (
              <Text
                numberOfLines={1}
                style={{ color: '#9AA3B2', fontSize: 10, textAlign: 'right', marginTop: 2, height: 14 }}
              >
                {favorite.product_type.trim()}
              </Text>
            ) : (
              <View style={{ marginTop: 2, height: 14 }} />
            )}
          </View>
        </Pressable>
      </View>
    </View>
  );
}

export function FavoriteProductsGrid({
  favorites,
  isFavoritePending,
  onOpenProduct,
  onRemoveFavorite,
}: FavoriteProductsGridProps) {
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        flexWrap: 'wrap',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      {favorites.map((favorite) => (
        <FavoriteProductCard
          key={favorite.id}
          favorite={favorite}
          isFavoritePending={isFavoritePending}
          onOpenProduct={onOpenProduct}
          onRemoveFavorite={onRemoveFavorite}
        />
      ))}
    </View>
  );
}
