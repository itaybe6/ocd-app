import React from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FavoriteProductsGrid } from '../../components/FavoriteProductsGrid';
import { Card } from '../../components/ui/Card';
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
            padding: 16,
            gap: 16,
            paddingBottom: contentPaddingBottom + 8,
            width: '100%',
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {isHydrating ? (
            <Card style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 28 }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </Card>
          ) : null}

          {!isHydrating && !favorites.length ? (
            <Card style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 28 }}>
              <Ionicons name="heart-outline" size={34} color="#94A3B8" />
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
