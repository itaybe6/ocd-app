import { radii } from '../../theme/radii';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { ModalDialog } from '../../components/ModalDialog';
import Toast from '../../components/toast/Toast';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { isLocalDemoUser } from '../../lib/localDemoAccount';
import type { OcdPlusStatus } from '../../lib/ocdPlus';
import { useAuth } from '../../state/AuthContext';
import { useFavorites } from '../../state/FavoritesContext';
import { useOcdPlusMembership } from '../../state/useOcdPlusMembership';
import { getStoreBottomBarMetrics, StoreFloatingTabBar, type StoreBottomTabId } from '../store/StoreHomeScreen';
import type { CustomerOrderRow } from '../../types/database';
import { AccountSection, AccountLoading, AccountOrderRow, accountColors as C } from './AccountUI';

const P = { label: C.ink, secondaryLabel: C.muted, destructive: C.red, card: C.bg, separator: C.line };

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
    <ModalDialog
      visible={visible}
      onClose={() => {
        if (!deleting) onCancel();
      }}
      containerStyle={styles.dialogCard}
    >
      <View style={styles.dialogContent}>
        <View style={styles.dialogIconWrap}>
          <View style={styles.dialogIcon}>
            <Ionicons name="trash-outline" size={26} color={P.destructive} />
          </View>
        </View>

        <Text style={styles.dialogTitle}>מחיקת חשבון</Text>
        <Text style={styles.dialogBody}>
          החשבון שלך, המועדפים והיסטוריית ההזמנות יימחקו לצמיתות.
        </Text>

        <View style={styles.dialogWarningBox}>
          <Ionicons name="alert-circle-outline" size={18} color={P.destructive} />
          <Text style={styles.dialogWarningText}>לא ניתן לבטל פעולה זו.</Text>
        </View>

        <View style={styles.dialogActions}>
          <Pressable
            disabled={deleting}
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.dialogButtonPressable,
              deleting && styles.dialogButtonDisabled,
              pressed && !deleting && styles.dialogPressed,
            ]}
          >
            <View style={[styles.dialogButton, styles.dialogDeleteButton]}>
              {deleting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.dialogDeleteText}>מחק חשבון</Text>
              )}
            </View>
          </Pressable>

          <Pressable
            disabled={deleting}
            onPress={onCancel}
            style={({ pressed }) => [
              styles.dialogButtonPressable,
              deleting && styles.dialogButtonDisabled,
              pressed && !deleting && styles.dialogPressed,
            ]}
          >
            <View style={[styles.dialogButton, styles.dialogCancelButton]}>
              <Text style={styles.dialogCancelText}>ביטול</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </ModalDialog>
  );
}

function ProfileShortcut({ icon, title, subtitle, value, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; value?: string; onPress: () => void;
}) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={[title, value, subtitle].filter(Boolean).join(', ')} style={styles.shortcut}>
    <View style={styles.shortcutTop}>
      <Ionicons name={icon} size={24} color={C.ink} />
      {value != null ? <Text style={styles.shortcutValue}>{value}</Text> : <Ionicons name="arrow-back" size={17} color="#9A9A9A" />}
    </View>
    <Text style={styles.shortcutTitle}>{title}</Text>
    <Text style={styles.shortcutSubtitle}>{subtitle}</Text>
  </Pressable>;
}

function ProfileLink({ icon, title, subtitle, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; onPress: () => void;
}) {
  return <Pressable onPress={onPress} accessibilityRole="button" style={styles.detailRow}>
    <View style={styles.detailIcon}><Ionicons name={icon} size={21} color="#424242" /></View>
    <View style={styles.detailCopy}><Text style={styles.detailTitle}>{title}</Text><Text style={styles.detailSubtitle}>{subtitle}</Text></View>
    <Ionicons name="chevron-back" size={15} color="#939393" />
  </Pressable>;
}

export function CustomerProfileScreen({
  onTabPress,
  onOpenOrders,
  onOpenOrder,
  onOpenAddresses,
  onOpenOcdPlus,
  onOpenPersonalDetails,
}: {
  onTabPress: (tabId: StoreBottomTabId) => void;
  onOpenOrders: () => void;
  onOpenOrder: (orderId: string) => void;
  onOpenAddresses: () => void;
  onOpenOcdPlus: () => void;
  onOpenPersonalDetails: () => void;
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
    if (isLocalDemoUser(user.id)) { setRecentOrders([]); setLoading(false); return; }
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

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'בוקר טוב';
    if (h < 17) return 'צהריים טובים';
    return 'ערב טוב';
  }, []);

  const nameParts = user?.name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const initials = nameParts.length
    ? [nameParts[0], ...(nameParts.length > 1 ? [nameParts[nameParts.length - 1]] : [])]
        .map((part) => Array.from(part)[0]).join('')
    : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <FlatList
        data={recentOrders}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: contentPaddingBottom + 24 }}
        ListHeaderComponent={
          <>
            <View style={styles.intro}>
              <View style={styles.introCopy}>
                <Text style={styles.greeting}>{greeting},</Text>
                <Text style={styles.name}>{user?.name?.trim() || 'ברוכים הבאים'}</Text>
              </View>
              <Pressable onPress={onOpenPersonalDetails} accessibilityRole="button" accessibilityLabel="עריכת הפרטים האישיים" style={styles.avatar}>
                {initials ? <Text style={styles.initials}>{initials}</Text> : <Ionicons name="person-outline" size={23} color={C.ink} />}
                <View style={styles.avatarEdit}><Ionicons name="pencil" size={10} color="#FFFFFF" /></View>
              </Pressable>
            </View>
            {isCustomer ? (
              <Pressable onPress={onOpenOcdPlus} accessibilityRole="button" accessibilityLabel="פרטי מנוי OCD+" style={styles.membershipLink}>
                <View style={styles.membershipTop}>
                  <Text style={styles.membershipEyebrow}>המועדון שלכם</Text>
                  <View style={styles.membershipStatusRow}>
                    {!ocdPlusLoading && ocdPlusStatus === 'active' ? <Ionicons name="checkmark" size={12} color="#DDD1B5" /> : null}
                    <Text style={styles.membershipStatus}>{ocdPlusLoading ? 'טוען פרטי מנוי…' : ocdPlusStatusLabel(ocdPlusStatus)}</Text>
                  </View>
                </View>
                <View style={styles.membershipBody}>
                  <View style={styles.membershipCopy}>
                    <Text style={styles.membershipTitle}>הטבות בכל קנייה.</Text>
                    <Text style={styles.membershipNote}>כל מה שמגיע לכם כחברי OCD+</Text>
                  </View>
                  <Image source={require('../../../assets/ocdplus-membership-card-cutout.png')} resizeMode="contain" style={styles.memberCard} accessible={false} />
                </View>
                <View style={styles.membershipFooter}>
                  <Text style={styles.membershipAction}>למועדון שלי</Text>
                  <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
                </View>
              </Pressable>
            ) : null}
            <View style={styles.shortcuts}>
              <ProfileShortcut icon="bag-handle-outline" title="ההזמנות שלי" subtitle="למעקב ופרטי הזמנות" onPress={onOpenOrders} />
              <ProfileShortcut icon="heart-outline" title="המועדפים שלי" subtitle="כל מה ששמרתם" value={String(favoriteCount)} onPress={() => onTabPress('favorites')} />
            </View>
            <View style={styles.details}>
              <ProfileLink icon="person-outline" title="פרטים אישיים" subtitle="שם ומספר הטלפון שלכם" onPress={onOpenPersonalDetails} />
              <View style={styles.detailDivider} />
              <ProfileLink icon="location-outline" title="הכתובת שלי" subtitle="כתובת המשלוח השמורה" onPress={onOpenAddresses} />
            </View>
            <AccountSection title="הזמנות אחרונות" action="לכל ההזמנות" onPress={onOpenOrders} />
          </>
        }
        renderItem={({ item }) => <View style={styles.orderCard}><AccountOrderRow order={item} onPress={() => onOpenOrder(item.id)} /></View>}
        ListEmptyComponent={loading ? <AccountLoading label="טוען הזמנות…" /> : (
          <View style={styles.emptyOrders}>
            <View style={styles.emptyTop}>
              <View style={styles.emptyIcon}><Ionicons name="bag-handle-outline" size={24} color="#747474" /></View>
              <View style={styles.detailCopy}>
                <Text style={styles.emptyTitle}>עוד לא הזמנתם?</Text>
                <Text style={styles.detailSubtitle}>ההזמנות שלכם יופיעו כאן, מסודרות במקום אחד.</Text>
              </View>
            </View>
            <Pressable onPress={() => onTabPress('home')} accessibilityRole="button" style={styles.shopAction}>
              <Text style={styles.shopActionText}>בואו למצוא משהו לבית</Text><Ionicons name="arrow-back" size={15} color={C.ink} />
            </Pressable>
          </View>
        )}
        ListFooterComponent={
          <View style={styles.settings}>
            <Pressable onPress={() => void signOut()} accessibilityRole="button" style={styles.logout}>
              <Ionicons name="log-out-outline" size={19} color={C.ink} />
              <Text style={styles.logoutText}>התנתקות מהחשבון</Text>
            </Pressable>
            <Pressable onPress={confirmDeleteAccount} disabled={deletingAccount} accessibilityRole="button" accessibilityState={{ disabled: deletingAccount }} style={styles.deleteLink}>
              <Text style={styles.deleteText}>{deletingAccount ? 'מוחק חשבון…' : 'מחיקת החשבון'}</Text>
            </Pressable>
          </View>
        }
      />
      <DeleteAccountDialog visible={deleteConfirmVisible} deleting={deletingAccount} onCancel={() => setDeleteConfirmVisible(false)} onConfirm={handleDeleteAccount} />
      <StoreFloatingTabBar activeTab="profile" onTabPress={onTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F7F7' },
  intro: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', gap: 16, paddingTop: 18, paddingBottom: 24 },
  introCopy: { flex: 1, gap: 3 },
  greeting: { color: C.muted, fontSize: 13, lineHeight: 20, textAlign: 'right', writingDirection: 'rtl' },
  name: { color: C.ink, fontSize: 26, lineHeight: 35, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  avatar: { width: 52, height: 52, borderRadius: radii.pill, backgroundColor: '#ECECEC', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#444444', fontSize: 17, fontWeight: '600' },
  avatarEdit: { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: radii.pill, borderWidth: 2, borderColor: '#F7F7F7', backgroundColor: '#202020', alignItems: 'center', justifyContent: 'center' },
  membershipLink: { backgroundColor: '#202020', borderRadius: radii.surface, paddingHorizontal: 18, paddingTop: 15, marginBottom: 16 },
  membershipTop: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  membershipEyebrow: { color: '#CDCDCD', fontSize: 11, lineHeight: 17, textAlign: 'right' },
  membershipStatusRow: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', gap: 4, borderRadius: radii.pill, backgroundColor: '#323232', paddingHorizontal: 8, paddingVertical: 3 },
  membershipStatus: { color: '#DDD1B5', fontSize: 10, lineHeight: 15, textAlign: 'right', flexShrink: 1 },
  membershipBody: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingVertical: 8 },
  membershipCopy: { flex: 1, gap: 5 },
  membershipTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', lineHeight: 27, textAlign: 'right', writingDirection: 'rtl' },
  membershipNote: { color: '#BCBCBC', fontSize: 11, lineHeight: 17, textAlign: 'right', writingDirection: 'rtl' },
  memberCard: { width: '42%', height: 86 },
  membershipFooter: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, borderTopWidth: 1, borderTopColor: '#3A3A3A' },
  membershipAction: { color: '#F2F2F2', fontSize: 12, fontWeight: '600', textAlign: 'right' },
  shortcuts: { direction: 'ltr', flexDirection: 'row-reverse', gap: 12, marginBottom: 16 },
  shortcut: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: radii.surface, borderWidth: 1, borderColor: '#EBEBEB', padding: 15 },
  shortcutTop: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  shortcutValue: { fontSize: 19, lineHeight: 24, color: '#686868', fontWeight: '500', fontVariant: ['tabular-nums'] },
  shortcutTitle: { color: C.ink, fontSize: 15, lineHeight: 22, fontWeight: '600', textAlign: 'right' },
  shortcutSubtitle: { color: C.muted, fontSize: 11, lineHeight: 18, textAlign: 'right', marginTop: 2 },
  details: { backgroundColor: '#FFFFFF', borderRadius: radii.surface, borderWidth: 1, borderColor: '#EBEBEB', paddingHorizontal: 14 },
  detailRow: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', gap: 12, minHeight: 72, paddingVertical: 12 },
  detailIcon: { width: 34, alignItems: 'center' },
  detailCopy: { flex: 1, gap: 3 },
  detailTitle: { fontSize: 14, lineHeight: 21, fontWeight: '600', color: C.ink, textAlign: 'right' },
  detailSubtitle: { fontSize: 11, lineHeight: 18, color: C.muted, textAlign: 'right', writingDirection: 'rtl' },
  detailDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EAEAEA', marginRight: 46 },
  orderCard: { backgroundColor: '#FFFFFF', borderRadius: radii.surface, paddingHorizontal: 16, marginBottom: 10 },
  emptyOrders: { backgroundColor: '#FFFFFF', borderRadius: radii.surface, padding: 16, borderWidth: 1, borderColor: '#EBEBEB' },
  emptyTop: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  emptyIcon: { width: 44, height: 44, borderRadius: radii.compact, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: C.ink, fontSize: 14, lineHeight: 22, fontWeight: '600', textAlign: 'right' },
  shopAction: { direction: 'ltr', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EAEAEA', paddingTop: 6 },
  shopActionText: { color: C.ink, fontSize: 12, fontWeight: '500', textAlign: 'right' },
  settings: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12, marginTop: 16, gap: 2 },
  logout: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, minHeight: 48 },
  logoutText: { color: C.ink, fontSize: 14, textAlign: 'right' },
  deleteLink: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', paddingHorizontal: 3 },
  deleteText: { color: C.red, fontSize: 12, textAlign: 'right' },
  dialogCard: {
    borderRadius: radii.sheet,
    borderWidth: 0,
    padding: 0,
    overflow: 'hidden',
    maxWidth: 340,
    alignSelf: 'center',
  },
  dialogContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    gap: 12,
  },
  dialogIconWrap: {
    alignItems: 'center',
    marginBottom: 4,
  },
  dialogIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.compact,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogTitle: {
    color: P.label,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  dialogBody: {
    color: P.secondaryLabel,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  dialogWarningBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF5F5',
    borderRadius: radii.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#FCDCDC',
    marginTop: 2,
    marginBottom: 6,
  },
  dialogWarningText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  dialogActions: {
    gap: 10,
    marginTop: 4,
  },
  dialogButtonPressable: {
    width: '100%',
  },
  dialogButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: radii.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  dialogDeleteButton: {
    backgroundColor: P.destructive,
  },
  dialogCancelButton: {
    backgroundColor: P.card,
    borderWidth: 1,
    borderColor: P.separator,
  },
  dialogButtonDisabled: {
    opacity: 0.65,
  },
  dialogPressed: {
    opacity: 0.88,
  },
  dialogCancelText: {
    color: P.label,
    fontSize: 16,
    fontWeight: '700',
  },
  dialogDeleteText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
});
