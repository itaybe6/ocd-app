import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { formatOrderDate, formatOrderPrice, getOrderStatusLabel } from '../../lib/orders';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../state/AuthContext';
import { useFavorites } from '../../state/FavoritesContext';
import { getStoreBottomBarMetrics, StoreFloatingTabBar, type StoreBottomTabId } from '../store/StoreHomeScreen';
import type { CustomerOrderRow } from '../../types/database';

/* ─── palette ─────────────────────────────────────────────────────────────── */
const P = {
  bg: '#F2F2F7',          // iOS system grouped background
  card: '#FFFFFF',
  separator: '#C6C6C8',   // iOS separator colour
  label: '#000000',
  secondaryLabel: '#3C3C43CC',
  tertiaryLabel: '#3C3C4399',
  accent: '#007AFF',      // iOS blue
  destructive: '#FF3B30',
  green: '#34C759',
  orange: '#FF9500',
  iconBg: '#F2F2F7',
};

const RTL = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

/* ─── sub-components ──────────────────────────────────────────────────────── */

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={styles.sectionHeader} numberOfLines={1}>
      {title}
    </Text>
  );
}

function ListRow({
  icon,
  iconBg,
  label,
  value,
  chevron = true,
  onPress,
  destructive,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  label: string;
  value?: string;
  chevron?: boolean;
  onPress?: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.rowIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color="#FFFFFF" />
      </View>

      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, destructive && { color: P.destructive }]} numberOfLines={1}>
          {label}
        </Text>
        {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
        {chevron && (
          <Ionicons name="chevron-back" size={16} color={P.tertiaryLabel} style={styles.chevron} />
        )}
      </View>
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/* ─── main screen ─────────────────────────────────────────────────────────── */

export function CustomerProfileScreen({
  onTabPress,
  onOpenOrders,
  onOpenFavorites,
}: {
  onTabPress: (tabId: StoreBottomTabId) => void;
  onOpenOrders: () => void;
  onOpenFavorites: () => void;
  onOpenServices: () => void;
}) {
  const { user, signOut } = useAuth();
  const { favoriteCount } = useFavorites();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(0);
  const [recentOrders, setRecentOrders] = useState<CustomerOrderRow[]>([]);
  const [loading, setLoading] = useState(false);

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

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  const totalSpent = useMemo(
    () => recentOrders.reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0),
    [recentOrders]
  );

  const memberSinceLabel = useMemo(() => {
    if (!user?.created_at) return 'לקוח מועדף';
    try {
      return `מאז ${new Intl.DateTimeFormat('he-IL', { month: '2-digit', year: 'numeric' }).format(new Date(user.created_at))}`;
    } catch {
      return 'לקוח מועדף';
    }
  }, [user?.created_at]);

  const header = (
    <View style={{ gap: 28 }}>
      {/* ── avatar + name ── */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarRing}>
          <View style={styles.avatarInner}>
            <Ionicons name="person" size={38} color={P.secondaryLabel} />
          </View>
        </View>
        <Text style={styles.displayName}>{user?.name ?? 'שם משתמש'}</Text>
        <Text style={styles.memberSince}>{memberSinceLabel}</Text>
      </View>

      {/* ── stats row ── */}
      <View style={styles.statsCard}>
        <StatPill value={String(recentOrders.length)} label="הזמנות" />
        <View style={styles.statsSep} />
        <StatPill value={String(favoriteCount)} label="מועדפים" />
        <View style={styles.statsSep} />
        <StatPill
          value={totalSpent > 0 ? `₪${totalSpent.toLocaleString('he-IL')}` : '—'}
          label="סה״כ רכישות"
        />
      </View>

      {/* ── quick actions ── */}
      <View>
        <SectionHeader title="פעולות מהירות" />
        <View style={styles.listCard}>
          <ListRow
            icon="heart"
            iconBg="#FF2D55"
            label="מועדפים"
            value={favoriteCount > 0 ? String(favoriteCount) : undefined}
            onPress={onOpenFavorites}
          />
          <Divider />
          <ListRow
            icon="bag"
            iconBg={P.accent}
            label="היסטוריית הזמנות"
            onPress={onOpenOrders}
          />
          <Divider />
          <ListRow
            icon="storefront"
            iconBg={P.orange}
            label="לחנות"
            onPress={() => onTabPress('home')}
          />
        </View>
      </View>

      {/* ── account ── */}
      <View>
        <SectionHeader title="חשבון" />
        <View style={styles.listCard}>
          <ListRow
            icon="location"
            iconBg={P.green}
            label="כתובות שמורות"
            onPress={() => Toast.show({ type: 'info', text1: 'ניהול כתובות יתווסף בהמשך' })}
          />
          <Divider />
          <ListRow
            icon="card"
            iconBg="#5856D6"
            label="אמצעי תשלום"
            onPress={() => Toast.show({ type: 'info', text1: 'אמצעי תשלום יתווספו בהמשך' })}
          />
          <Divider />
          <ListRow
            icon="notifications"
            iconBg={P.orange}
            label="התראות"
            onPress={() => Toast.show({ type: 'info', text1: 'מרכז ההתראות יתווסף בהמשך' })}
          />
        </View>
      </View>

      {/* ── recent orders header ── */}
      <View style={styles.sectionTitleRow}>
        <Pressable onPress={onOpenOrders}>
          <Text style={styles.seeAll}>הכל</Text>
        </Pressable>
        <SectionHeader title="הזמנות אחרונות" />
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.root}>
        <FlatList
          data={recentOrders}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 1, paddingBottom: contentPaddingBottom + 16 }}
          ListHeaderComponent={header}
          ListHeaderComponentStyle={{ marginBottom: 0 }}
          renderItem={({ item, index }) => (
            <Pressable
              onPress={onOpenOrders}
              style={({ pressed }) => [
                styles.orderRow,
                index === 0 && styles.orderRowFirst,
                index === recentOrders.length - 1 && styles.orderRowLast,
                pressed && styles.rowPressed,
              ]}
            >
              <View style={[styles.orderIconWrap, { backgroundColor: item.status === 'delivered' ? '#D1FAE5' : '#EFF6FF' }]}>
                <Ionicons
                  name={item.status === 'delivered' ? 'checkmark-circle' : 'cube'}
                  size={22}
                  color={item.status === 'delivered' ? P.green : P.accent}
                />
              </View>
              <View style={styles.orderMeta}>
                <Text style={styles.orderTitle} numberOfLines={1}>
                  {item.status === 'confirmed' ? 'בדרך אליך' : getOrderStatusLabel(item.status)}
                </Text>
                <Text style={styles.orderSub} numberOfLines={1}>
                  {formatOrderDate(item.created_at)} · #{item.order_number}
                </Text>
              </View>
              <Text style={styles.orderPrice}>{formatOrderPrice(item.total_amount, item.currency_code)}</Text>
              <Ionicons name="chevron-back" size={16} color={P.tertiaryLabel} />
            </Pressable>
          )}
          ListEmptyComponent={
            loading ? (
              <View style={[styles.listCard, styles.emptyCard]}>
                <ActivityIndicator size="small" color={P.accent} />
                <Text style={styles.emptyText}>טוען הזמנות…</Text>
              </View>
            ) : (
              <View style={[styles.listCard, styles.emptyCard]}>
                <Ionicons name="bag-outline" size={32} color={P.tertiaryLabel} />
                <Text style={styles.emptyTitle}>אין הזמנות עדיין</Text>
                <Text style={styles.emptyText}>ברגע שתבצע רכישה היא תופיע כאן.</Text>
                <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 4 }}>
                  <Button title="לחנות" fullWidth={false} onPress={() => onTabPress('home')} />
                  <Button title="התנתקות" fullWidth={false} variant="secondary" onPress={() => void signOut()} />
                </View>
              </View>
            )
          }
        />

        {/* sign-out — only shown when there are orders (otherwise it's in the empty state) */}
        {recentOrders.length > 0 && (
          <View style={[styles.listCard, styles.signOutCard]}>
            <ListRow
              icon="log-out-outline"
              iconBg={P.destructive}
              label="התנתקות"
              chevron={false}
              destructive
              onPress={() => void signOut()}
            />
          </View>
        )}

        <StoreFloatingTabBar activeTab="profile" onTabPress={onTabPress} />
      </View>
    </SafeAreaView>
  );
}

/* ─── styles ──────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: P.bg },
  root: { flex: 1, backgroundColor: P.bg },

  /* avatar */
  avatarSection: { alignItems: 'center', paddingTop: 32, paddingBottom: 4, gap: 8 },
  avatarRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: P.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  avatarInner: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayName: { fontSize: 22, fontWeight: '700', color: P.label, textAlign: 'center' },
  memberSince: { fontSize: 14, color: P.tertiaryLabel, textAlign: 'center' },

  /* stats */
  statsCard: {
    marginHorizontal: 20,
    backgroundColor: P.card,
    borderRadius: 14,
    flexDirection: 'row-reverse',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statPill: { flex: 1, alignItems: 'center', paddingVertical: 16, gap: 2 },
  statValue: { fontSize: 20, fontWeight: '700', color: P.label },
  statLabel: { fontSize: 12, color: P.tertiaryLabel },
  statsSep: { width: StyleSheet.hairlineWidth, backgroundColor: P.separator, marginVertical: 12 },

  /* sections */
  sectionHeader: {
    fontSize: 13,
    fontWeight: '500',
    color: P.secondaryLabel,
    textAlign: 'right',
    writingDirection: 'rtl',
    paddingHorizontal: 20,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  sectionTitleRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 0,
    paddingLeft: 20,
    marginBottom: 6,
  },
  seeAll: { fontSize: 15, color: P.accent, fontWeight: '400' },

  /* list card container */
  listCard: {
    marginHorizontal: 20,
    backgroundColor: P.card,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  /* individual row */
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 54,
    backgroundColor: P.card,
  },
  rowPressed: { backgroundColor: '#F2F2F7' },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  rowLabel: { flex: 1, fontSize: 17, color: P.label, textAlign: 'right', writingDirection: 'rtl' },
  rowValue: { fontSize: 15, color: P.tertiaryLabel, marginLeft: 4 },
  chevron: { marginLeft: 2 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: P.separator,
    marginLeft: 16,
    marginRight: 60,
  },

  /* order rows */
  orderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: P.card,
    marginHorizontal: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: P.separator,
  },
  orderRowFirst: { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  orderRowLast: { borderBottomWidth: 0, borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  orderIconWrap: { width: 44, height: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  orderMeta: { flex: 1, alignItems: 'flex-end', gap: 2 },
  orderTitle: { fontSize: 16, fontWeight: '600', color: P.label, ...RTL },
  orderSub: { fontSize: 13, color: P.tertiaryLabel, ...RTL },
  orderPrice: { fontSize: 16, fontWeight: '600', color: P.label },

  /* empty */
  emptyCard: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: P.label },
  emptyText: { fontSize: 14, color: P.tertiaryLabel, textAlign: 'center' },

  /* sign-out */
  signOutCard: { marginBottom: 16 },
});
