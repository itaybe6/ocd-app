import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { OcdPlusStatus } from '../../lib/ocdPlus';
import { useOcdPlusMembership } from '../../state/useOcdPlusMembership';
import { OcdPlusMark } from '../../components/OcdPlusMark';
import {
  OCD_PLUS_CHECKLIST_SUMMARY,
  OCD_PLUS_SUBSCRIBE_BUTTON_LABEL,
  OCD_PLUS_SUBTITLE,
  OcdPlusChecklist,
} from '../../components/ocdPlusBenefits';
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
  destructiveBg: '#FFF0F0',
};

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

function headerSubtitle(status: OcdPlusStatus, nextBillingLabel: string | null, cancelAtPeriodEnd: boolean): string {
  if (status === 'active') {
    if (cancelAtPeriodEnd && nextBillingLabel) return `המנוי יסתיים ב־${nextBillingLabel}`;
    if (nextBillingLabel) return `החיוב הבא: ${nextBillingLabel}`;
    return 'ההטבות שלכם פעילות בחנות';
  }
  if (status === 'pending') return 'ממתין להשלמת התשלום';
  if (status === 'past_due') return 'יש לחדש את התשלום כדי להמשיך ליהנות מההטבות';
  if (status === 'cancelled') return 'אפשר להצטרף מחדש בכל עת';
  return OCD_PLUS_SUBTITLE;
}

function StatusBadge({ status }: { status: OcdPlusStatus }) {
  const isActive = status === 'active';
  const isWarning = status === 'pending' || status === 'past_due';
  const isCancelled = status === 'cancelled';

  return (
    <View
      style={{
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: isActive ? '#111111' : isWarning ? '#FFF8E6' : isCancelled ? P.destructiveBg : P.iconBg,
      }}
    >
      <Text
        style={{
          color: isActive ? '#FFFFFF' : isWarning ? '#B8860B' : isCancelled ? P.destructive : P.secondaryLabel,
          fontWeight: '800',
          fontSize: 11,
        }}
      >
        {statusLabel(status)}
      </Text>
    </View>
  );
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
  const subtitle = headerSubtitle(status, nextBillingLabel, !!subscription?.cancel_at_period_end);

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
            <Text style={styles.headerTitle}>מנוי OCD+</Text>
            <Text style={styles.headerSubtitle}>{subtitle}</Text>
          </View>

          <View style={{ width: 40 }} />
        </View>
      </View>

      {loading && status === 'none' ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={P.iconColor} />
          <Text style={styles.loadingText}>טוען פרטי מנוי…</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 16,
            paddingHorizontal: 20,
            paddingBottom: contentPaddingBottom + 16,
            gap: 12,
          }}
        >
          <View style={styles.cardShell}>
            <View style={styles.card}>
              <View style={styles.topRow}>
                <View style={styles.iconSlot}>
                  <OcdPlusMark size={26} />
                </View>

                <View style={styles.meta}>
                  <Text style={styles.cardTitle}>
                    {isActive ? 'אתם חברי OCD+' : 'מועדון OCD+'}
                  </Text>
                  <Text style={styles.cardSub}>
                    {isActive
                      ? 'תודה שאתם איתנו — ההנחות וההטבות פעילות.'
                      : 'הצטרפו וקבלו הנחות על כל המוצרים בחנות.'}
                  </Text>
                </View>

                <StatusBadge status={status} />
              </View>

              {isActive ? (
                <>
                  <View style={styles.divider} />
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryBox}>
                      <Text style={styles.summaryLabel}>מחיר חודשי</Text>
                      <Text style={styles.summaryValue}>₪69</Text>
                    </View>
                    <View style={styles.summaryBox}>
                      <Text style={styles.summaryLabel}>
                        {subscription?.cancel_at_period_end ? 'סיום מנוי' : 'חיוב הבא'}
                      </Text>
                      <Text style={styles.summaryValue} numberOfLines={2}>
                        {nextBillingLabel ?? '—'}
                      </Text>
                    </View>
                  </View>
                </>
              ) : null}
            </View>
          </View>

          <View style={styles.cardShell}>
            <View style={[styles.card, { gap: 16 }]}>
              <Text style={styles.sectionTitle}>מה כלול במנוי?</Text>
              <OcdPlusChecklist />
              <Text style={styles.summaryNote}>{OCD_PLUS_CHECKLIST_SUMMARY}</Text>
            </View>
          </View>

          {statusNote ? (
            <View style={styles.noteCard}>
              <Ionicons name="information-circle-outline" size={18} color={P.secondaryLabel} />
              <Text style={styles.noteText}>{statusNote}</Text>
            </View>
          ) : null}

          {!isActive ? (
            <Pressable
              onPress={startPurchase}
              disabled={busy}
              style={({ pressed }) => [
                styles.primaryButton,
                (pressed || busy) && { opacity: 0.88 },
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {busy ? 'פותח תשלום…' : OCD_PLUS_SUBSCRIBE_BUTTON_LABEL}
              </Text>
            </Pressable>
          ) : null}

          {isActive && !subscription?.cancel_at_period_end ? (
            <Pressable
              onPress={cancel}
              disabled={busy}
              style={({ pressed }) => [styles.cancelButton, (pressed || busy) && { opacity: 0.7 }]}
            >
              <Text style={styles.cancelButtonText}>{busy ? 'מבטל…' : 'ביטול המנוי'}</Text>
            </Pressable>
          ) : null}

          {isActive && subscription?.cancel_at_period_end ? (
            <View style={styles.noteCard}>
              <Ionicons name="time-outline" size={18} color={P.secondaryLabel} />
              <Text style={styles.noteText}>
                ביקשתם לבטל את המנוי. ההטבות יישארו פעילות עד סוף התקופה הנוכחית.
              </Text>
            </View>
          ) : null}
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
  headerSubtitle: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '600', textAlign: 'center' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: P.tertiaryLabel, fontSize: 14, fontWeight: '600' },

  cardShell: {
    backgroundColor: P.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    overflow: 'hidden',
  },
  card: {
    padding: 20,
    gap: 14,
  },
  topRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
  },
  iconSlot: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: P.iconBg,
  },
  meta: { flex: 1, alignItems: 'flex-end', gap: 4 },
  cardTitle: { fontSize: 17, lineHeight: 22, fontWeight: '800', color: P.label, textAlign: 'right' },
  cardSub: { fontSize: 13, lineHeight: 18, color: P.tertiaryLabel, textAlign: 'right', fontWeight: '600' },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: P.separator,
  },
  summaryRow: {
    flexDirection: 'row-reverse',
    gap: 12,
  },
  summaryBox: {
    flex: 1,
    minHeight: 78,
    borderRadius: 16,
    backgroundColor: '#F6F6F6',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
  },
  summaryLabel: {
    fontSize: 11,
    lineHeight: 15,
    color: P.tertiaryLabel,
    fontWeight: '700',
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 15,
    lineHeight: 20,
    color: P.label,
    fontWeight: '900',
    textAlign: 'center',
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: P.label,
    textAlign: 'right',
    alignSelf: 'stretch',
  },
  summaryNote: {
    fontSize: 13,
    lineHeight: 20,
    color: P.tertiaryLabel,
    fontWeight: '600',
    textAlign: 'right',
    alignSelf: 'stretch',
  },

  noteCard: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: P.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: P.separator,
    padding: 14,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: P.secondaryLabel,
    fontWeight: '600',
    textAlign: 'right',
  },

  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },

  cancelButton: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  cancelButtonText: {
    color: P.destructive,
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
