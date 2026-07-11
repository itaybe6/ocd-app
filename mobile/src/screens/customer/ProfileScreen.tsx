import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Toast from '../../components/toast/Toast';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatOrderDate, formatOrderPrice } from '../../lib/orders';
import { supabase } from '../../lib/supabase';
import type { OcdPlusStatus } from '../../lib/ocdPlus';
import { useAuth } from '../../state/AuthContext';
import { useFavorites } from '../../state/FavoritesContext';
import { useOcdPlusMembership } from '../../state/useOcdPlusMembership';
import { getStoreBottomBarMetrics, StoreFloatingTabBar, type StoreBottomTabId } from '../store/StoreHomeScreen';
import type { CustomerOrderRow } from '../../types/database';

/* ─── palette (minimal, monochrome) ───────────────────────────────────────── */
const P = {
  bg: '#EEEEEE',
  card: '#FFFFFF',
  separator: '#ECECEC',
  label: '#111111',
  secondaryLabel: '#555555',
  tertiaryLabel: '#999999',
  destructive: '#D94040',
  iconBg: '#F0F0F0',
  iconColor: '#444444',
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const STORE_LOGO = require('../../../assets/logopng/OCDLOGO-04.png');

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

function ocdPlusStatusLabel(status: OcdPlusStatus): string {
  switch (status) {
    case 'active':
      return 'פעיל';
    case 'pending':
      return 'ממתין לתשלום';
    case 'past_due':
      return 'תשלום נכשל';
    case 'cancelled':
      return 'בוטל';
    default:
      return 'לא פעיל';
  }
}

function DeleteAccountDialog({
  visible,
  deleting,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={() => {
        if (!deleting) onCancel();
      }}
    >
      <View style={styles.dialogBackdrop}>
        <View style={styles.dialogCard}>
          <View style={styles.dialogIcon}>
            <Ionicons name="trash-outline" size={24} color={P.destructive} />
          </View>

          <Text style={styles.dialogTitle}>מחיקת חשבון</Text>
          <Text style={styles.dialogBody}>
            החשבון שלך, המועדפים והיסטוריית ההזמנות יימחקו לצמיתות. לא ניתן לבטל פעולה זו.
          </Text>

          <View style={styles.dialogActions}>
            <Pressable
              disabled={deleting}
              onPress={onCancel}
              style={({ pressed }) => [styles.dialogButton, styles.dialogCancelButton, pressed && styles.dialogPressed]}
            >
              <Text style={styles.dialogCancelText}>ביטול</Text>
            </Pressable>

            <Pressable
              disabled={deleting}
              onPress={onConfirm}
              style={({ pressed }) => [styles.dialogButton, styles.dialogDeleteButton, pressed && styles.dialogPressed]}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.dialogDeleteText}>מחק חשבון</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ─── main screen ─────────────────────────────────────────────────────────── */

export function CustomerProfileScreen({
  onTabPress,
  onOpenOrders,
  onOpenOrder,
  onOpenAddresses,
  onOpenOcdPlus,
}: {
  onTabPress: (tabId: StoreBottomTabId) => void;
  onOpenOrders: () => void;
  onOpenOrder: (orderId: string) => void;
  onOpenAddresses: () => void;
  onOpenOcdPlus: () => void;
}) {
  const { user, signOut, deleteCustomerAccount } = useAuth();
  const { favoriteCount } = useFavorites();
  const { status: ocdPlusStatus, loading: ocdPlusLoading } = useOcdPlusMembership();
  const isCustomer = user?.role === 'customer';
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const [recentOrders, setRecentOrders] = useState<CustomerOrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

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

  const confirmDeleteAccount = useCallback(() => {
    if (deletingAccount) return;
    setDeleteConfirmVisible(true);
  }, [deletingAccount]);

  const handleDeleteAccount = useCallback(async () => {
    try {
      setDeletingAccount(true);
      await deleteCustomerAccount();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'מחיקת החשבון נכשלה', text2: e?.message ?? 'Unknown error' });
      setDeletingAccount(false);
      setDeleteConfirmVisible(false);
    }
  }, [deleteCustomerAccount]);

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
      <View style={styles.greetingWrap}>
        <Text style={styles.greetingLine}>{greeting},</Text>
        <Text style={styles.greetingName} numberOfLines={1}>
          {user?.name ?? 'שם משתמש'}
        </Text>
      </View>

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
          {isCustomer ? (
            <>
              <ListRow
                icon="ribbon-outline"
                label="מנוי OCD+"
                value={ocdPlusLoading ? '…' : ocdPlusStatusLabel(ocdPlusStatus)}
                onPress={onOpenOcdPlus}
              />
              <RowDivider />
            </>
          ) : null}
          <ListRow
            icon="bag-outline"
            label="היסטוריית הזמנות"
            onPress={onOpenOrders}
          />
          <RowDivider />
          <ListRow
            icon="location-outline"
            label="כתובות שמורות"
            onPress={onOpenAddresses}
          />
        </View>
      </View>

      {/* ── recent orders header ── */}
      <SectionHeader title="הזמנות אחרונות" />
    </View>
  );

  const listFooterSettings = (
    <View style={styles.settingsFooter}>
      <SectionHeader title="הגדרות" />
      <View style={styles.listCard}>
        <ListRow
          icon="trash-outline"
          label={deletingAccount ? 'מוחק חשבון…' : 'מחיקת חשבון'}
          chevron={false}
          destructive
          onPress={confirmDeleteAccount}
        />
        <RowDivider />
        <ListRow
          icon="log-out-outline"
          label="התנתקות"
          chevron={false}
          onPress={() => void signOut()}
        />
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
              <Image
                source={STORE_LOGO}
                style={styles.headerLogo}
                resizeMode="contain"
                tintColor="#FFFFFF"
              />
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
          ListFooterComponent={listFooterSettings}
          renderItem={({ item }) => (
            <View style={styles.orderCardOuter}>
              <Pressable
                onPress={() => onOpenOrder(item.id)}
                style={({ pressed }) => [styles.orderCard, pressed && styles.rowPressed]}
              >
                <View style={styles.orderCardHeader}>
                  <View style={styles.orderHeaderCopy}>
                    <Text style={styles.orderEyebrow}>הזמנה שבוצעה</Text>
                    <Text style={styles.orderNumber}>#{item.order_number}</Text>
                  </View>
                  <View style={styles.orderHeaderIcon}>
                    <Ionicons name="arrow-back" size={17} color="#111111" />
                  </View>
                </View>

                <View style={styles.orderCardBody}>
                  <View style={styles.orderBodyCell}>
                    <Text style={styles.orderColumnLabel}>תאריך ושעה</Text>
                    <Text style={styles.orderDate} numberOfLines={1}>
                      {formatOrderDate(item.created_at)}
                    </Text>
                  </View>
                  <View style={styles.orderBodyDivider} />
                  <View style={styles.orderBodyCell}>
                    <Text style={styles.orderColumnLabel}>סה״כ לתשלום</Text>
                    <Text style={styles.orderPrice}>
                      {formatOrderPrice(item.total_amount, item.currency_code)}
                    </Text>
                  </View>
                </View>

                <View style={styles.orderTapHint}>
                  <Text style={styles.orderTapHintText}>לחץ לצפייה בפרטי ההזמנה</Text>
                  <Ionicons name="chevron-back" size={14} color="#8A8A8A" />
                </View>
              </Pressable>
            </View>
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
              </View>
            )
          }
        />

        <DeleteAccountDialog
          visible={deleteConfirmVisible}
          deleting={deletingAccount}
          onCancel={() => setDeleteConfirmVisible(false)}
          onConfirm={handleDeleteAccount}
        />

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
  settingsFooter: { gap: 0, marginTop: 16 },

  /* top bar — black slab with rounded bottom corners (matches store chrome) */
  headerBg: {
    backgroundColor: '#000000',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  topBar: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    paddingBottom: 20,
    minHeight: 72,
  },
  headerLogo: {
    width: 115,
    height: 42,
  },
  greetingWrap: {
    paddingHorizontal: 20,
    alignItems: 'flex-end',
    gap: 2,
  },
  greetingLine: {
    fontSize: 13,
    color: P.tertiaryLabel,
    textAlign: 'right',
    letterSpacing: 0.2,
  },
  greetingName: {
    fontSize: 22,
    fontWeight: '700',
    color: P.label,
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

  /* ── recent order cards ── */
  orderCardOuter: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#111111',
    borderRadius: 22,
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
    overflow: 'hidden',
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    overflow: 'hidden',
  },
  orderCardHeader: {
    minHeight: 78,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#111111',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  orderHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderHeaderCopy: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  orderEyebrow: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  orderNumber: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'right',
  },
  orderBrandMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBrandText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  orderCardBody: {
    minHeight: 86,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
  },
  orderBodyCell: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    gap: 7,
  },
  orderBodyDivider: {
    width: StyleSheet.hairlineWidth,
    height: 46,
    backgroundColor: P.separator,
  },
  orderColumnLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#737373',
    textAlign: 'center',
  },
  orderDate: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111111',
    textAlign: 'center',
  },
  orderPrice: {
    fontSize: 19,
    fontWeight: '900',
    color: '#111111',
    textAlign: 'center',
  },
  orderTapHint: {
    minHeight: 40,
    paddingHorizontal: 18,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#F7F7F7',
  },
  orderTapHintText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8A8A8A',
  },

  /* empty state */
  emptyCard: { alignItems: 'center', paddingVertical: 36, gap: 8, marginTop: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: P.label },
  emptyText: { fontSize: 14, color: P.tertiaryLabel, textAlign: 'center' },

  /* custom dialogs */
  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.46)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    padding: 22,
    alignItems: 'stretch',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  dialogIcon: {
    alignSelf: 'flex-end',
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  dialogTitle: {
    color: P.label,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 8,
  },
  dialogBody: {
    color: P.secondaryLabel,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 20,
  },
  dialogActions: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  dialogButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCancelButton: {
    backgroundColor: P.bg,
    borderWidth: 1,
    borderColor: P.separator,
  },
  dialogDeleteButton: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: P.destructive,
  },
  dialogPressed: {
    opacity: 0.9,
  },
  dialogCancelText: {
    color: P.label,
    fontSize: 15,
    fontWeight: '800',
  },
  dialogDeleteText: {
    color: '#991B1B',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
