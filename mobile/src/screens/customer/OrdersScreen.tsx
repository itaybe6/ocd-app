import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from '../../components/toast/Toast';
import { formatOrderDate, formatOrderPrice, getOrderStatusLabel } from '../../lib/orders';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../state/AuthContext';
import { getStoreBottomBarMetrics, StoreFloatingTabBar, type StoreBottomTabId } from '../store/StoreHomeScreen';
import type { CustomerOrderRow } from '../../types/database';

/* ─── palette (minimal, monochrome — matches profile) ─────────────────────── */
const P = {
  bg: '#F5F5F5',
  card: '#FFFFFF',
  separator: '#ECECEC',
  label: '#111111',
  secondaryLabel: '#555555',
  tertiaryLabel: '#999999',
  iconBg: '#F0F0F0',
  iconColor: '#444444',
  destructive: '#D94040',
  destructiveBg: '#FFF0F0',
};

function StatusBadge({ status }: { status: CustomerOrderRow['status'] }) {
  const isCancelled = status === 'cancelled';
  const isConfirmed = status === 'confirmed';
  return (
    <View
      style={{
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: isCancelled ? P.destructiveBg : isConfirmed ? '#111111' : P.iconBg,
      }}
    >
      <Text
        style={{
          color: isCancelled ? P.destructive : isConfirmed ? '#FFFFFF' : P.secondaryLabel,
          fontWeight: '800',
          fontSize: 11,
        }}
      >
        {getOrderStatusLabel(status)}
      </Text>
    </View>
  );
}

export function CustomerOrdersScreen({
  onBack,
  onOpenOrder,
  onTabPress,
}: {
  onBack: () => void;
  onOpenOrder: (orderId: string) => void;
  onTabPress: (tabId: StoreBottomTabId) => void;
}) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const [orders, setOrders] = useState<CustomerOrderRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customer_orders')
        .select('id, order_number, user_id, status, total_amount, currency_code, item_count, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders((data ?? []) as CustomerOrderRow[]);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'טעינת הרכישות נכשלה',
        text2: error?.message ?? 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders().catch(() => {});
    }, [fetchOrders])
  );

  const totalSpent = useMemo(
    () => orders.reduce((sum, o) => (o.status === 'cancelled' ? sum : sum + Number(o.total_amount ?? 0)), 0),
    [orders]
  );

  return (
    <View style={styles.root}>
      {/* header — black slab with rounded bottom corners */}
      <View style={[styles.headerBg, { paddingTop: insets.top }]}>
        <View style={styles.headerBar}>
          <Pressable
            onPress={onBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="חזרה"
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </Pressable>

          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>היסטוריית הזמנות</Text>
            <Text style={styles.headerSubtitle}>
              {orders.length > 0
                ? `${orders.length} הזמנות · סה״כ ₪${totalSpent.toLocaleString('he-IL')}`
                : 'כל ההזמנות שביצעת יופיעו כאן'}
            </Text>
          </View>

          <View style={{ width: 40 }} />
        </View>
      </View>

      {loading && orders.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={P.iconColor} />
          <Text style={styles.loadingText}>טוען הזמנות…</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 16,
            paddingBottom: contentPaddingBottom + 16,
            gap: 12,
            flexGrow: 1,
          }}
          renderItem={({ item }) => (
            <View style={styles.orderCardShell}>
              <Pressable
                onPress={() => onOpenOrder(item.id)}
                style={({ pressed }) => [styles.orderCard, pressed && styles.orderCardPressed]}
              >
                <View style={styles.orderTopRow}>
                  <View style={styles.orderIconSlot}>
                    <Ionicons
                      name={item.status === 'cancelled' ? 'close-circle-outline' : 'cube-outline'}
                      size={23}
                      color={item.status === 'cancelled' ? P.destructive : P.iconColor}
                    />
                  </View>

                  <View style={styles.orderMeta}>
                    <Text style={styles.orderTitle} numberOfLines={1}>
                      הזמנה #{item.order_number}
                    </Text>
                    <Text style={styles.orderSub} numberOfLines={1}>
                      {formatOrderDate(item.created_at)}
                    </Text>
                  </View>

                  <StatusBadge status={item.status} />
                </View>

                <View style={styles.orderDivider} />

                <View style={styles.orderSummaryRow}>
                  <View style={styles.orderSummaryBox}>
                    <Text style={styles.orderSummaryLabel}>פריטים בהזמנה</Text>
                    <Text style={styles.orderSummaryValue}>{item.item_count}</Text>
                  </View>

                  <View style={styles.orderSummaryBox}>
                    <Text style={styles.orderSummaryLabel}>סה״כ שולם</Text>
                    <Text style={styles.orderPrice}>
                      {formatOrderPrice(item.total_amount, item.currency_code)}
                    </Text>
                  </View>
                </View>

                <View style={styles.orderDetailsButton}>
                  <Text style={styles.orderDetailsButtonText}>לפרטי ההזמנה</Text>
                  <Ionicons name="chevron-back" size={17} color="#FFFFFF" />
                </View>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="bag-outline" size={30} color={P.tertiaryLabel} />
              </View>
              <Text style={styles.emptyTitle}>אין הזמנות עדיין</Text>
              <Text style={styles.emptyText}>ברגע שתבצע רכישה היא תופיע כאן.</Text>
            </View>
          }
        />
      )}

      <StoreFloatingTabBar activeTab="profile" onTabPress={onTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.bg },

  headerBg: {
    backgroundColor: '#000000',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  headerBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 22,
    gap: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerTitles: { flex: 1, alignItems: 'center', gap: 3 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  headerSubtitle: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '600', textAlign: 'center' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: P.tertiaryLabel, fontSize: 14, fontWeight: '600' },

  /* order card */
  orderCardShell: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
    overflow: 'hidden',
  },
  orderCard: {
    minHeight: 276,
    backgroundColor: '#FFFFFF',
    paddingVertical: 26,
    gap: 22,
    justifyContent: 'space-between',
  },
  orderCardPressed: { backgroundColor: '#FAFAFA' },
  orderTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    minHeight: 58,
    marginHorizontal: 24,
    gap: 14,
  },
  orderIconSlot: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: P.iconBg,
  },
  orderMeta: { flex: 1, alignItems: 'flex-end', gap: 4 },
  orderTitle: { fontSize: 17, lineHeight: 22, fontWeight: '800', color: P.label, textAlign: 'right' },
  orderSub: { fontSize: 13, lineHeight: 18, color: P.tertiaryLabel, textAlign: 'right', fontWeight: '600' },
  orderDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: P.separator,
    marginHorizontal: 24,
  },
  orderSummaryRow: {
    flexDirection: 'row-reverse',
    gap: 12,
    marginHorizontal: 24,
    marginBottom: 8,
  },
  orderSummaryBox: {
    flex: 1,
    minHeight: 78,
    borderRadius: 16,
    backgroundColor: '#F6F6F6',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  orderSummaryLabel: {
    fontSize: 11,
    lineHeight: 15,
    color: P.tertiaryLabel,
    fontWeight: '700',
    textAlign: 'center',
  },
  orderSummaryValue: {
    fontSize: 18,
    lineHeight: 23,
    color: P.label,
    fontWeight: '900',
    textAlign: 'center',
  },
  orderDetailsButton: {
    minHeight: 56,
    marginHorizontal: 24,
    marginTop: 4,
    marginBottom: 14,
    borderRadius: 16,
    backgroundColor: '#111111',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  orderDetailsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  orderPrice: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    color: P.label,
    textAlign: 'center',
  },

  /* empty state */
  emptyCard: {
    marginHorizontal: 20,
    backgroundColor: P.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: P.separator,
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: P.iconBg,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: P.label },
  emptyText: { fontSize: 13, color: P.tertiaryLabel, textAlign: 'center' },
});
