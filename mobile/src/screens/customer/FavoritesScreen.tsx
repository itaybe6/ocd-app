import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FavoriteProductsGrid } from '../../components/FavoriteProductsGrid';
import { safeNavigate } from '../../navigation/navigationRef';
import { useFavorites } from '../../state/FavoritesContext';
import { colors } from '../../theme/colors';
import { getStoreBottomBarMetrics, StoreFloatingTabBar, type StoreBottomTabId } from '../store/StoreHomeScreen';

const INK = '#111827';
const MUTED = '#6B7280';

export function CustomerFavoritesScreen({
  onTabPress,
}: {
  onTabPress: (tabId: StoreBottomTabId) => void;
}) {
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const { favorites, isHydrating, isFavoritePending, removeFavorite } = useFavorites();
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();
  const filteredFavorites = useMemo(() => {
    if (!normalizedQuery) return favorites;
    return favorites.filter((favorite) => {
      const haystack = [
        favorite.product_title,
        favorite.product_type ?? '',
        favorite.product_description ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [favorites, normalizedQuery]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View
          style={{
            backgroundColor: colors.bg,
            borderBottomWidth: 1,
            borderBottomColor: '#F0F0F0',
            minHeight: 52,
            paddingHorizontal: 16,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: INK,
              fontSize: 17,
              fontWeight: '900',
              textAlign: 'center',
            }}
          >
            אהבתי
          </Text>
        </View>

        <ScrollView
          style={{ flex: 1, width: '100%' }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            gap: 16,
            paddingBottom: contentPaddingBottom + 8,
            width: '100%',
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View
            style={{
              backgroundColor: '#F3F4F6',
              borderRadius: 22,
              paddingHorizontal: 14,
              paddingVertical: 12,
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 8,
              minHeight: 48,
            }}
          >
            <Ionicons name="search-outline" size={18} color="#9CA3AF" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="חיפוש במוצרים שאהבתי"
              placeholderTextColor="#B7BDC8"
              style={{
                flex: 1,
                color: INK,
                textAlign: 'right',
                fontSize: 13,
                backgroundColor: '#F3F4F6',
                padding: 0,
              }}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="נקה חיפוש">
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </Pressable>
            ) : null}
          </View>

          {!isHydrating && favorites.length > 0 ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: MUTED, fontSize: 13, fontWeight: '700', textAlign: 'right' }}>
                {normalizedQuery
                  ? `${filteredFavorites.length} מתוך ${favorites.length} מוצרים`
                  : `${favorites.length} מוצר${favorites.length === 1 ? '' : 'ים'}`}
              </Text>
            </View>
          ) : null}

          {isHydrating ? (
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 60,
                gap: 12,
              }}
            >
              <ActivityIndicator size="large" color={INK} />
              <Text style={{ color: INK, fontSize: 14, fontWeight: '700' }}>טוען מוצרים שאהבת…</Text>
            </View>
          ) : null}

          {!isHydrating && !favorites.length ? (
            <View
              style={{
                marginTop: 8,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                paddingVertical: 48,
                paddingHorizontal: 24,
              }}
            >
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: '#F8FAFC',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.5,
                  borderColor: '#E2E8F0',
                }}
              >
                <Ionicons name="heart-outline" size={32} color="#CBD5E1" />
              </View>

              <View style={{ alignItems: 'center', gap: 8 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '800',
                    color: INK,
                    textAlign: 'center',
                  }}
                >
                  עדיין אין מוצרים שאהבת
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: MUTED,
                    textAlign: 'center',
                    lineHeight: 21,
                  }}
                >
                  כשתמצא מוצר שאהבת, לחץ על הלב{'\n'}והוא יישמר כאן לצפייה מאוחרת
                </Text>
              </View>

              <Pressable
                onPress={() => onTabPress('home')}
                style={({ pressed }) => ({
                  marginTop: 4,
                  height: 48,
                  paddingHorizontal: 28,
                  borderRadius: 16,
                  backgroundColor: INK,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.92 : 1,
                })}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>לגלות מוצרים</Text>
              </Pressable>
            </View>
          ) : null}

          {!isHydrating && favorites.length > 0 && filteredFavorites.length === 0 ? (
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                paddingVertical: 48,
              }}
            >
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: '#F8FAFC',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.5,
                  borderColor: '#E2E8F0',
                }}
              >
                <Ionicons name="search-outline" size={28} color="#CBD5E1" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: INK, textAlign: 'center' }}>
                לא נמצאו מוצרים
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: MUTED, textAlign: 'center' }}>
                נסה מילת חיפוש אחרת
              </Text>
            </View>
          ) : null}

          {!isHydrating && filteredFavorites.length > 0 ? (
            <FavoriteProductsGrid
              favorites={filteredFavorites}
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
