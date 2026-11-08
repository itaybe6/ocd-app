import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from '../../components/toast/Toast';
import { supabase } from '../../lib/supabase';
import { isLocalDemoUser } from '../../lib/localDemoAccount';
import { useAuth } from '../../state/AuthContext';
import { getStoreBottomBarMetrics, StoreFloatingTabBar, type StoreBottomTabId } from '../store/StoreHomeScreen';
import type { CustomerOrderRow } from '../../types/database';
import { AccountHeader, AccountIntro, AccountOrderRow, AccountEmpty, AccountLoading, accountColors as C } from './AccountUI';

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
    if (isLocalDemoUser(user.id)) { setOrders([]); setLoading(false); return; }

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
    <View style={styles.root}>
      <AccountHeader onBack={onBack} />
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: contentPaddingBottom + 24, flexGrow: 1 }}
        ListHeaderComponent={<AccountIntro title="ההזמנות שלי" subtitle={orders.length ? orders.length + ' הזמנות בחשבון' : 'פרטי הרכישות שלכם, מהראשונה ועד האחרונה.'} />}
        renderItem={({ item }) => <AccountOrderRow order={item} onPress={() => onOpenOrder(item.id)} />}
        ListEmptyComponent={loading ? <AccountLoading label="טוען הזמנות…" /> : <AccountEmpty icon="bag-outline" title="עדיין אין כאן הזמנות" description="אחרי הקנייה הראשונה תוכלו לראות כאן את הפריטים, התשלום וסטטוס ההזמנה." action="לחנות" onPress={() => onTabPress('home')} />}
      />
      <StoreFloatingTabBar activeTab="profile" onTabPress={onTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: C.bg } });
