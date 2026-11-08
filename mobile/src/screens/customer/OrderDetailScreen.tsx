import { radii } from '../../theme/radii';
import React, { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from '../../components/toast/Toast';
import { fetchCustomerOrderWithItems, formatOrderDate, formatOrderPrice, getOrderStatusLabel, type CustomerOrderWithItems } from '../../lib/orders';
import { getStoreBottomBarMetrics, StoreFloatingTabBar, type StoreBottomTabId } from '../store/StoreHomeScreen';
import { AccountHeader, AccountIntro, AccountSection, AccountLoading, AccountEmpty, accountColors as C } from './AccountUI';

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
      <AccountHeader onBack={onBack} />
      {loading && !order ? <AccountLoading label="טוען פרטי הזמנה…" /> : !order ? (
        <AccountEmpty icon="receipt-outline" title="ההזמנה לא נמצאה" description="אפשר לחזור לרשימת ההזמנות ולנסות שוב." action="חזרה להזמנות" onPress={onBack} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: contentPaddingBottom + 24 }}>
          <AccountIntro title={'הזמנה #' + order.order_number} subtitle={formatOrderDate(order.created_at)} />
          <View style={styles.statusRow}>
            <Ionicons name={isCancelled ? 'close-circle-outline' : order.status === 'confirmed' ? 'checkmark-circle-outline' : 'time-outline'} size={23} color={isCancelled ? C.red : C.ink} />
            <Text style={styles.statusLabel}>סטטוס ההזמנה</Text>
            <Text style={[styles.statusValue, isCancelled && { color: C.red }]}>{getOrderStatusLabel(order.status)}</Text>
          </View>
          <AccountSection title="מה בהזמנה" />
          {order.items.map((item) => (
            <View key={item.id} style={styles.item}>
              <View style={styles.imageWrap}>
                {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.image} resizeMode="contain" accessibilityLabel={item.product_title} /> : <Ionicons name="cube-outline" size={28} color="#A0A0A0" />}
              </View>
              <View style={styles.itemCopy}>
                <Text style={styles.itemTitle}>{item.product_title}</Text>
                <Text style={styles.itemQuantity}>{item.quantity} × {formatOrderPrice(item.unit_price, order.currency_code)}</Text>
                <Text style={styles.itemPrice}>{formatOrderPrice(item.line_total, order.currency_code)}</Text>
              </View>
            </View>
          ))}
          {!order.items.length ? <Text style={styles.emptyItems}>לא נמצאו פריטים להזמנה זו.</Text> : null}
          <AccountSection title="סיכום ההזמנה" />
          <View style={styles.receipt}>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>מספר הזמנה</Text><Text style={styles.summaryValue}>#{order.order_number}</Text></View>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>תאריך</Text><Text style={styles.summaryValue}>{formatOrderDate(order.created_at)}</Text></View>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>מספר פריטים</Text><Text style={styles.summaryValue}>{order.item_count}</Text></View>
            <View style={styles.total}>
              <Text style={styles.totalLabel}>סה״כ ההזמנה</Text>
              <Text style={styles.totalValue}>{formatOrderPrice(order.total_amount, order.currency_code)}</Text>
            </View>
          </View>
        </ScrollView>
      )}
      <StoreFloatingTabBar activeTab="profile" onTabPress={onTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  statusRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingVertical: 18, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line },
  statusLabel: { color: C.muted, fontSize: 13, lineHeight: 20, flex: 1, textAlign: 'right' },
  statusValue: { color: C.ink, fontSize: 13, lineHeight: 20, fontWeight: '600', textAlign: 'right' },
  item: { flexDirection: 'row-reverse', alignItems: 'center', gap: 18, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: C.line },
  imageWrap: { width: 76, height: 92, borderRadius: radii.compact, backgroundColor: '#F6F6F6', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  itemCopy: { flex: 1, gap: 7 },
  itemTitle: { fontSize: 15, lineHeight: 23, color: C.ink, fontWeight: '600', textAlign: 'right' },
  itemQuantity: { fontSize: 12, lineHeight: 19, color: C.muted, textAlign: 'right' },
  itemPrice: { fontSize: 16, lineHeight: 22, color: C.ink, fontWeight: '600', textAlign: 'right' },
  emptyItems: { color: C.muted, fontSize: 13, lineHeight: 22, textAlign: 'right', paddingVertical: 20 },
  receipt: { backgroundColor: '#F7F7F7', padding: 20, marginTop: 8, borderRadius: radii.surface, gap: 16 },
  summaryRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  summaryLabel: { fontSize: 12, lineHeight: 20, color: C.muted, textAlign: 'right' },
  summaryValue: { fontSize: 13, lineHeight: 20, color: C.ink, textAlign: 'right' },
  total: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTopWidth: 1, borderTopColor: '#DDDDDD', paddingTop: 18, marginTop: 2 },
  totalLabel: { fontSize: 14, color: C.ink, fontWeight: '600' },
  totalValue: { fontSize: 24, lineHeight: 32, color: C.ink, fontWeight: '700', writingDirection: 'ltr' },
});
