import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from '../../components/toast/Toast';
import {
  fetchCustomerOrderWithItems,
  formatOrderDate,
  formatOrderPrice,
  getOrderStatusHeadline,
  getOrderStatusLabel,
  type CustomerOrderWithItems,
} from '../../lib/orders';
import { getStoreBottomBarMetrics, StoreFloatingTabBar, type StoreBottomTabId } from '../store/StoreHomeScreen';

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
};

export function CustomerOrderDetailScreen({
  orderId,
  onBack,
  onTabPress,
}: {
  orderId: string;
  onBack: () => void;
  onTabPress: (tabId: StoreBottomTabId) => void;
}) {
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const [order, setOrder] = useState<CustomerOrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const next = await fetchCustomerOrderWithItems(orderId);
      setOrder(next);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'טעינת ההזמנה נכשלה',
        text2: error?.message ?? 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const isCancelled = order?.status === 'cancelled';

  return (
    <View style={styles.root}>
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
            <Text style={styles.headerTitle}>
              {order ? `הזמנה #${order.order_number}` : 'פרטי הזמנה'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {order ? formatOrderDate(order.created_at) : 'טוען פרטים…'}
            </Text>
          </View>

          <View style={{ width: 40 }} />
        </View>
      </View>

      {loading && !order ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={P.iconColor} />
          <Text style={styles.loadingText}>טוען פרטי הזמנה…</Text>
        </View>
      ) : !order ? (
        <View style={styles.loadingWrap}>
          <Ionicons name="alert-circle-outline" size={34} color={P.tertiaryLabel} />
          <Text style={styles.emptyTitle}>ההזמנה לא נמצאה</Text>
          <Pressable onPress={onBack} style={styles.emptyButton}>
            <Text style={styles.emptyButtonText}>חזרה</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: contentPaddingBottom + 20,
            gap: 14,
          }}
        >
          <View style={styles.statusCard}>
            <View
              style={[
                styles.statusIcon,
                { backgroundColor: isCancelled ? '#FFF0F0' : '#111111' },
              ]}
            >
              <Ionicons
                name={isCancelled ? 'close' : 'checkmark'}
                size={22}
                color={isCancelled ? P.destructive : '#FFFFFF'}
              />
            </View>
            <View style={styles.statusMeta}>
              <Text style={styles.statusTitle}>{getOrderStatusHeadline(order.status)}</Text>
              <Text style={styles.statusSub}>{getOrderStatusLabel(order.status)}</Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{order.item_count} פריטים</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>פריטים בהזמנה</Text>
            <View style={styles.itemsList}>
              {order.items.map((item, index) => (
                <View key={item.id}>
                  {index > 0 ? <View style={styles.itemDivider} /> : null}
                  <View style={styles.itemRow}>
                    <View style={styles.itemThumbWrap}>
                      {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={styles.itemThumb} />
                      ) : (
                        <Ionicons name="cube-outline" size={22} color={P.tertiaryLabel} />
                      )}
                    </View>

                    <View style={styles.itemMeta}>
                      <Text style={styles.itemTitle} numberOfLines={2}>
                        {item.product_title}
                      </Text>
                      <Text style={styles.itemSub}>
                        {item.quantity} × {formatOrderPrice(item.unit_price, order.currency_code)}
                      </Text>
                    </View>

                    <Text style={styles.itemPrice}>
                      {formatOrderPrice(item.line_total, order.currency_code)}
                    </Text>
                  </View>
                </View>
              ))}

              {!order.items.length ? (
                <Text style={styles.emptyItems}>לא נמצאו פריטים להזמנה זו.</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>סיכום תשלום</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>מספר הזמנה</Text>
              <Text style={styles.summaryValue}>#{order.order_number}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>תאריך</Text>
              <Text style={styles.summaryValue}>{formatOrderDate(order.created_at)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>פריטים</Text>
              <Text style={styles.summaryValue}>{order.item_count}</Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>סה״כ שולם</Text>
              <Text style={styles.totalValue}>
                {formatOrderPrice(order.total_amount, order.currency_code)}
              </Text>
            </View>
          </View>
        </ScrollView>
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
  headerSubtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24 },
  loadingText: { color: P.tertiaryLabel, fontSize: 14, fontWeight: '600' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: P.label },
  emptyButton: {
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  statusCard: {
    backgroundColor: P.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: P.separator,
    padding: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  statusIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusMeta: { flex: 1, alignItems: 'flex-end', gap: 2 },
  statusTitle: { fontSize: 17, fontWeight: '800', color: P.label, textAlign: 'right' },
  statusSub: { fontSize: 13, color: P.tertiaryLabel, textAlign: 'right' },
  statusBadge: {
    borderRadius: 999,
    backgroundColor: P.iconBg,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusBadgeText: { fontSize: 12, fontWeight: '700', color: P.secondaryLabel },
  card: {
    backgroundColor: P.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: P.separator,
    padding: 16,
    gap: 14,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: P.tertiaryLabel,
    textAlign: 'right',
    letterSpacing: 0.3,
  },
  itemsList: { gap: 0 },
  itemRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  itemDivider: { height: StyleSheet.hairlineWidth, backgroundColor: P.separator },
  itemThumbWrap: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: P.iconBg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemThumb: { width: '100%', height: '100%' },
  itemMeta: { flex: 1, alignItems: 'flex-end', gap: 4 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: P.label, textAlign: 'right' },
  itemSub: { fontSize: 12, color: P.tertiaryLabel, textAlign: 'right' },
  itemPrice: { fontSize: 15, fontWeight: '800', color: P.label },
  emptyItems: { color: P.tertiaryLabel, textAlign: 'center', paddingVertical: 12 },
  summaryRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: { fontSize: 14, color: P.tertiaryLabel, fontWeight: '600' },
  summaryValue: { fontSize: 14, color: P.label, fontWeight: '700' },
  totalDivider: { height: StyleSheet.hairlineWidth, backgroundColor: P.separator },
  totalLabel: { fontSize: 16, color: P.label, fontWeight: '800' },
  totalValue: { fontSize: 18, color: P.label, fontWeight: '900' },
});
