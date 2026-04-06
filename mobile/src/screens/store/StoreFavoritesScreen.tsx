import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FavoriteProductsGrid } from '../../components/FavoriteProductsGrid';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { useFavorites } from '../../state/FavoritesContext';
import { useAuth } from '../../state/AuthContext';
import { colors } from '../../theme/colors';
import { getStoreBottomBarMetrics, StoreFloatingTabBar, type StoreBottomTabId } from './StoreHomeScreen';

const RTL_TEXT = {
  textAlign: 'right' as const,
  writingDirection: 'rtl' as const,
};

export function StoreFavoritesScreen({
  onOpenProduct,
  onTabPress,
  onLoginPress,
}: {
  onOpenProduct: (handle: string) => void;
  onTabPress: (tabId: StoreBottomTabId) => void;
  onLoginPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const { user } = useAuth();
  const { favorites, isHydrating, isFavoritePending, removeFavorite } = useFavorites();

  if (!user || user.role !== 'customer') {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1 }}>
          <Screen padded={false}>
            <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 18, paddingBottom: contentPaddingBottom }}>
              <Card style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                <View
                  style={{
                    width: 70,
                    height: 70,
                    borderRadius: 35,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#FEE2E2',
                  }}
                >
                  <Ionicons name="heart" size={30} color="#DC2626" />
                </View>
                <Text style={{ color: colors.text, fontWeight: '900', fontSize: 22, ...RTL_TEXT }}>
                  עמוד אהבתי זמין ללקוחות מחוברים
                </Text>
                <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21, ...RTL_TEXT }}>
                  התחבר כלקוח כדי לשמור מוצרים ולראות כאן את כל הפריטים שאהבת.
                </Text>
                <Pressable
                  onPress={onLoginPress}
                  style={({ pressed }) => ({
                    marginTop: 6,
                    borderRadius: 18,
                    paddingHorizontal: 24,
                    paddingVertical: 14,
                    backgroundColor: pressed ? '#1E293B' : '#0F172A',
                  })}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 15 }}>להתחברות</Text>
                </Pressable>
              </Card>
            </View>
          </Screen>
          <StoreFloatingTabBar activeTab="favorites" onTabPress={onTabPress} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1, width: '100%' }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 18,
            paddingBottom: contentPaddingBottom + 8,
            gap: 16,
            width: '100%',
          }}
        >
          <View style={{ alignItems: 'flex-end', gap: 10 }}>
            <Text style={{ color: '#C18D39', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, ...RTL_TEXT }}>אהבתי</Text>
            <Text style={{ color: colors.text, fontSize: 30, fontWeight: '800', ...RTL_TEXT }}>המוצרים ששמרת</Text>
            <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21, ...RTL_TEXT }}>
              כל מוצר שתסמן עם לב יישמר כאן תחת המשתמש שלך.
            </Text>
          </View>

          {isHydrating ? (
            <Card style={{ alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 24 }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ color: colors.muted, fontWeight: '700' }}>טוען את אהבתי…</Text>
            </Card>
          ) : null}

          {!isHydrating && !favorites.length ? (
            <Card style={{ alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 28 }}>
              <Ionicons name="heart-outline" size={34} color="#94A3B8" />
              <Text style={{ color: colors.text, fontWeight: '900', fontSize: 20, ...RTL_TEXT }}>עדיין לא שמרת מוצרים</Text>
              <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21, ...RTL_TEXT }}>
                חזור לקטלוג, לחץ על הלב של מוצר שאתה אוהב, והוא יופיע כאן מיד.
              </Text>
            </Card>
          ) : null}

          {!isHydrating && favorites.length > 0 ? (
            <FavoriteProductsGrid
              favorites={favorites}
              isFavoritePending={isFavoritePending}
              onOpenProduct={onOpenProduct}
              onRemoveFavorite={removeFavorite}
            />
          ) : null}
        </ScrollView>

        <StoreFloatingTabBar activeTab="favorites" onTabPress={onTabPress} />
      </View>
    </SafeAreaView>
  );
}
