import React, { useMemo } from 'react';
import { Image, Text, View } from 'react-native';
import { findProductBrand, normalizeBrandImageUrl, resolveBrandTone, type RemoteBrand } from '../lib/brands';

type ProductBrandBadgeProps = {
  product: {
    name?: string;
    tags?: string[];
    collectionHandles?: string[];
    collectionTitles?: string[];
  };
  brands: RemoteBrand[];
  size?: number;
  bottom?: number;
  top?: number;
  right?: number;
  zIndex?: number;
};

function resolveBrandBadgeBackground(brand: RemoteBrand, hasImage: boolean): string {
  const raw = brand.tone?.trim().toLowerCase();
  if (hasImage && (raw === '#fff' || raw === '#ffffff')) {
    return '#0B2447';
  }
  return resolveBrandTone(brand.tone);
}

const BADGE_SHADOW = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.14,
  shadowRadius: 5,
  shadowOffset: { width: 0, height: 2 },
  elevation: 3,
} as const;

export function ProductBrandBadge({
  product,
  brands,
  size = 36,
  bottom = 10,
  top,
  right = 10,
  zIndex = 3,
}: ProductBrandBadgeProps) {
  const brand = useMemo(
    () =>
      findProductBrand(
        {
          tags: product.tags,
          collectionHandles: product.collectionHandles,
          collectionTitles: product.collectionTitles,
        },
        brands,
      ),
    [brands, product.tags, product.collectionHandles, product.collectionTitles],
  );

  if (!brand) return null;

  const imageUri = normalizeBrandImageUrl(brand.image);
  const tone = resolveBrandBadgeBackground(brand, !!imageUri);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        ...(top !== undefined ? { top } : { bottom }),
        right,
        zIndex,
        width: size,
        height: size,
        borderRadius: size / 2,
        ...BADGE_SHADOW,
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor: imageUri ? '#FFFFFF' : tone,
          borderWidth: 2,
          borderColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            resizeMode="cover"
            accessibilityLabel={brand.label}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
            style={{
              color: '#FFFFFF',
              fontSize: Math.max(8, Math.round(size * 0.28)),
              fontWeight: '900',
              paddingHorizontal: 3,
              textAlign: 'center',
            }}
          >
            {brand.short}
          </Text>
        )}
      </View>
    </View>
  );
}
