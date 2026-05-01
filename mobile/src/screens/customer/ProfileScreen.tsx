import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { formatOrderDate, formatOrderPrice, getOrderStatusLabel } from '../../lib/orders';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { useAuth } from '../../state/AuthContext';
import { useFavorites } from '../../state/FavoritesContext';
import { getStoreBottomBarMetrics, StoreFloatingTabBar, type StoreBottomTabId } from '../store/StoreHomeScreen';
import type { CustomerOrderRow } from '../../types/database';

/* ─── palette (minimal, monochrome) ───────────────────────────────────────── */
const P = {
  bg: '#F5F5F5',
  card: '#FFFFFF',
  separator: '#ECECEC',
  label: '#111111',
  secondaryLabel: '#555555',
  tertiaryLabel: '#999999',
  destructive: '#D94040',
  iconBg: '#F0F0F0',
  iconColor: '#444444',
};

/* ─── logo ────────────────────────────────────────────────────────────────── */

function OcdLogo({ height = 52, fill = '#FFFFFF' }: { height?: number; fill?: string }) {
  const width = height * (71.16 / 112.32);
  return (
    <Svg width={width} height={height} viewBox="0 0 71.16 112.32">
      <Path fill={fill} d="M5.64,100.87c-.29-.14-.64-.27-1.06-.39-.42-.12-.84-.18-1.26-.18-.65,0-1.18.16-1.57.49-.39.33-.59.74-.59,1.23,0,.37.11.68.34.93s.52.46.88.63c.36.17.75.34,1.16.5.33.12.65.26.97.41.32.15.61.33.87.55.26.21.47.48.62.8.15.32.23.71.23,1.18,0,.55-.13,1.04-.39,1.46-.26.42-.63.75-1.09.99s-1.01.35-1.62.35c-.49,0-.94-.06-1.35-.18-.41-.12-.76-.26-1.06-.43s-.54-.3-.72-.41l.32-.56c.2.15.45.3.75.45.29.15.61.28.96.38.34.1.69.15,1.04.15.4,0,.79-.08,1.17-.24s.69-.4.94-.72c.25-.32.37-.73.37-1.22s-.12-.86-.35-1.15c-.23-.29-.53-.53-.9-.72-.36-.19-.75-.35-1.16-.5-.32-.12-.63-.25-.95-.38s-.61-.3-.87-.49c-.26-.19-.47-.42-.62-.69-.15-.27-.23-.6-.23-.98,0-.48.12-.89.36-1.24.24-.35.57-.63.99-.83.42-.2.89-.3,1.42-.31.47,0,.94.06,1.42.18.48.12.9.28,1.25.46l-.27.53ZM10.19,109.84c-.51,0-.92-.15-1.23-.45-.31-.3-.47-.7-.49-1.18v-3.99h.66v3.79c.02.35.13.65.34.88.21.23.53.36.94.38.35,0,.69-.09.99-.28.31-.19.56-.44.75-.76.19-.32.29-.69.29-1.1v-2.91h.66v5.47h-.59l-.07-1.72.1.38c-.09.28-.26.53-.5.76-.24.23-.52.41-.84.54s-.66.2-1.01.2ZM18.61,109.8c-.52,0-1.01-.14-1.47-.41-.46-.28-.79-.63-1.01-1.07l.11-.24v4.24h-.66v-8.14h.59l.07,1.79-.13-.41c.24-.44.6-.8,1.06-1.08.47-.28.97-.43,1.53-.43.52,0,.99.13,1.41.38.42.25.75.59,1,1.03s.37.93.37,1.49-.13,1.04-.39,1.48c-.26.43-.6.77-1.04,1.01-.43.24-.92.36-1.46.36ZM18.5,109.25c.43,0,.82-.1,1.17-.31.35-.21.63-.48.84-.83.21-.35.32-.74.32-1.17s-.1-.83-.31-1.18c-.2-.35-.48-.63-.82-.83-.34-.21-.73-.31-1.15-.31s-.78.09-1.12.28c-.34.19-.61.44-.81.76-.21.32-.33.68-.36,1.08v.45c.03.38.15.73.36,1.05.21.32.48.57.81.75s.69.27,1.08.27ZM25.83,109.8c-.57,0-1.07-.13-1.51-.38s-.78-.59-1.03-1.03c-.25-.43-.37-.92-.37-1.46s.13-1.02.39-1.45.61-.79,1.06-1.05c.44-.26.93-.39,1.48-.39.65,0,1.2.19,1.64.57.44.38.76.88.96,1.5l-4.78,1.85-.2-.48,4.38-1.71-.14.2c-.16-.37-.4-.7-.72-.97-.32-.27-.72-.41-1.18-.41-.42,0-.8.1-1.13.31-.34.21-.6.48-.8.83-.2.34-.3.74-.3,1.18,0,.41.1.79.29,1.15.19.35.46.64.8.85.34.21.74.32,1.19.32.3,0,.59-.06.86-.17.27-.11.52-.26.73-.43l.34.48c-.26.21-.56.37-.9.5-.34.13-.69.2-1.04.2ZM30.84,104.22l.07,1.68-.08-.21c.12-.34.31-.62.57-.87.26-.24.55-.43.87-.56.32-.13.63-.2.93-.2l-.03.64c-.42,0-.8.09-1.14.28-.34.19-.61.44-.81.75s-.3.66-.3,1.06v2.9h-.66v-5.47h.57ZM42.85,108.83c-.11.09-.32.22-.62.38-.3.16-.67.3-1.11.42-.44.12-.92.18-1.46.17-.81-.02-1.54-.16-2.18-.44s-1.18-.65-1.62-1.13-.78-1.02-1.01-1.64c-.23-.62-.35-1.27-.35-1.97,0-.78.12-1.5.36-2.15s.58-1.22,1.02-1.69c.44-.48.97-.84,1.59-1.11s1.3-.39,2.04-.39c.69,0,1.3.09,1.83.28.53.19.97.39,1.3.6l-.8,1.92c-.23-.18-.54-.36-.93-.55-.39-.19-.83-.29-1.34-.29-.39,0-.77.08-1.13.24-.36.16-.68.39-.95.69-.28.3-.49.65-.65,1.04s-.24.83-.24,1.29c0,.49.07.95.22,1.36s.35.76.62,1.06c.27.29.59.52.97.68.38.16.8.24,1.28.24.55,0,1.02-.09,1.41-.27.39-.18.69-.36.9-.56l.84,1.82ZM44.56,98.65h1.96v11.04h-1.96v-11.04ZM51.54,109.86c-.75,0-1.38-.14-1.9-.42-.52-.28-.91-.67-1.18-1.16-.27-.49-.41-1.06-.41-1.71s.16-1.17.48-1.67c.32-.49.74-.89,1.27-1.18.53-.29,1.12-.44,1.78-.44.88,0,1.6.25,2.16.76.56.51.93,1.24,1.1,2.2l-4.76,1.51-.43-1.06,3.44-1.16-.41.18c-.07-.24-.21-.45-.4-.64-.19-.18-.48-.27-.86-.27-.29,0-.54.07-.76.2-.22.14-.39.33-.5.57-.12.25-.18.54-.18.87,0,.38.07.7.21.96.14.26.33.45.57.58.24.13.51.2.81.2.21,0,.42-.04.62-.11.2-.07.4-.17.59-.29l.87,1.45c-.33.19-.68.34-1.06.45-.38.11-.73.17-1.07.17ZM58.85,109.86c-.57,0-1.08-.11-1.55-.34s-.83-.58-1.1-1.06c-.27-.48-.41-1.08-.41-1.82,0-.69.14-1.29.42-1.79s.65-.89,1.11-1.17c.46-.28.94-.41,1.45-.41.61,0,1.07.1,1.38.3.31.2.57.42.78.66l-.08.24.18-.9h1.82v6.11h-1.96v-1.33l.15.42s-.07.05-.17.16-.23.23-.41.38c-.18.15-.41.27-.67.38s-.58.16-.94.16ZM59.41,108.26c.23,0,.44-.03.63-.11.19-.07.35-.17.49-.31.14-.14.26-.3.36-.51v-1.5c-.07-.2-.19-.38-.34-.52-.15-.14-.33-.26-.53-.34-.2-.08-.43-.12-.69-.12-.28,0-.54.07-.78.22s-.43.34-.57.59c-.14.25-.21.54-.21.87s.07.62.22.88c.15.26.35.47.59.62s.52.22.8.22ZM66.64,103.57l.15,1.09-.03-.1c.21-.38.52-.69.91-.93.39-.24.87-.36,1.44-.36s1.06.17,1.45.51c.39.34.58.78.59,1.32v4.58h-1.96v-3.85c0-.27-.08-.49-.22-.65-.14-.16-.36-.24-.68-.24-.3,0-.56.1-.78.29s-.4.46-.52.8c-.12.34-.18.72-.18,1.16v2.49h-1.96v-6.11h1.78ZM25.72,23.65c-.24-.14-.47-.28-.71-.44-2.82-1.86-4.75-4.71-5.42-8.03-.68-3.31-.02-6.69,1.84-9.51h0c1.86-2.82,4.71-4.75,8.03-5.42,3.31-.68,6.69-.02,9.51,1.84,2.82,1.86,4.75,4.71,5.42,8.03.68,3.31.02,6.69-1.84,9.51-1.86,2.82-4.71,4.75-8.03,5.42-3.04.62-6.13.12-8.8-1.41ZM25.31,8.24c-1.18,1.79-1.59,3.92-1.17,6.02.43,2.1,1.65,3.9,3.43,5.08,1.78,1.18,3.92,1.59,6.02,1.17,2.1-.43,3.9-1.65,5.08-3.43,1.18-1.79,1.59-3.92,1.17-6.02-.43-2.1-1.65-3.9-3.43-5.08-1.79-1.18-3.92-1.59-6.02-1.17-2.1.43-3.9,1.65-5.08,3.43h0ZM8.94,53.23c-5.08-4.87-5.25-12.97-.39-18.05,4.87-5.08,12.97-5.25,18.05-.39,2.87,2.75,4.29,6.67,3.86,10.61,1.58-.99,3.27-1.76,5.02-2.32-.22-4.46-2.14-8.72-5.43-11.88-7.06-6.77-18.31-6.53-25.08.54-6.77,7.06-6.53,18.31.54,25.08,3.14,3.01,7.22,4.7,11.41,4.9.98.05,1.97.02,2.95-.1.26-1.82.73-3.61,1.44-5.35-4.33,1.25-9.05.12-12.36-3.04ZM70.79,30.36h-5.42v22.84c-4.33-5.22-10.86-8.55-18.15-8.55-13,0-23.57,10.57-23.57,23.57s10.57,23.57,23.57,23.57,23.57-10.57,23.57-23.57c0-.1,0-.2,0-.3h0V30.36ZM47.22,86.37c-10.01,0-18.15-8.14-18.15-18.15s8.14-18.15,18.15-18.15,18.15,8.14,18.15,18.15-8.14,18.15-18.15,18.15Z" />
    </Svg>
  );
}

/* ─── sub-components ──────────────────────────────────────────────────────── */

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={styles.sectionHeader} numberOfLines={1}>
      {title}
    </Text>
  );
}

/**
 * Hebrew settings-style row, laid out with absolute positioning so it
 * is immune to RTL/LTR flex-direction quirks across devices.
 *
 *   ┌─────────────────────────────────────────┐
 *   │ <  1     ............ label    [icon] │
 *   └─────────────────────────────────────────┘
 *     ↑ left edge                  right edge ↑
 */
function ListRow({
  icon,
  label,
  value,
  chevron = true,
  onPress,
  destructive,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  chevron?: boolean;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const labelColor = destructive ? P.destructive : P.label;
  const iconColor = destructive ? P.destructive : P.iconColor;
  const iconBg = destructive ? '#FFF0F0' : P.iconBg;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {/* icon — absolutely positioned on the RIGHT edge */}
      <View style={[styles.iconSlot, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>

      {/* label — fills the row, with fixed padding on both sides */}
      <Text
        style={[styles.rowLabel, { color: labelColor }]}
        numberOfLines={1}
      >
        {label}
      </Text>

      {/* end cluster — chevron + optional value, on the LEFT edge */}
      <View style={styles.endSlot} pointerEvents="none">
        {value != null ? (
          <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
        ) : null}
        {chevron ? (
          <Ionicons name="chevron-back" size={15} color={P.tertiaryLabel} />
        ) : null}
      </View>
    </Pressable>
  );
}

function RowDivider() {
  return <View style={styles.rowDivider} />;
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
}: {
  onTabPress: (tabId: StoreBottomTabId) => void;
  onOpenOrders: () => void;
}) {
  const { user, signOut } = useAuth();
  const { favoriteCount } = useFavorites();
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
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
    [recentOrders],
  );

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'בוקר טוב';
    if (h < 17) return 'צהריים טובים';
    return 'ערב טוב';
  }, []);

  const listHeaderBelowHero = (
    <View style={[styles.headerStack, { paddingTop: 16 }]}>
      {/* ── stats row (gap below fixed hero matches previous headerStack layout) ── */}
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

      {/* ── orders + addresses — single card (no split sections) ── */}
      <View>
        <View style={styles.listCard}>
          <ListRow
            icon="bag-outline"
            label="היסטוריית הזמנות"
            onPress={onOpenOrders}
          />
          <RowDivider />
          <ListRow
            icon="location-outline"
            label="כתובות שמורות"
            onPress={() => Toast.show({ type: 'info', text1: 'ניהול כתובות יתווסף בהמשך' })}
          />
        </View>
      </View>

      {/* ── recent orders header ── */}
      <View style={styles.sectionTitleRow}>
        <SectionHeader title="הזמנות אחרונות" />
        <Pressable onPress={onOpenOrders} hitSlop={8}>
          <Text style={styles.seeAll}>הכל</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.screenRoot}>
      <View style={styles.root}>
        {/* Hero fixed outside FlatList — avoids bounce gap between status bar and dark header */}
        <View style={styles.heroLightWrap}>
          <View style={[styles.headerBg, { paddingTop: insets.top }]}>
            <View style={styles.topBar}>
              <View style={styles.greetingWrap}>
                <Text style={styles.greetingLine}>{greeting},</Text>
                <Text style={styles.greetingName} numberOfLines={1}>
                  {user?.name ?? 'שם משתמש'}
                </Text>
              </View>
              <View style={styles.logoWrap} pointerEvents="none">
                <OcdLogo height={72} />
              </View>
            </View>
          </View>
        </View>

        <FlatList
          data={recentOrders}
          keyExtractor={(item) => item.id}
          style={styles.listFill}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: contentPaddingBottom + 16, flexGrow: 1 }}
          ListHeaderComponent={listHeaderBelowHero}
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
              {/* icon — absolute, RIGHT */}
              <View style={styles.orderIconSlot}>
                <Ionicons
                  name={item.status === 'delivered' ? 'checkmark-circle-outline' : 'cube-outline'}
                  size={22}
                  color={P.iconColor}
                />
              </View>

              {/* main meta — flex-fills with padding */}
              <View style={styles.orderMeta}>
                <Text style={styles.orderTitle} numberOfLines={1}>
                  {item.status === 'confirmed' ? 'בדרך אליך' : getOrderStatusLabel(item.status)}
                </Text>
                <Text style={styles.orderSub} numberOfLines={1}>
                  {formatOrderDate(item.created_at)} · #{item.order_number}
                </Text>
              </View>

              {/* end — absolute, LEFT */}
              <View style={styles.orderEndSlot} pointerEvents="none">
                <Text style={styles.orderPrice}>
                  {formatOrderPrice(item.total_amount, item.currency_code)}
                </Text>
                <Ionicons name="chevron-back" size={16} color={P.tertiaryLabel} />
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            loading ? (
              <View style={[styles.listCard, styles.emptyCard]}>
                <ActivityIndicator size="small" color={P.iconColor} />
                <Text style={styles.emptyText}>טוען הזמנות…</Text>
              </View>
            ) : (
              <View style={[styles.listCard, styles.emptyCard]}>
                <Ionicons name="bag-outline" size={32} color={P.tertiaryLabel} />
                <Text style={styles.emptyTitle}>אין הזמנות עדיין</Text>
                <Text style={styles.emptyText}>ברגע שתבצע רכישה היא תופיע כאן.</Text>
                <View style={styles.emptyActions}>
                  <Button title="התנתקות" fullWidth={false} variant="secondary" onPress={() => void signOut()} />
                </View>
              </View>
            )
          }
        />

        {recentOrders.length > 0 && (
          <View style={[styles.listCard, styles.signOutCard]}>
            <ListRow
              icon="log-out-outline"
              label="התנתקות"
              chevron={false}
              destructive
              onPress={() => void signOut()}
            />
          </View>
        )}

        <StoreFloatingTabBar activeTab="profile" onTabPress={onTabPress} />
      </View>
    </View>
  );
}

/* ─── styles ──────────────────────────────────────────────────────────────── */
const ROW_HEIGHT = 56;
const ICON_SIZE = 32;
const SIDE_PADDING = 16;

const styles = StyleSheet.create({
  screenRoot: { flex: 1, backgroundColor: P.bg },
  root: { flex: 1, backgroundColor: P.bg },
  /** Same role as store home: light strip so rounded header corners read cleanly */
  heroLightWrap: { backgroundColor: P.bg },
  listFill: { flex: 1, backgroundColor: P.bg },

  headerStack: { gap: 16, paddingTop: 0 },

  /* top bar — dark slab with rounded bottom corners */
  headerBg: {
    backgroundColor: colors.adminHeader,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  topBar: {
    position: 'relative',
    paddingTop: 20,
    paddingBottom: 26,
    minHeight: 96,
    justifyContent: 'center',
  },
  logoWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  /** Right half of header — avoids overlapping centered logo; extra inset from screen edge */
  greetingWrap: {
    position: 'absolute',
    right: 24,
    width: '50%',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  greetingLine: {
    width: '100%',
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'right',
    letterSpacing: 0.2,
  },
  greetingName: {
    width: '100%',
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'right',
    letterSpacing: -0.3,
  },

  /* stats */
  statsCard: {
    marginHorizontal: 20,
    backgroundColor: P.card,
    borderRadius: 16,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: P.separator,
  },
  statPill: { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 2 },
  statValue: { fontSize: 20, fontWeight: '700', color: P.label, letterSpacing: -0.5 },
  statLabel: { fontSize: 12, color: P.tertiaryLabel },
  statsSep: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: P.separator,
    marginVertical: 14,
  },

  /* section headers */
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: P.tertiaryLabel,
    textAlign: 'right',
    paddingHorizontal: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  seeAll: { fontSize: 14, color: P.secondaryLabel, fontWeight: '500' },

  /* list card */
  listCard: {
    marginHorizontal: 20,
    backgroundColor: P.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: P.separator,
  },

  /* ── absolute-positioned row ── */
  row: {
    position: 'relative',
    minHeight: ROW_HEIGHT,
    backgroundColor: P.card,
    justifyContent: 'center',
  },
  rowPressed: { backgroundColor: P.bg },

  /* icon pinned to RIGHT, vertically centered via top:0/bottom:0 + justifyContent */
  iconSlot: {
    position: 'absolute',
    right: SIDE_PADDING,
    top: (ROW_HEIGHT - ICON_SIZE) / 2,
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* label fills row width, padded for icon (right) and chevron (left) */
  rowLabel: {
    fontSize: 16,
    textAlign: 'right',
    paddingLeft: 50,
    paddingRight: SIDE_PADDING + ICON_SIZE + 12,
    paddingVertical: 16,
  },

  /* chevron + value cluster pinned to LEFT */
  endSlot: {
    position: 'absolute',
    left: SIDE_PADDING,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowValue: { fontSize: 14, color: P.tertiaryLabel },

  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: P.separator,
    marginRight: SIDE_PADDING + ICON_SIZE + 12,
    marginLeft: SIDE_PADDING,
  },

  /* ── order rows (same absolute pattern, slightly larger) ── */
  orderRow: {
    position: 'relative',
    minHeight: 68,
    backgroundColor: P.card,
    marginHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: P.separator,
    justifyContent: 'center',
  },
  orderRowFirst: { borderTopLeftRadius: 16, borderTopRightRadius: 16, marginTop: 0 },
  orderRowLast: { borderBottomWidth: 0, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  orderIconSlot: {
    position: 'absolute',
    right: SIDE_PADDING,
    top: (68 - 42) / 2,
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: P.iconBg,
  },
  orderMeta: {
    paddingRight: SIDE_PADDING + 42 + 12,
    paddingLeft: 90,
    paddingVertical: 12,
    alignItems: 'flex-end',
    gap: 2,
  },
  orderTitle: { fontSize: 15, fontWeight: '600', color: P.label, textAlign: 'right' },
  orderSub: { fontSize: 12, color: P.tertiaryLabel, textAlign: 'right' },
  orderEndSlot: {
    position: 'absolute',
    left: SIDE_PADDING,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderPrice: { fontSize: 15, fontWeight: '600', color: P.label },

  /* empty state */
  emptyCard: { alignItems: 'center', paddingVertical: 36, gap: 8, marginTop: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: P.label },
  emptyText: { fontSize: 14, color: P.tertiaryLabel, textAlign: 'center' },
  emptyActions: { flexDirection: 'row', gap: 8, marginTop: 4 },

  /* sign-out */
  signOutCard: { marginBottom: 16, marginTop: 8 },
});
