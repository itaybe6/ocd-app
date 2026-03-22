import React from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FavoriteToggleButton } from '../../components/FavoriteToggleButton';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/ui/Card';
import { formatFavoritePrice } from '../../lib/favorites';
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
                <Text style={{ color: colors.textMuted, fontSize: 14, ...RTL_TEXT }}>
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
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: contentPaddingBottom + 8, gap: 14 }}
        >
          <View style={{ alignItems: 'flex-end', gap: 8 }}>
            <Text style={{ color: '#C18D39', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, ...RTL_TEXT }}>אהבתי</Text>
            <Text style={{ color: colors.text, fontSize: 30, fontWeight: '900', ...RTL_TEXT }}>המוצרים ששמרת</Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, ...RTL_TEXT }}>
              כל מוצר שתסמן עם לב יישמר כאן תחת המשתמש שלך.
            </Text>
          </View>

          {isHydrating ? (
            <Card style={{ alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 24 }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ color: colors.textMuted, fontWeight: '700' }}>טוען את אהבתי…</Text>
            </Card>
          ) : null}

          {!isHydrating && !favorites.length ? (
            <Card style={{ alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 28 }}>
              <Ionicons name="heart-outline" size={34} color="#94A3B8" />
              <Text style={{ color: colors.text, fontWeight: '900', fontSize: 20, ...RTL_TEXT }}>עדיין לא שמרת מוצרים</Text>
              <Text style={{ color: colors.textMuted, fontSize: 14, ...RTL_TEXT }}>
                חזור לקטלוג, לחץ על הלב של מוצר שאתה אוהב, והוא יופיע כאן מיד.
              </Text>
            </Card>
          ) : null}

          {!isHydrating &&
            favorites.map((favorite) => (
              <Pressable
                key={favorite.id}
                onPress={() => onOpenProduct(favorite.product_handle)}
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

        <StoreFloatingTabBar activeTab="favorites" onTabPress={onTabPress} />
      </View>
    </SafeAreaView>
  );
}
