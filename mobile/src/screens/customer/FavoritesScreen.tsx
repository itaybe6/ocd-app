import React from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FavoriteProductsGrid } from '../../components/FavoriteProductsGrid';
import { safeNavigate } from '../../navigation/navigationRef';
import { useFavorites } from '../../state/FavoritesContext';
import { colors } from '../../theme/colors';
import { getStoreBottomBarMetrics, StoreFloatingTabBar, type StoreBottomTabId } from '../store/StoreHomeScreen';

export function CustomerFavoritesScreen({
  onTabPress,
}: {
  onTabPress: (tabId: StoreBottomTabId) => void;
}) {
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const { favorites, isHydrating, isFavoritePending, removeFavorite } = useFavorites();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView
          style={{ flex: 1, width: '100%' }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            gap: 16,
            paddingBottom: contentPaddingBottom + 8,
            width: '100%',
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── כותרת ── */}
          <View style={{ paddingVertical: 12, gap: 4 }}>
            <Text
              style={{
                fontSize: 26,
                fontWeight: '800',
                color: '#0F172A',
                textAlign: 'right',
                letterSpacing: -0.5,
              }}
            >
              המוצרים שאהבתי
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '500',
                color: '#94A3B8',
                textAlign: 'right',
              }}
            >
              {favorites.length > 0
                ? `${favorites.length} מוצר${favorites.length === 1 ? '' : 'ים'} שמורים`
                : 'שמור מוצרים שאהבת לצפייה מאוחרת'}
            </Text>
          </View>

          {/* ── טעינה ── */}
          {isHydrating && (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
              <ActivityIndicator size="large" color="#0F172A" />
            </View>
          )}

          {/* ── מצב ריק ── */}
          {!isHydrating && !favorites.length && (
            <View
              style={{
                marginTop: 24,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 20,
                paddingVertical: 56,
                paddingHorizontal: 32,
                backgroundColor: '#FFFFFF',
                borderRadius: 28,
                borderWidth: 1,
                borderColor: '#F1F5F9',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 12,
                elevation: 2,
              }}
            >
              {/* אייקון לב */}
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: '#F8FAFC',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.5,
                  borderColor: '#E2E8F0',
                }}
              >
                <Ionicons name="heart-outline" size={36} color="#CBD5E1" />
              </View>

              {/* טקסט */}
              <View style={{ alignItems: 'center', gap: 8 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: '#0F172A',
                    textAlign: 'center',
                    letterSpacing: -0.3,
                  }}
                >
                  עדיין אין מוצרים שאהבת
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '400',
                    color: '#94A3B8',
                    textAlign: 'center',
                    lineHeight: 22,
                  }}
                >
                  כשתמצא מוצר שאהבת, לחץ על הלב{'\n'}והוא יישמר כאן לצפייה מאוחרת
                </Text>
              </View>

              {/* הינט גרפי */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: '#F1F5F9',
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                }}
              >
                <Ionicons name="heart" size={13} color="#94A3B8" />
                <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '600' }}>
                  לחץ על הלב בכל מוצר
                </Text>
              </View>
            </View>
          )}

          {/* ── רשת מוצרים ── */}
          {!isHydrating && favorites.length > 0 && (
            <FavoriteProductsGrid
              favorites={favorites}
              isFavoritePending={isFavoritePending}
              onOpenProduct={(handle) => safeNavigate('Product', { handle })}
              onRemoveFavorite={removeFavorite}
            />
          )}
        </ScrollView>

        <StoreFloatingTabBar activeTab="favorites" onTabPress={onTabPress} />
      </View>
    </SafeAreaView>
  );
}
