import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { formatOrderDate, formatOrderPrice, getOrderStatusLabel } from '../../lib/orders';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { useAuth } from '../../state/AuthContext';
import { useFavorites } from '../../state/FavoritesContext';
import { getStoreBottomBarMetrics, StoreFloatingTabBar, type StoreBottomTabId } from '../store/StoreHomeScreen';
import type { CustomerOrderRow } from '../../types/database';

const RTL_TEXT = {
  textAlign: 'right' as const,
  writingDirection: 'rtl' as const,
};

const SCREEN_HORIZONTAL_PADDING = 16;
const ACTION_GRID_PADDING = 10;
const ACTION_GRID_GAP = 12;
const ACTION_CARD_HEIGHT = 118;

function ProfileAction({
  icon,
  title,
  iconColor,
  iconBackground,
  onPress,
  cardWidth,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  iconColor: string;
  iconBackground: string;
  onPress: () => void;
  cardWidth: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: cardWidth,
        flexShrink: 0,
        opacity: pressed ? 0.94 : 1,
      })}
    >
      <View
        style={{
          width: '100%',
          height: ACTION_CARD_HEIGHT,
          borderRadius: 22,
          borderWidth: 1.5,
          borderColor: '#DCC5A3',
          backgroundColor: '#FFFFFF',
          paddingHorizontal: 12,
          paddingVertical: 14,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#8A6A3B',
          shadowOpacity: 0.12,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 7 },
          elevation: 6,
        }}
      >
        <View
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: iconBackground,
          }}
        >
          <Ionicons name={icon} size={24} color={iconColor} />
        </View>
        <Text
          numberOfLines={2}
          style={{
            color: colors.text,
            fontWeight: '800',
            fontSize: 13,
            lineHeight: 18,
            marginTop: 14,
            ...RTL_TEXT,
          }}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

function PromoCtaButton({
  title,
  onPress,
  variant,
  width,
  flex,
}: {
  title: string;
  onPress: () => void;
  variant: 'primary' | 'secondary';
  width?: number;
  flex?: number;
}) {
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width,
        flex,
        opacity: pressed ? 0.94 : 1,
      })}
    >
      <View
        style={{
          width: '100%',
          minHeight: 52,
          borderRadius: 18,
          paddingHorizontal: 16,
          paddingVertical: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isPrimary ? '#FFF4DE' : '#2B3552',
          borderWidth: 1,
          borderColor: isPrimary ? '#E7D0AB' : '#44506E',
        }}
      >
        <Text style={{ color: isPrimary ? '#1F2937' : '#FFFFFF', fontWeight: '900' }}>{title}</Text>
      </View>
    </Pressable>
  );
}

export function CustomerProfileScreen({
  onTabPress,
  onOpenOrders,
  onOpenFavorites,
  onOpenServices,
}: {
  onTabPress: (tabId: StoreBottomTabId) => void;
  onOpenOrders: () => void;
  onOpenFavorites: () => void;
  onOpenServices: () => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const { user, signOut } = useAuth();
  const { favoriteCount } = useFavorites();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(0);
  const [recentOrders, setRecentOrders] = useState<CustomerOrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const actionCardWidth = useMemo(() => {
    const availableWidth =
      windowWidth - SCREEN_HORIZONTAL_PADDING * 2 - ACTION_GRID_PADDING * 2 - ACTION_GRID_GAP * 2;

    return Math.max(96, Math.floor(availableWidth / 3));
  }, [windowWidth]);

  const fetchAll = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customer_orders')
        .select('id, order_number, user_id, status, total_amount, currency_code, item_count, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      setRecentOrders((data ?? []) as CustomerOrderRow[]);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'טעינה נכשלה', text2: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  const totalSpent = useMemo(
    () => recentOrders.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0),
    [recentOrders]
  );

  const memberSinceLabel = useMemo(() => {
    if (!user?.created_at) return 'לקוח מועדף בחנות';

    try {
      return `איתנו מ-${new Intl.DateTimeFormat('he-IL', {
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(user.created_at))}`;
    } catch {
      return 'לקוח מועדף בחנות';
    }
  }, [user?.created_at]);

  const actionItems = useMemo(
    () => [
      {
        key: 'addresses',
        title: 'כתובות',
        icon: 'location' as const,
        iconColor: '#7A5A2D',
        iconBackground: '#F8EEDC',
        onPress: () => Toast.show({ type: 'info', text1: 'ניהול כתובות יתווסף בהמשך' }),
      },
      {
        key: 'favorites',
        title: 'אהבתי',
        icon: 'heart' as const,
        iconColor: '#7A5A2D',
        iconBackground: '#F8EEDC',
        onPress: onOpenFavorites,
      },
      {
        key: 'orders',
        title: 'היסטוריית רכישות',
        icon: 'receipt-outline' as const,
        iconColor: '#7A5A2D',
        iconBackground: '#F8EEDC',
        onPress: onOpenOrders,
      },
      {
        key: 'notifications',
        title: 'התראות',
        icon: 'notifications-outline' as const,
        iconColor: '#7A5A2D',
        iconBackground: '#F8EEDC',
        onPress: () => Toast.show({ type: 'info', text1: 'מרכז ההתראות יתווסף בהמשך' }),
      },
      {
        key: 'payment',
        title: 'אמצעי תשלום',
        icon: 'card-outline' as const,
        iconColor: '#7A5A2D',
        iconBackground: '#F8EEDC',
        onPress: () => Toast.show({ type: 'info', text1: 'אמצעי תשלום יתווספו בהמשך' }),
      },
    ],
    [onOpenFavorites, onOpenOrders]
  );
  const actionRows = useMemo(() => [actionItems.slice(0, 3), actionItems.slice(3, 6)], [actionItems]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingHorizontal: SCREEN_HORIZONTAL_PADDING, paddingTop: 12 }}>
        <FlatList
          data={recentOrders}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 14, paddingBottom: contentPaddingBottom + 12 }}
          ListHeaderComponent={
            <View style={{ gap: 14 }}>
              <View style={{ alignItems: 'center', paddingTop: 8 }}>
                <View
                  style={{
                    width: 114,
                    height: 114,
                    borderRadius: 57,
                    borderWidth: 2,
                    borderColor: '#F5D1A8',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#FFFDF9',
                    shadowColor: '#C8AE86',
                    shadowOpacity: 0.16,
                    shadowRadius: 18,
                    shadowOffset: { width: 0, height: 8 },
                    elevation: 4,
                  }}
                >
                  <View
                    style={{
                      width: 92,
                      height: 92,
                      borderRadius: 46,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#F4F0E8',
                    }}
                  >
                    <Ionicons name="person" size={40} color="#0F172A" />
                  </View>
                </View>

                <View
                  style={{
                    marginTop: -10,
                    borderRadius: 999,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    backgroundColor: '#0F172A',
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 12 }}>לקוח זהב</Text>
                </View>

                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 14, ...RTL_TEXT }}>{user?.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 14, marginTop: 4, ...RTL_TEXT }}>{memberSinceLabel}</Text>
                <Text style={{ color: '#9AA0AE', fontSize: 13, marginTop: 2, ...RTL_TEXT }}>
                  חבר מועדון יוני 2022 • {favoriteCount.toLocaleString('he-IL')} נקודות
                </Text>
              </View>

              <View
                style={{
                  padding: ACTION_GRID_PADDING,
                  borderRadius: 28,
                  backgroundColor: '#F1EEE7',
                  gap: ACTION_GRID_GAP,
                }}
              >
                {actionRows.map((row, rowIndex) => (
                  <View
                    key={`action-row-${rowIndex}`}
                    style={{
                      flexDirection: 'row-reverse',
                      justifyContent: 'space-between',
                    }}
                  >
                    {row.map((item) => (
                      <ProfileAction
                        key={item.key}
                        icon={item.icon}
                        title={item.title}
                        iconColor={item.iconColor}
                        iconBackground={item.iconBackground}
                        onPress={item.onPress}
                        cardWidth={actionCardWidth}
                      />
                    ))}
                  </View>
                ))}
              </View>

              <Card
                style={{
                  backgroundColor: '#202841',
                  borderColor: '#202841',
                  borderRadius: 22,
                  padding: 18,
                  gap: 14,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    position: 'absolute',
                    top: -12,
                    left: -16,
                    width: 72,
                    height: 72,
                    borderRadius: 18,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    transform: [{ rotate: '-12deg' }],
                  }}
                />
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
                  <View
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(255,255,255,0.08)',
                    }}
                  >
                    <Ionicons name="bag-handle-outline" size={24} color="#FFFFFF" />
                  </View>

                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={{ color: '#8D9BC2', fontSize: 11, fontWeight: '900', ...RTL_TEXT }}>במיוחד עבורך</Text>
                    <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginTop: 6, ...RTL_TEXT }}>
                      המשך קניות
                    </Text>
                    <Text style={{ color: '#A9B1C7', marginTop: 6, lineHeight: 20, ...RTL_TEXT }}>
                      פריטים חדשים מחכים לך בסל ובקטלוג המומלץ.
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row-reverse', alignItems: 'stretch' }}>
                  <PromoCtaButton title="המשך לקנות" onPress={() => onTabPress('home')} variant="primary" flex={1} />
                  <View style={{ width: 10 }} />
                  <PromoCtaButton title="לכל המבצעים" onPress={() => onTabPress('home')} variant="secondary" width={128} />
                </View>
              </Card>

              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>הכל</Text>
                <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900', ...RTL_TEXT }}>הזמנות אחרונות</Text>
              </View>
            </View>
          }
          renderItem={({ item, index }) => (
            <Card
              style={{
                gap: 12,
                borderRadius: 18,
                padding: 14,
                backgroundColor: index === 0 ? '#FFFFFF' : '#FBFBFC',
              }}
            >
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#F3F4F6',
                  }}
                >
                  <Ionicons
                    name={index % 2 === 0 ? 'cube-outline' : 'checkmark-done-circle-outline'}
                    size={22}
                    color="#394150"
                  />
                </View>

                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={{ color: colors.textMuted, fontSize: 12, ...RTL_TEXT }}>
                    {formatOrderDate(item.created_at)} • הזמנה #{item.order_number}
                  </Text>
                  <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 6, ...RTL_TEXT }}>
                    {item.status === 'confirmed' ? 'בדרך אליך' : getOrderStatusLabel(item.status)}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                <Pressable
                  onPress={onOpenOrders}
                  style={({ pressed }) => ({
                    borderRadius: 999,
                    paddingHorizontal: 16,
                    paddingVertical: 9,
                    alignItems: 'center',
                    backgroundColor: pressed ? '#1E293B' : '#0F172A',
                  })}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>לצפייה</Text>
                </Pressable>

                <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900' }}>
                  {formatOrderPrice(item.total_amount, item.currency_code)}
                </Text>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            loading ? (
              <Card style={{ alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 28 }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: colors.textMuted, fontWeight: '700' }}>טוען הזמנות…</Text>
              </Card>
            ) : (
              <Card style={{ alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 28 }}>
                <Ionicons name="receipt-outline" size={34} color="#94A3B8" />
                <Text style={{ color: colors.text, fontWeight: '900', fontSize: 20, ...RTL_TEXT }}>עדיין אין הזמנות באפליקציה</Text>
                <Text style={{ color: colors.textMuted, fontSize: 14, ...RTL_TEXT }}>
                  ברגע שתבצע רכישה דרך העגלה, היא תופיע כאן.
                </Text>
                <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
                  <Button title="למעבר לחנות" fullWidth={false} onPress={() => onTabPress('home')} />
                  <Button title="התנתקות" fullWidth={false} variant="secondary" onPress={() => void signOut()} />
                </View>
              </Card>
            )
          }
        />

        <StoreFloatingTabBar activeTab="profile" onTabPress={onTabPress} />
      </View>
    </SafeAreaView>
  );
}

