import React from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FavoriteProductsGrid } from '../../components/FavoriteProductsGrid';
import { Card } from '../../components/ui/Card';
import { safeNavigate } from '../../navigation/navigationRef';
import { useFavorites } from '../../state/FavoritesContext';
import { colors } from '../../theme/colors';
import { getStoreBottomBarMetrics, StoreFloatingTabBar, type StoreBottomTabId } from '../store/StoreHomeScreen';

const RTL_TEXT = {
  textAlign: 'right' as const,
  writingDirection: 'rtl' as const,
};

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
            padding: 16,
            gap: 16,
            paddingBottom: contentPaddingBottom + 8,
            width: '100%',
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: 'flex-end', gap: 10 }}>
            <Text style={{ color: '#C18D39', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, ...RTL_TEXT }}>אהבתי</Text>
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', ...RTL_TEXT }}>מוצרים ששמרתי</Text>
            <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21, ...RTL_TEXT }}>
              הנה כל המוצרים שסימנת עם לב מתוך החנות.
            </Text>
          </View>

          {isHydrating ? (
            <Card style={{ alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 28 }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ color: colors.muted, fontWeight: '700' }}>טוען את אהבתי…</Text>
            </Card>
          ) : null}

          {!isHydrating && !favorites.length ? (
            <Card style={{ alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 28 }}>
              <Ionicons name="heart-outline" size={34} color="#94A3B8" />
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 20, ...RTL_TEXT }}>עדיין לא שמרת מוצרים</Text>
              <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21, ...RTL_TEXT }}>
                ברגע שתסמן מוצר עם לב, הוא יופיע גם כאן.
              </Text>
            </Card>
          ) : null}

          {!isHydrating && favorites.length > 0 ? (
            <FavoriteProductsGrid
              favorites={favorites}
              isFavoritePending={isFavoritePending}
              onOpenProduct={(handle) => safeNavigate('Product', { handle })}
              onRemoveFavorite={removeFavorite}
            />
          ) : null}
        </ScrollView>

        <StoreFloatingTabBar activeTab="favorites" onTabPress={onTabPress} />
      </View>
    </SafeAreaView>
  );
}
