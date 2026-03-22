import React from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FavoriteToggleButton } from '../../components/FavoriteToggleButton';
import { Card } from '../../components/ui/Card';
import { formatFavoritePrice } from '../../lib/favorites';
import { safeNavigate } from '../../navigation/navigationRef';
import { useFavorites } from '../../state/FavoritesContext';
import { colors } from '../../theme/colors';

const RTL_TEXT = {
  textAlign: 'right' as const,
  writingDirection: 'rtl' as const,
};

export function CustomerFavoritesScreen() {
  const { favorites, isHydrating, isFavoritePending, removeFavorite } = useFavorites();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 14 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ alignItems: 'flex-end', gap: 8 }}>
        <Text style={{ color: '#C18D39', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, ...RTL_TEXT }}>אהבתי</Text>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '900', ...RTL_TEXT }}>מוצרים ששמרתי</Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, ...RTL_TEXT }}>
          הנה כל המוצרים שסימנת עם לב מתוך החנות.
        </Text>
      </View>

      {isHydrating ? (
        <Card style={{ alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 28 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textMuted, fontWeight: '700' }}>טוען את אהבתי…</Text>
        </Card>
      ) : null}

      {!isHydrating && !favorites.length ? (
        <Card style={{ alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 28 }}>
          <Ionicons name="heart-outline" size={34} color="#94A3B8" />
          <Text style={{ color: colors.text, fontWeight: '900', fontSize: 20, ...RTL_TEXT }}>עדיין לא שמרת מוצרים</Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, ...RTL_TEXT }}>
            ברגע שתסמן מוצר עם לב, הוא יופיע גם כאן.
          </Text>
        </Card>
      ) : null}

      {!isHydrating &&
        favorites.map((favorite) => (
          <Pressable
            key={favorite.id}
            onPress={() => safeNavigate('Product', { handle: favorite.product_handle })}
            style={({ pressed }) => ({
              backgroundColor: '#FFFFFF',
              borderRadius: 22,
              borderWidth: 1,
              borderColor: '#E9EEF5',
              overflow: 'hidden',
              opacity: pressed ? 0.97 : 1,
            })}
          >
            <View style={{ flexDirection: 'row-reverse', alignItems: 'stretch' }}>
              <View style={{ width: 122, padding: 10 }}>
                {favorite.image_url ? (
                  <Image
                    source={{ uri: favorite.image_url }}
                    resizeMode="cover"
                    accessibilityLabel={favorite.image_alt_text ?? favorite.product_title}
                    style={{ width: '100%', height: 128, borderRadius: 18, backgroundColor: '#F8FAFC' }}
                  />
                ) : (
                  <View
                    style={{
                      width: '100%',
                      height: 128,
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#E2E8F0',
                    }}
                  >
                    <Ionicons name="image-outline" size={30} color="#64748B" />
                  </View>
                )}
              </View>

              <View
                style={{
                  flex: 1,
                  paddingHorizontal: 14,
                  paddingVertical: 14,
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ width: '100%', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <FavoriteToggleButton
                    active
                    loading={isFavoritePending(favorite.product_id)}
                    onPress={(event) => {
                      event?.stopPropagation();
                      void removeFavorite(favorite.product_id);
                    }}
                    size={38}
                  />

                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text numberOfLines={2} style={{ color: colors.text, fontSize: 16, fontWeight: '900', ...RTL_TEXT }}>
                      {favorite.product_title}
                    </Text>
                    <Text style={{ marginTop: 4, color: colors.textMuted, fontSize: 12, ...RTL_TEXT }}>
                      {favorite.product_type?.trim() || 'מוצר'}
                    </Text>
                  </View>
                </View>

                <Text numberOfLines={2} style={{ marginTop: 10, color: '#6B7280', fontSize: 12, lineHeight: 18, ...RTL_TEXT }}>
                  {favorite.product_description?.trim() || 'מוצר שנשמר לעמוד אהבתי שלך.'}
                </Text>

                <View style={{ width: '100%', marginTop: 14, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      backgroundColor: '#FEE2E2',
                    }}
                  >
                    <Text style={{ color: '#B91C1C', fontWeight: '800', fontSize: 11 }}>נשמר באהבתי</Text>
                  </View>

                  <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>
                    {formatFavoritePrice(favorite.price, favorite.currency_code)}
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>
        ))}
    </ScrollView>
  );
}
