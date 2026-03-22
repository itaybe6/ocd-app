import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Card } from '../../components/ui/Card';
import { formatOrderDate, formatOrderPrice, getOrderStatusLabel } from '../../lib/orders';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../state/AuthContext';
import { colors } from '../../theme/colors';
import type { CustomerOrderRow } from '../../types/database';

const RTL_TEXT = {
  textAlign: 'right' as const,
  writingDirection: 'rtl' as const,
};

export function CustomerOrdersScreen() {
  const { user } = useAuth();
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16 }}>
      <View style={{ alignItems: 'flex-end', gap: 8, marginBottom: 14 }}>
        <Text style={{ color: '#C18D39', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, ...RTL_TEXT }}>רכישות</Text>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '900', ...RTL_TEXT }}>היסטוריית רכישות</Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, ...RTL_TEXT }}>
          כל ההזמנות שביצעת דרך האפליקציה יופיעו כאן.
        </Text>
      </View>

      {loading ? (
        <Card style={{ alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 28 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textMuted, fontWeight: '700' }}>טוען הזמנות…</Text>
        </Card>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingBottom: 20 }}
          renderItem={({ item }) => (
            <Pressable>
              <Card style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: colors.text, fontWeight: '900', fontSize: 17, ...RTL_TEXT }}>
                      הזמנה #{item.order_number}
                    </Text>
                    <Text style={{ color: colors.textMuted, marginTop: 4, ...RTL_TEXT }}>{formatOrderDate(item.created_at)}</Text>
                  </View>

                  <View
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      backgroundColor: '#ECFCCB',
                    }}
                  >
                    <Text style={{ color: '#3F6212', fontWeight: '800', fontSize: 11 }}>{getOrderStatusLabel(item.status)}</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colors.textMuted, ...RTL_TEXT }}>{item.item_count} פריטים</Text>
                  <Text style={{ color: colors.text, fontWeight: '900', fontSize: 22 }}>
                    {formatOrderPrice(item.total_amount, item.currency_code)}
                  </Text>
                </View>
              </Card>
            </Pressable>
          )}
          ListEmptyComponent={
            <Card style={{ alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 28 }}>
              <Ionicons name="receipt-outline" size={34} color="#94A3B8" />
              <Text style={{ color: colors.text, fontWeight: '900', fontSize: 20, ...RTL_TEXT }}>עדיין אין רכישות</Text>
              <Text style={{ color: colors.textMuted, fontSize: 14, ...RTL_TEXT }}>
                ברגע שתבצע הזמנה מהעגלה, היא תופיע כאן.
              </Text>
            </Card>
          }
        />
      )}
    </View>
  );
}
