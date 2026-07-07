import React from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import type { RemoteBrand } from '../lib/brands';
import { normalizeBrandImageUrl, resolveBrandTone } from '../lib/brands';

type HomeBrandsCarouselProps = {
  brands: RemoteBrand[];
  loading?: boolean;
  edgeBleed?: number;
  onOpenBrand?: (brand: RemoteBrand) => void;
};

export function HomeBrandsCarousel({
  brands,
  loading = false,
  edgeBleed = 12,
  onOpenBrand,
}: HomeBrandsCarouselProps) {
  const visibleBrands = brands.filter((brand) => !brand.hiddenFromCarousel);

  if (loading && !visibleBrands.length) {
    return (
      <View style={{ paddingVertical: 24, alignItems: 'center' }}>
        <ActivityIndicator color="#111827" />
      </View>
    );
  }

  if (!visibleBrands.length) return null;

  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ alignItems: 'center', marginBottom: 10, paddingHorizontal: 4 }}>
        <Text
          style={{
            color: '#111827',
            fontSize: 22,
            fontWeight: '900',
            textAlign: 'center',
            letterSpacing: 0.2,
          }}
        >
          חברות נבחרות
        </Text>
        <Text
          style={{
            color: '#9CA3AF',
            fontSize: 13,
            fontWeight: '600',
            textAlign: 'center',
            marginTop: 6,
            lineHeight: 19,
            paddingHorizontal: 8,
          }}
        >
          לחצו על מותג כדי לצפות במוצרים
        </Text>
      </View>
      <View style={{ marginHorizontal: edgeBleed ? -edgeBleed : 0 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ direction: 'rtl' }}
          contentContainerStyle={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 2,
            paddingHorizontal: 0,
            paddingBottom: 4,
          }}
        >
          {visibleBrands.map((brand) => {
            const tone = resolveBrandTone(brand.tone);
            const imageUri = normalizeBrandImageUrl(brand.image);
            return (
              <Pressable
                key={brand.handle}
                onPress={() => onOpenBrand?.(brand)}
                style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
              >
                <View style={{ alignItems: 'center', gap: 6, width: 86 }}>
                  <View
                    style={{
                      width: 82,
                      height: 82,
                      borderRadius: 41,
                      padding: 3,
                      backgroundColor: '#FFFFFF',
                      borderWidth: 2,
                      borderColor: '#E8ECF2',
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        borderRadius: 38,
                        overflow: 'hidden',
                        backgroundColor: tone,
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
                          style={{
                            color: '#FFFFFF',
                            fontSize: 13,
                            fontWeight: '900',
                            letterSpacing: 0.3,
                          }}
                        >
                          {brand.short}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Text
                    numberOfLines={2}
                    style={{
                      color: '#374151',
                      fontSize: 11,
                      fontWeight: '700',
                      textAlign: 'center',
                      lineHeight: 14,
                      minHeight: 28,
                    }}
                  >
                    {brand.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}
