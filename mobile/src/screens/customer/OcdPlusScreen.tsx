import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { OcdPlusStatus } from '../../lib/ocdPlus';
import { useOcdPlusMembership } from '../../state/useOcdPlusMembership';
import { OCD_PLUS_CHECKLIST_ITEMS, OCD_PLUS_MONTHLY_PRICE_ILS } from '../../components/ocdPlusBenefits';
import { getStoreBottomBarMetrics, StoreFloatingTabBar, type StoreBottomTabId } from '../store/StoreHomeScreen';
import { AccountHeader, AccountMembershipMark, AccountSection, AccountButton, AccountLoading, accountColors as C } from './AccountUI';

function formatBillingDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function statusLabel(status: OcdPlusStatus): string {
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

export function CustomerOcdPlusScreen({
  onBack,
  onTabPress,
}: {
  onBack: () => void;
  onTabPress: (tabId: StoreBottomTabId) => void;
}) {
  const insets = useSafeAreaInsets();
  const { contentPaddingBottom } = getStoreBottomBarMetrics(insets.bottom);
  const { status, subscription, loading, busy, startPurchase, cancel } = useOcdPlusMembership();

  const isActive = status === 'active';
  const nextBillingLabel = useMemo(
    () => formatBillingDate(subscription?.next_billing_at ?? subscription?.current_period_end),
    [subscription?.next_billing_at, subscription?.current_period_end],
  );

  const statusNote =
    status === 'pending'
      ? 'ההצטרפות ממתינה להשלמת התשלום.'
      : status === 'past_due'
        ? 'התשלום האחרון נכשל. אפשר לנסות שוב כדי לחדש את ההטבות.'
        : status === 'cancelled'
          ? 'המנוי בוטל. אפשר להצטרף מחדש בכל עת.'
          : null;

  return (
    <View style={styles.root}>
      <AccountHeader onBack={onBack} />
      {loading && status === 'none' ? <AccountLoading label="טוען פרטי מנוי…" /> : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 26, paddingTop: 24, paddingBottom: contentPaddingBottom + 24 }}>
          <AccountMembershipMark />
          <View style={styles.status}>
            <Ionicons name={isActive ? 'checkmark' : 'ellipse-outline'} size={13} color={C.muted} />
            <Text style={styles.statusText}>{statusLabel(status)}</Text>
          </View>
          <Text style={styles.title}>{isActive ? 'טוב שאתם איתנו.' : 'יותר מכל קנייה.'}</Text>
          <Text style={styles.subtitle}>{isActive ? 'ההנחות וההטבות שלכם כבר פעילות בחנות.' : 'הנחות קבועות והטבות לחברי המועדון.'}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>₪{OCD_PLUS_MONTHLY_PRICE_ILS}</Text>
            <Text style={styles.priceUnit}>לחודש</Text>
          </View>
          <View style={styles.billing}>
            <Text style={styles.billingLabel}>{isActive ? (subscription?.cancel_at_period_end ? 'סיום המנוי' : 'החיוב הבא') : 'תנאי המנוי'}</Text>
            <Text style={styles.billingValue}>{isActive ? (nextBillingLabel ?? 'התאריך יתעדכן בקרוב') : 'ללא התחייבות'}</Text>
          </View>
          <AccountSection title="כל מה שכלול" />
          <View style={styles.benefits}>
            {OCD_PLUS_CHECKLIST_ITEMS.map((item, index) => (
              <View key={item.lead} style={styles.benefit}>
                <Text style={styles.benefitNumber}>{String(index + 1).padStart(2, '0')}</Text>
                <Text style={styles.benefitText}><Text style={styles.benefitLead}>{item.lead}</Text>{item.tail}</Text>
              </View>
            ))}
          </View>
          {statusNote ? <Text style={styles.note}>{statusNote}</Text> : null}
          {isActive && subscription?.cancel_at_period_end ? (
            <Text style={styles.note}>ביקשתם לבטל את המנוי. ההטבות יישארו פעילות עד סוף התקופה הנוכחית.</Text>
          ) : null}
          <View style={styles.action}>
            {isActive ? <AccountButton label="לחנות ולהטבות שלכם" onPress={() => onTabPress('home')} /> : <AccountButton label={busy ? 'פותחים את התשלום…' : 'מצטרפים למועדון'} onPress={startPurchase} busy={busy} />}
          </View>
          {isActive && !subscription?.cancel_at_period_end ? (
            <Pressable onPress={cancel} disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} style={styles.cancel}>
              <Text style={styles.cancelText}>{busy ? 'מבטל…' : 'ביטול המנוי'}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
      <StoreFloatingTabBar activeTab="profile" onTabPress={onTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  status: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 8, marginBottom: 18 },
  statusText: { color: C.muted, fontSize: 12, lineHeight: 18 },
  title: { color: C.ink, fontSize: 29, lineHeight: 38, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: C.muted, fontSize: 13, lineHeight: 22, textAlign: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 8, marginTop: 24, marginBottom: 24 },
  price: { color: C.ink, fontSize: 42, lineHeight: 50, fontWeight: '600', letterSpacing: -1, writingDirection: 'ltr' },
  priceUnit: { color: C.muted, fontSize: 13 },
  billing: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line, paddingVertical: 17 },
  billingLabel: { fontSize: 12, lineHeight: 20, color: C.muted, textAlign: 'right' },
  billingValue: { fontSize: 13, lineHeight: 20, fontWeight: '600', color: C.ink, textAlign: 'right' },
  benefits: { marginTop: 3 },
  benefit: { flexDirection: 'row-reverse', alignItems: 'center', gap: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.line },
  benefitNumber: { color: '#A2A5A9', fontSize: 12, fontVariant: ['tabular-nums'], width: 22, textAlign: 'center' },
  benefitText: { flex: 1, color: C.muted, fontSize: 14, lineHeight: 23, textAlign: 'right' },
  benefitLead: { color: C.ink, fontWeight: '600' },
  note: { color: C.muted, fontSize: 13, lineHeight: 22, textAlign: 'right', paddingTop: 18 },
  action: { marginTop: 26 },
  cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginTop: 5 },
  cancelText: { fontSize: 12, lineHeight: 20, color: C.red },
});
